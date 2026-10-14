param(
  [Parameter(Mandatory=$true)][ValidateSet('before','after','uninstall')][string]$Operation,
  [Parameter(Mandatory=$true)][string]$InstallDir,
  [Parameter(Mandatory=$true)][string]$StateFile
)
$ErrorActionPreference = 'Stop'
$serviceName = 'MonjaAccounting'
$wrapper = Join-Path $InstallDir 'service\MonjaAccounting.exe'
function Service { Get-Service -Name $serviceName -ErrorAction SilentlyContinue }
function WaitForState([string]$target) {
  $s = Service
  if ($null -ne $s) { $s.WaitForStatus($target, [TimeSpan]::FromSeconds(45)) }
}
try {
  switch ($Operation) {
    'before' {
      $s = Service
      if ($null -eq $s) { 'new' | Set-Content -LiteralPath $StateFile -Encoding ASCII; break }
      if ($s.Status -eq 'Running') {
        'running' | Set-Content -LiteralPath $StateFile -Encoding ASCII
        Stop-Service -Name $serviceName -ErrorAction Stop
        WaitForState 'Stopped'
      } else {
        'stopped' | Set-Content -LiteralPath $StateFile -Encoding ASCII
        if ($s.Status -ne 'Stopped') { Stop-Service -Name $serviceName -ErrorAction Stop; WaitForState 'Stopped' }
      }
    }
    'after' {
      if (!(Test-Path -LiteralPath $wrapper)) { throw "WinSW not found: $wrapper" }
      if ($null -eq (Service)) {
        & $wrapper install
        if ($LASTEXITCODE -ne 0) { throw "WinSW install failed: $LASTEXITCODE" }
        # First installation remains stopped/manual until .env is configured.
        Set-Service -Name $serviceName -StartupType Manual
      } elseif ((Test-Path -LiteralPath $StateFile) -and
              ((Get-Content -LiteralPath $StateFile -Raw).Trim() -eq 'running')) {
        Start-Service -Name $serviceName
        WaitForState 'Running'
      }
    }
    'uninstall' {
      $s = Service
      if ($null -ne $s) {
        if ($s.Status -ne 'Stopped') { Stop-Service -Name $serviceName; WaitForState 'Stopped' }
        if (!(Test-Path -LiteralPath $wrapper)) { throw "WinSW not found: $wrapper" }
        & $wrapper uninstall
        if ($LASTEXITCODE -ne 0) { throw "WinSW uninstall failed: $LASTEXITCODE" }
      }
    }
  }
  exit 0
} catch {
  Write-Error $_
  exit 1
}
