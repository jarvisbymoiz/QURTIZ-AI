$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'QurtizCompanion\app'))
$nodePath = Join-Path $root 'node.exe'
$processes = @(Get-CimInstance Win32_Process -Filter "Name='node.exe'")
$launchers = @($processes | Where-Object {
  $_.ExecutablePath -ieq $nodePath -and $_.CommandLine -match 'companion[\\/]windows[\\/]start\.mjs'
})
foreach ($launcher in $launchers) {
  $children = @($processes | Where-Object {
    $_.ParentProcessId -eq $launcher.ProcessId -and $_.ExecutablePath -ieq $nodePath
  })
  foreach ($child in $children) { Stop-Process -Id $child.ProcessId -Force -ErrorAction SilentlyContinue }
  Stop-Process -Id $launcher.ProcessId -Force -ErrorAction SilentlyContinue
}
Write-Host 'Qurtiz Companion stopped. It will start again at your next Windows sign-in.'
