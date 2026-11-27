[CmdletBinding()]
param([ValidateSet('Desktop','Web')][string]$App='Desktop',[switch]$SetKey)
$ErrorActionPreference='Stop'
$root=$PSScriptRoot
$keyFile=Join-Path $root '.env.gemini.dpapi'
if($SetKey){
 $secure=Read-Host 'Paste your Gemini key to save it for this Windows user (hidden)' -AsSecureString
 try {
   if($secure.Length -eq 0){throw 'No key entered.'}
   $encrypted=ConvertFrom-SecureString -SecureString $secure
   Set-Content -LiteralPath $keyFile -Value $encrypted -Encoding ascii
   $check=ConvertTo-SecureString -String (Get-Content -LiteralPath $keyFile -Raw).Trim()
   try {if($check.Length -ne $secure.Length){throw 'Saved key could not be verified.'}}
   finally {$check.Dispose()}
   Write-Host 'Gemini key saved for this Windows user.'
 } finally {$secure.Dispose()}
 return
}
$old=[Environment]::GetEnvironmentVariable('GEMINI_API_KEY','Process')
$secure=if(Test-Path -LiteralPath $keyFile){
 ConvertTo-SecureString -String (Get-Content -LiteralPath $keyFile -Raw).Trim()
} else {
 Read-Host 'Paste your Google AI Studio Gemini key here (hidden, not saved)' -AsSecureString
}
if($secure.Length -eq 0){throw 'No key entered.'}
$ptr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try{
 $env:GEMINI_API_KEY=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
} finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr); $secure.Dispose() }
try {
 if($App -eq 'Web'){
   & python -B (Join-Path $root 'web_demo.py')
 } else {
   $exe=Join-Path $root 'desktop\release\NetDoctor-win-x64\NetDoctor.exe'
   if(Test-Path -LiteralPath $exe){
     Start-Process -FilePath $exe -WorkingDirectory (Split-Path -Parent $exe)
   } else {
     $electron=Join-Path $root 'desktop\node_modules\.bin\electron.cmd'
     if(!(Test-Path -LiteralPath $electron)){throw 'Install desktop dependencies with npm.cmd ci --prefix desktop.'}
     & npm.cmd --prefix (Join-Path $root 'desktop') start
     if($LASTEXITCODE -ne 0){throw "Desktop exited with code $LASTEXITCODE."}
   }
 }
} finally {
 [Environment]::SetEnvironmentVariable('GEMINI_API_KEY',$old,'Process')
}
