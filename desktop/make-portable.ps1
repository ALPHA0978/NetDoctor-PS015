$ErrorActionPreference = 'Stop'
$base = $PSScriptRoot
$source = Join-Path $base 'node_modules\electron\dist'
$target = Join-Path $base ('release\NetDoctor-win-' + (& node -p 'process.arch'))
$appFolder = Join-Path $target 'resources\app'
$backendFolder = Join-Path $target 'resources\backend'
if (!(Test-Path -LiteralPath (Join-Path $source 'electron.exe'))) { throw 'Run npm install before packaging.' }
New-Item -ItemType Directory -Path $target,$appFolder,$backendFolder -Force | Out-Null
foreach($item in (Get-ChildItem -LiteralPath $source -Force)){
  if($item.Name -eq 'electron.exe') {
    Copy-Item -LiteralPath $item.FullName -Destination (Join-Path $target 'NetDoctor.exe') -Force
  } else {
    Copy-Item -LiteralPath $item.FullName -Destination $target -Recurse -Force
  }
}
foreach($name in 'package.json','main.cjs','preload.cjs','index.html','style.css','renderer.js','model.js','demo-data.js'){
  Copy-Item -LiteralPath (Join-Path $base $name) -Destination $appFolder -Force
}
foreach($name in 'server.py','lab.py','diagnosis.py','probes.py','gemini_evidence.py'){
  $file=Join-Path $base ("..\backend\"+$name)
  if(Test-Path -LiteralPath $file){Copy-Item -LiteralPath $file -Destination $backendFolder -Force}
}
$viewTarget=Join-Path $appFolder 'src'
New-Item -ItemType Directory -Path $viewTarget -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $base 'src\result-view.js'),(Join-Path $base 'src\judge-view.js') -Destination $viewTarget -Force
$duplicate = Join-Path $target 'electron.exe'
if(Test-Path -LiteralPath $duplicate -PathType Leaf){
  $canonical = Join-Path $source 'electron.exe'
  if((Get-FileHash -LiteralPath $duplicate).Hash -eq (Get-FileHash -LiteralPath $canonical).Hash) {
    Remove-Item -LiteralPath $duplicate -Force
  }
}
Write-Output ("Portable folder: "+$target)
Write-Output 'Open NetDoctor.exe. Keep its resources folder beside it. Python 3 is needed for Live and Lab.'


