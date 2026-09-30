param([Parameter(Mandatory = $true)][string]$Source)
$ErrorActionPreference = 'Stop'
$sourceRoot = [IO.Path]::GetFullPath($Source)
$installRoot = Join-Path $env:LOCALAPPDATA 'QurtizCompanion\app'
if (-not (Test-Path -LiteralPath (Join-Path $sourceRoot 'node.exe')) -or
    -not (Test-Path -LiteralPath (Join-Path $sourceRoot 'companion\windows\start.mjs'))) {
  throw 'The Qurtiz Companion package is incomplete. Download it again.'
}
if ($sourceRoot.TrimEnd('\') -ieq $installRoot.TrimEnd('\')) {
  throw 'Run the installer from the extracted download, not from the installed app folder.'
}
$health = $null
try { $health = Invoke-WebRequest -Uri 'http://127.0.0.1:8788/health' -UseBasicParsing -TimeoutSec 2 } catch { }
if ($health) {
  throw 'Qurtiz Companion is already running. Close it before installing or updating.'
}
New-Item -ItemType Directory -Path $installRoot -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $sourceRoot 'node.exe') -Destination $installRoot -Force
Copy-Item -LiteralPath (Join-Path $sourceRoot 'companion') -Destination $installRoot -Recurse -Force
Copy-Item -LiteralPath (Join-Path $sourceRoot 'node_modules') -Destination $installRoot -Recurse -Force
$launcher = Join-Path $installRoot 'companion\windows\Start Qurtiz Companion Hidden.vbs'
$startup = [Environment]::GetFolderPath('Startup')
$shortcutPath = Join-Path $startup 'Qurtiz Companion.lnk'
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = Join-Path $env:WINDIR 'System32\wscript.exe'
$shortcut.Arguments = '"' + $launcher + '"'
$shortcut.WorkingDirectory = $installRoot
$shortcut.Description = 'Start Qurtiz Companion when you sign in to Windows'
$shortcut.Save()
Start-Process -FilePath (Join-Path $env:WINDIR 'System32\wscript.exe') -ArgumentList ('"' + $launcher + '"') -WindowStyle Hidden
Write-Host 'Qurtiz Companion installed and started in the background. It will start when you sign in to Windows.'
Write-Host 'Return to Qurtiz Settings, choose ChatGPT Account Mode, then Pair this computer and Connect ChatGPT.'
