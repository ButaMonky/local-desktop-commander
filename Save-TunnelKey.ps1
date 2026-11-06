# Enter only your own authorized tunnel runtime key; input is hidden.
$ErrorActionPreference = 'Stop'
$private = Join-Path $PSScriptRoot 'local-tunnel/private'
New-Item -ItemType Directory -Path $private -Force | Out-Null
$destination = Join-Path $private 'runtime-key.clixml'
if (Test-Path -LiteralPath $destination) { throw 'Credential file already exists; nothing changed.' }
$key = Read-Host 'Your tunnel runtime key' -AsSecureString
try { $key | Export-Clixml -LiteralPath $destination -NoClobber } finally { $key.Dispose() }
