# Rotate the Secure MCP Tunnel runtime key for this checkout.
# Run interactively under the SAME Windows account as the original key.
# Never provide the key on the command line or in a GitHub issue.
#Requires -Version 5.1
$ErrorActionPreference = 'Stop'

$privateDirectory = Join-Path $PSScriptRoot 'local-tunnel\private'
$keyFile = Join-Path $privateDirectory 'runtime-key.clixml'
if (-not [System.Environment]::OSVersion.Platform.ToString().Equals('Win32NT')) {
    throw 'This key rotation procedure requires Windows DPAPI.'
}
if (-not (Test-Path -LiteralPath $keyFile -PathType Leaf)) {
    throw 'Existing key file not found. Use Save-TunnelKey.ps1 for initial setup.'
}

# Refuse an unreadable existing key; a different Windows user might be running.
$previous = Import-Clixml -LiteralPath $keyFile
if ($previous -isnot [System.Security.SecureString]) {
    throw 'The existing key is not a Windows-encrypted SecureString.'
}
$previous.Dispose()

$pendingFile = Join-Path $privateDirectory ('runtime-key.' + [Guid]::NewGuid().ToString('N') + '.pending.clixml')
$backupFile = Join-Path $privateDirectory ('runtime-key.clixml.backup.' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.' + [Guid]::NewGuid().ToString('N') + '.clixml')
$newKey = $null
$verified = $null
try {
    Write-Host 'Enter the NEW OpenAI Secure MCP Tunnel runtime key (input is hidden).'
    $newKey = Read-Host -Prompt 'New runtime API key' -AsSecureString
    if ($null -eq $newKey -or $newKey.Length -lt 20) {
        throw 'New key was empty or unexpectedly short. Existing key was not changed.'
    }
    $newKey | Export-Clixml -LiteralPath $pendingFile -NoClobber -ErrorAction Stop
    $verified = Import-Clixml -LiteralPath $pendingFile -ErrorAction Stop
    if ($verified -isnot [System.Security.SecureString] -or $verified.Length -ne $newKey.Length) {
        throw 'Encrypted key verification failed. Existing key was not changed.'
    }
    $verified.Dispose()
    $verified = $null

    # File.Replace on the same NTFS volume creates a backup and replaces atomically.
    [System.IO.File]::Replace($pendingFile, $keyFile, $backupFile, $true)
    Write-Host 'SUCCESS: Encrypted runtime key updated; prior encrypted key backed up.'
    Write-Host 'Restart ONLY this checkout''s Compact tunnel. Do not restart Remote.'
    Write-Host 'Never upload either the key or its encrypted backup to GitHub.'
}
finally {
    if ($verified -is [System.IDisposable]) { $verified.Dispose() }
    if ($newKey -is [System.IDisposable]) { $newKey.Dispose() }
    if (Test-Path -LiteralPath $pendingFile) {
        Remove-Item -LiteralPath $pendingFile -Force -ErrorAction SilentlyContinue
    }
}
