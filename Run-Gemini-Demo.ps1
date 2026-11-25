[CmdletBinding()]
param([ValidateSet('Desktop','Web')][string]$App='Desktop')
$ErrorActionPreference='Stop'
$root=$PSScriptRoot
$old=[Environment]::GetEnvironmentVariable('GEMINI_API_KEY','Process')
$secure=Read-Host 'Paste your Google AI Studio Gemini key here (hidden, not saved)' -AsSecureString
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
   if(!(Test-Path -LiteralPath $exe)){throw 'Portable desktop build is missing.'}
   if(Get-NetTCPConnection -LocalPort 8765 -State Listen -ErrorAction SilentlyContinue){throw 'Close the existing NetDoctor measurement service on port 8765 and try again.'}
   Start-Process -FilePath $exe -WorkingDirectory (Split-Path -Parent $exe)
 }
} finally {
 [Environment]::SetEnvironmentVariable('GEMINI_API_KEY',$old,'Process')
}
