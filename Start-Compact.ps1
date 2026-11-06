$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$tunnel = Join-Path $root 'local-tunnel/bin/tunnel-client.exe'
$profile = Join-Path $root 'local-tunnel/profile.yaml'
$keyFile = Join-Path $root 'local-tunnel/private/runtime-key.clixml'
$stateConfig = Join-Path $root 'dc-preview-lab/full-state/config.json'
$mutex = New-Object System.Threading.Mutex($false, 'Local\\DesktopCommanderPublicCompactTunnel')
$ownsMutex = $false
$key = $null
try {
    try { $ownsMutex = $mutex.WaitOne(0) } catch [System.Threading.AbandonedMutexException] { $ownsMutex = $true }
    if (-not $ownsMutex) { exit 0 }
    foreach ($required in @($tunnel,$profile,$keyFile,$stateConfig)) {
        if (-not (Test-Path -LiteralPath $required -PathType Leaf)) { throw 'Setup incomplete. See docs/SETUP.ja.md.' }
    }
    $key = Import-Clixml -LiteralPath $keyFile
    if ($key -isnot [System.Security.SecureString]) { throw 'Invalid credential file format.' }
    $env:CONTROL_PLANE_API_KEY = (New-Object System.Net.NetworkCredential('', $key)).Password
    & $tunnel run --profile-file $profile --health.url-file (Join-Path $root 'local-tunnel/health.url') --pid.file (Join-Path $root 'local-tunnel/runtime.pid') --log.file (Join-Path $root 'local-tunnel/runtime.log')
    exit $LASTEXITCODE
} finally {
    Remove-Item Env:CONTROL_PLANE_API_KEY -ErrorAction SilentlyContinue
    if ($key) { $key.Dispose() }
    if ($ownsMutex) { $mutex.ReleaseMutex() }
    $mutex.Dispose()
}
