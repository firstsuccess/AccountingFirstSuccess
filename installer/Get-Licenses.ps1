# Run on the development machine, with network access.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$dest = Join-Path $PSScriptRoot 'licenses'
New-Item -ItemType Directory -Force $dest | Out-Null
$nodeVersion = (& (Join-Path $root 'runtime\node.exe') --version).Trim()
if ($nodeVersion -ne 'v24.21.0') { throw "Expected Node.js v24.21.0, found $nodeVersion. Update the pinned LICENSE URL if upgrading." }
Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/nodejs/node/v24.21.0/LICENSE' -OutFile (Join-Path $dest 'NodeJS-LICENSE.txt')
# This is the WinSW v3 license. Verify the executable's actual release/branch before distributing.
Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/winsw/winsw/v3/LICENSE.txt' -OutFile (Join-Path $dest 'WinSW-LICENSE.txt')
$modules = Join-Path $root 'node_modules'
if (-not (Test-Path $modules)) { throw 'node_modules is missing. Run npm ci first.' }
$out = Join-Path $dest 'npm-licenses'
New-Item -ItemType Directory -Force $out | Out-Null
$packages = Get-ChildItem -Path $modules -Filter package.json -File -Recurse | Where-Object { $_.FullName -notmatch '[\\/]node_modules[\\/]\.cache[\\/]' }
$manifest = @()
foreach ($pkg in $packages) {
  $dir = Split-Path $pkg.FullName
  $meta = Get-Content $pkg.FullName -Raw | ConvertFrom-Json
  if (-not $meta.name) { continue }
  $name = [string]$meta.name
  $version = [string]$meta.version
  $relative = $dir.Substring($modules.Length).TrimStart('\','/')
  $safe = ($relative -replace '[^a-zA-Z0-9._-]', '_')
  $files = @(Get-ChildItem -LiteralPath $dir -File | Where-Object { $_.Name -match '^(LICENSE|LICENCE|COPYING|NOTICE)(\.|$)' })
  $target = Join-Path $out $safe
  New-Item -ItemType Directory -Force $target | Out-Null
  foreach ($f in $files) { Copy-Item -LiteralPath $f.FullName -Destination (Join-Path $target $f.Name) }
  $manifest += [pscustomobject]@{ name=$name; version=$version; declaredLicense=$meta.license; filesFound=@($files.Name); path=$relative }
}
$manifest | ConvertTo-Json -Depth 8 | Set-Content -Encoding UTF8 (Join-Path $dest 'npm-license-inventory.json')
$unresolved = @($manifest | Where-Object { $_.filesFound.Count -eq 0 -or -not $_.declaredLicense })
$unresolved | ConvertTo-Json -Depth 8 | Set-Content -Encoding UTF8 (Join-Path $dest 'REVIEW-REQUIRED.json')
Write-Host "Licenses collected in $dest. Packages: $($manifest.Count). Require manual review: $($unresolved.Count)."
Write-Host 'Review missing notices and the WinSW version before publishing. Do not treat this inventory as a legal clearance.'
