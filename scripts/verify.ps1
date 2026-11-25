[CmdletBinding()]
param([switch]$Build)
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
function Step($name,$dir,$command){
 Write-Host "`n=== $name ===" -ForegroundColor Cyan
 Push-Location -LiteralPath (Join-Path $root $dir)
 try{ & $command; if($LASTEXITCODE -ne 0){throw "$name failed with exit code $LASTEXITCODE"} }
 finally{Pop-Location}
}
function RunNode($native,$fallback,$argsList) {
 if(Test-Path -LiteralPath (Join-Path 'node_modules\.bin' $native)) {
  & (Join-Path '.\node_modules\.bin' $native) @argsList
 } else {
  & node $fallback @argsList
 }
}
Step 'Python API, decisions and measured lab' 'backend' { & python -B -m unittest -v }
Step 'Repeatable loopback evaluation' 'backend' { & python -B evaluate.py --rounds 3 }
Step 'Next.js type check' 'web' { RunNode 'tsc.cmd' '.\node_modules\typescript\bin\tsc' @('--noEmit') }
Step 'Next.js unit tests' 'web' { & npm.cmd test }
Step 'Electron syntax' 'desktop' { & npm.cmd run check }
Step 'Electron model and renderer' 'desktop' { & npm.cmd test }
Step 'Expo model' 'android' { & npm.cmd test }
Step 'Expo transport and Python integration' 'android' { & npm.cmd run test:integration }
if($Build){
 Step 'Next.js production export' 'web' { $env:NETDOCTOR_STATIC='1'; RunNode 'next.cmd' '.\node_modules\next\dist\bin\next' @('build','--webpack') }
 Step 'Expo Android bundle' 'android' { $env:EXPO_OFFLINE='1'; & npm.cmd run bundle:android }
 Step 'Portable Electron build' 'desktop' { & .\make-portable.ps1 }
}
Write-Host 'All requested checks passed. Device and live Firebase checks are separate.' -ForegroundColor Green
