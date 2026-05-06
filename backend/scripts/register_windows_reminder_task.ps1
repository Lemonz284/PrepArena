$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$taskName = "PrepArena-SendScheduleReminders"
$runBat = Join-Path $PSScriptRoot "run_schedule_reminders.bat"

if (-not (Test-Path $runBat)) {
    throw "Reminder runner not found at: $runBat"
}

$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$runBat`""
$trigger = New-ScheduledTaskTrigger -Daily -At 09:00
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -StartWhenAvailable

Register-ScheduledTask `
    -TaskName $taskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Description "Runs PrepArena reminder mailer once daily" `
    -Force

Write-Host "Registered task: $taskName"
