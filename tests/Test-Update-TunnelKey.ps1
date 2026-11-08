# Offline regression tests. No real keys, network traffic or production files.
#Requires -Version 5.1
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Assert-Test([bool]$condition, [string]$message) {
    if (-not $condition) { throw ('FAIL: ' + $message) }
    Write-Output ('PASS: ' + $message)
}
function Read-TestSecureString([System.Security.SecureString]$value) {
    $pointer = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($value)
    try { return [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
    finally { [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
}
$source = Join-Path (Split-Path -Parent $PSScriptRoot) 'Update-TunnelKey.ps1'
$root = Join-Path ([System.IO.Path]::GetTempPath()) ('dc-rotation-' + [Guid]::NewGuid().ToString('N'))
$privateDir = Join-Path $root 'local-tunnel\private'
$keyFile = Join-Path $privateDir 'runtime-key.clixml'
$oldDummy = 'TEST-ONLY-OLD-KEY-NOT-REAL-0123456789'
$newDummy = 'TEST-ONLY-NEW-KEY-NOT-REAL-0123456789'
try {
    New-Item -Path $privateDir -ItemType Directory -Force | Out-Null
    Copy-Item -LiteralPath $source -Destination (Join-Path $root 'Update-TunnelKey.ps1')
    $initial = ConvertTo-SecureString $oldDummy -AsPlainText -Force
    $initial | Export-Clixml -LiteralPath $keyFile
    $initial.Dispose()

    # Mock only Read-Host, in this isolated PowerShell session.
    $global:DC_Test_RuntimeKey = $newDummy
    function Read-Host {
        param([string]$Prompt, [switch]$AsSecureString)
        if (-not $AsSecureString) { throw 'Test expected hidden key entry.' }
        return (ConvertTo-SecureString $global:DC_Test_RuntimeKey -AsPlainText -Force)
    }
    & (Join-Path $root 'Update-TunnelKey.ps1') | Out-Null

    $current = Import-Clixml -LiteralPath $keyFile
    Assert-Test ((Read-TestSecureString $current) -eq $newDummy) 'new key securely stored'
    $current.Dispose()
    $backups = @(Get-ChildItem -LiteralPath $privateDir -Filter 'runtime-key.clixml.backup.*.clixml')
    Assert-Test ($backups.Count -eq 1) 'exactly one encrypted backup created'
    $restored = Import-Clixml -LiteralPath $backups[0].FullName
    Assert-Test ((Read-TestSecureString $restored) -eq $oldDummy) 'backup retains previous key'
    $restored.Dispose()
    Assert-Test (@(Get-ChildItem -LiteralPath $privateDir -Filter '*.pending.clixml').Count -eq 0) 'no pending key file left'

    $before = (Get-FileHash -LiteralPath $keyFile -Algorithm SHA256).Hash
    $global:DC_Test_RuntimeKey = 'short'
    $raised = $false
    try { & (Join-Path $root 'Update-TunnelKey.ps1') | Out-Null }
    catch { $raised = $true }
    Assert-Test $raised 'short key rejected'
    Assert-Test ((Get-FileHash -LiteralPath $keyFile -Algorithm SHA256).Hash -eq $before) 'short key did not alter saved key'
    Assert-Test (@(Get-ChildItem -LiteralPath $privateDir -Filter 'runtime-key.clixml.backup.*.clixml').Count -eq 1) 'short key did not create new backup'

    Set-Content -LiteralPath $keyFile -Value 'invalid-encrypted-file' -NoNewline
    $before = (Get-FileHash -LiteralPath $keyFile -Algorithm SHA256).Hash
    $global:DC_Test_RuntimeKey = $newDummy
    $raised = $false
    try { & (Join-Path $root 'Update-TunnelKey.ps1') | Out-Null }
    catch { $raised = $true }
    Assert-Test $raised 'corrupted existing key rejected'
    Assert-Test ((Get-FileHash -LiteralPath $keyFile -Algorithm SHA256).Hash -eq $before) 'corrupted key not overwritten'
    Remove-Item -LiteralPath $keyFile -Force
    $raised = $false
    try { & (Join-Path $root 'Update-TunnelKey.ps1') | Out-Null }
    catch { $raised = $true }
    Assert-Test $raised 'missing initial key refused; no unintended creation'
}
finally {
    Remove-Item Function:\Read-Host -ErrorAction SilentlyContinue
    Remove-Variable DC_Test_RuntimeKey -Scope Global -ErrorAction SilentlyContinue
    if (Test-Path -LiteralPath $root) { Remove-Item -LiteralPath $root -Recurse -Force }
}
