# Run from a normal PowerShell window, without administrator privileges.
param([Parameter(Mandatory=$true)][string]$AllowedDirectory)
$ErrorActionPreference = 'Stop'
$target = (Resolve-Path -LiteralPath $AllowedDirectory -ErrorAction Stop).Path
if (-not (Test-Path -LiteralPath $target -PathType Container)) { throw 'AllowedDirectory must be an existing folder.' }
Push-Location $PSScriptRoot
try {
    & npm.cmd ci --prefix dc-preview-lab/runtime-deps --ignore-scripts
    if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }
    & node dc-preview-lab/build.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Build failed. Use a fresh checkout if candidate already exists.' }
    & node dc-preview-lab/initialize-state.mjs $target
    if ($LASTEXITCODE -ne 0) { throw 'Private state initialization failed.' }
    & npm.cmd test
    if ($LASTEXITCODE -ne 0) { throw 'Tests failed.' }
} finally { Pop-Location }
