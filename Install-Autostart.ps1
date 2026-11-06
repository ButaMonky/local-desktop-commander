$ErrorActionPreference = 'Stop'
$name = 'Desktop Commander Local Compact - Public'
if (Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue) { throw 'Task already exists; nothing changed.' }
$launcher = Join-Path $PSScriptRoot 'Start-Compact.ps1'
$exe = Join-Path $env:SystemRoot 'System32/WindowsPowerShell/v1.0/powershell.exe'
$argsText = '-NoProfile -NonInteractive -WindowStyle Hidden -File "' + $launcher + '"'
$identity = [System.Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-ScheduledTaskPrincipal -UserId $identity.Name -LogonType Interactive -RunLevel Limited
$action = New-ScheduledTaskAction -Execute $exe -Argument $argsText -WorkingDirectory $PSScriptRoot
$logon = New-ScheduledTaskTrigger -AtLogOn -User $identity.Name
$retry = New-ScheduledTaskTrigger -Once -At ((Get-Date).AddMinutes(5)) -RepetitionInterval (New-TimeSpan -Minutes 5)
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName $name -Action $action -Trigger @($logon,$retry) -Principal $principal -Settings $settings -Description 'Starts this checkout of Compact after user logon; no other task is replaced.' | Out-Null
Write-Output ('Registered: ' + $name)
