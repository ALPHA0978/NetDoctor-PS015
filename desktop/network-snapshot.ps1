$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)

# UDP Connect asks Windows to select a route and source address without sending a packet.
function Get-RouteSource($family, $destination) {
  $socket = $null
  try {
    $socket = [System.Net.Sockets.Socket]::new($family, 'Dgram', 'Udp')
    $socket.Connect([ipaddress]::Parse($destination), 443)
    return $socket.LocalEndPoint.Address
  } catch [System.Net.Sockets.SocketException] {
    return $null
  } finally {
    if ($socket) { $socket.Dispose() }
  }
}

$source = Get-RouteSource 'InterNetwork' '1.1.1.1'
if (!$source) { $source = Get-RouteSource 'InterNetworkV6' '2606:4700:4700::1111' }
if (!$source) {
  @{ state = 'disconnected' } | ConvertTo-Json -Compress
  return
}

$adapter = [System.Net.NetworkInformation.NetworkInterface]::GetAllNetworkInterfaces() |
  Where-Object {
    $_.OperationalStatus -eq 'Up' -and
      ($_.GetIPProperties().UnicastAddresses | Where-Object { $_.Address.Equals($source) })
  } | Select-Object -First 1
if (!$adapter) {
  @{ state = 'unavailable' } | ConvertTo-Json -Compress
  return
}

$properties = $adapter.GetIPProperties()
$addresses = @($properties.UnicastAddresses | ForEach-Object { $_.Address.ToString().Split('%')[0] })
$gateways = @($properties.GatewayAddresses |
  Where-Object { $_.Address.AddressFamily -eq $source.AddressFamily -and $_.Address.ToString() -notin @('0.0.0.0', '::') } |
  ForEach-Object { $_.Address.ToString() })
$stats = $null
try { $stats = $adapter.GetIPStatistics() } catch [System.Net.NetworkInformation.NetworkInformationException] {}
$sampledAt = [System.Diagnostics.Stopwatch]::GetTimestamp() * 1000.0 / [System.Diagnostics.Stopwatch]::Frequency
$linkSpeed = $adapter.Speed
$networkName = $null
if ($adapter.NetworkInterfaceType -eq 'Wireless80211') {
  $wifi = & "$env:SystemRoot\System32\netsh.exe" wlan show interfaces 2>$null
  if ($LASTEXITCODE -eq 0) {
    $matchingAdapter = $false
    foreach ($line in $wifi) {
      if ($line -match '^\s*GUID\s*:\s*([0-9a-f-]+)\s*$') {
        $matchingAdapter = $Matches[1] -eq $adapter.Id.Trim('{', '}')
      } elseif ($matchingAdapter -and $line -match '^\s*SSID\s*:\s*(.+)$') {
        $networkName = $Matches[1].Trim()
        break
      }
    }
  }
}
$connections = $null
$chromeRunning = $false
$principal = [Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent())
$isAdmin = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
$trafficStatus = if ($isAdmin) { 'off' } else { 'requires-admin' }
$canReadTraffic = $false
if ($env:NETDOCTOR_TCP_APP -and $isAdmin) {
  try {
    Add-Type -LiteralPath $env:NETDOCTOR_TCP_SOURCE
    $canReadTraffic = $true
    $trafficStatus = 'sampling'
  } catch { $trafficStatus = 'unavailable' }
}
$tcpSampledAt = $null
if (Test-Path -LiteralPath $env:SystemRoot\System32\netstat.exe) {
  $rows = & "$env:SystemRoot\System32\netstat.exe" -ano
  if ($LASTEXITCODE -eq 0) {
    $processNames = @{}
    Get-Process | ForEach-Object { $processNames[[int]$_.Id] = $_.ProcessName }
    $chromeRunning = $processNames.Values -contains 'chrome'
    $tcpSampledAt = [System.Diagnostics.Stopwatch]::GetTimestamp() * 1000.0 / [System.Diagnostics.Stopwatch]::Frequency
    $connections = @(foreach ($row in $rows) {
      if ($row -notmatch '^\s*TCP\s+(\S+):(\d+)\s+(\S+):(\d+)\s+ESTABLISHED\s+(\d+)\s*$') { continue }
      $localIp = [ipaddress]::Parse($Matches[1].Trim('[', ']'))
      $remoteIp = [ipaddress]::Parse($Matches[3].Trim('[', ']'))
      $localPort = [int]$Matches[2]
      $remotePort = [int]$Matches[4]
      $processId = [int]$Matches[5]
      $owner = $processNames[$processId]
      $local = $localIp.ToString().Split('%')[0]
      $remote = $remoteIp.ToString().Split('%')[0]
      if ($localIp.IsIPv4MappedToIPv6) { $local = $localIp.MapToIPv4().ToString() }
      if ($local -notin $addresses) { continue }
      if ($remoteIp.IsIPv4MappedToIPv6) { $remote = $remoteIp.MapToIPv4().ToString() }
      $counters = $null
      if ($canReadTraffic -and $owner -eq $env:NETDOCTOR_TCP_APP) {
        try {
          $counters = [NetDoctorTcpCounters]::Read($localIp, $localPort, $remoteIp, $remotePort)
        } catch {
          $canReadTraffic = $false
          $trafficStatus = 'unavailable'
        }
      }
      [pscustomobject]@{
        app = $owner; address = $remote; port = $remotePort
        key = "$processId|${localIp}|$localPort|${remoteIp}|$remotePort"
        received = if ($counters) { $counters[0] } else { $null }
        sent = if ($counters) { $counters[1] } else { $null }
        segmentsIn = if ($counters) { $counters[2] } else { $null }
        segmentsOut = if ($counters) { $counters[3] } else { $null }
      }
    })
  }
}

[pscustomobject]@{
  state = 'connected'
  id = $adapter.Id
  name = $adapter.Name
  networkName = $networkName
  type = [string]$adapter.NetworkInterfaceType
  address = $source.ToString()
  gateways = $gateways
  linkSpeed = if ($linkSpeed -gt 0) { $linkSpeed } else { $null }
  received = if ($stats -and $stats.BytesReceived -ge 0) { $stats.BytesReceived } else { $null }
  sent = if ($stats -and $stats.BytesSent -ge 0) { $stats.BytesSent } else { $null }
  packetsIn = if ($stats -and $stats.UnicastPacketsReceived -ge 0 -and $stats.NonUnicastPacketsReceived -ge 0) {
    $stats.UnicastPacketsReceived + $stats.NonUnicastPacketsReceived
  } else { $null }
  packetsOut = if ($stats -and $stats.UnicastPacketsSent -ge 0 -and $stats.NonUnicastPacketsSent -ge 0) {
    $stats.UnicastPacketsSent + $stats.NonUnicastPacketsSent
  } else { $null }
  sampledAt = $sampledAt
  tcpSampledAt = $tcpSampledAt
  trafficStatus = $trafficStatus
  chromeRunning = $chromeRunning
  connections = $connections
} | ConvertTo-Json -Compress -Depth 4
