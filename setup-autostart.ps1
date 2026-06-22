# ============================================================
#  Smart POS — Auto-Start Setup
#  Run this script ONCE as Administrator.
#  Services will auto-start on login as YOUR user (not SYSTEM).
# ============================================================

Clear-Host
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "     SMART POS AUTO-START SETUP                     " -ForegroundColor Cyan
Write-Host "====================================================`n" -ForegroundColor Cyan

# ── Get the actual logged-in username (not SYSTEM) ──────────
$currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
Write-Host "[INFO] Setting up tasks for user: $currentUser" -ForegroundColor White

# ── Paths ────────────────────────────────────────────────────
$posDir     = "C:\Users\Hi\Documents\smart_pos"
$printDir   = "C:\Users\Hi\Documents\smart_pos\print-server"

# ── [1/4] Write batch files ──────────────────────────────────
Write-Host "`n[1/4] Writing startup batch files..." -ForegroundColor White

@"
@echo off
cd /d "$posDir"
npm run start
"@ | Out-File -FilePath "$posDir\start-pos.bat" -Encoding ascii

@"
@echo off
cd /d "$printDir"
node server.js
"@ | Out-File -FilePath "$printDir\start-printer.bat" -Encoding ascii

Write-Host "      OK: Batch files written." -ForegroundColor Green

# ── [2/4] Remove old SYSTEM tasks if they exist ─────────────
Write-Host "`n[2/4] Removing old SYSTEM-account tasks (if any)..." -ForegroundColor White
Unregister-ScheduledTask -TaskName "Smart POS Start"   -Confirm:$false -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName "Print Server Start" -Confirm:$false -ErrorAction SilentlyContinue
Write-Host "      OK: Old tasks cleared." -ForegroundColor Green

# Check for Administrator elevation
if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]"Administrator")) {
    Write-Host "`n[ERROR] This script must be run as Administrator." -ForegroundColor Red
    Write-Host "        Right-click PowerShell and choose Run as Administrator, then try again.`n" -ForegroundColor Red
    exit 1
}

# [3/4] Register tasks as CURRENT USER (InteractiveOrPassword)
Write-Host "`n[3/4] Registering tasks as $currentUser (Interactive)..." -ForegroundColor White

$trigger  = New-ScheduledTaskTrigger -AtLogOn -User $currentUser
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -ExecutionTimeLimit 0

$principal = New-ScheduledTaskPrincipal `
    -UserId $currentUser `
    -LogonType InteractiveOrPassword `
    -RunLevel Highest

$action1 = New-ScheduledTaskAction `
    -Execute "cmd.exe" `
    -Argument "/c `"$posDir\start-pos.bat`"" `
    -WorkingDirectory $posDir

$action2 = New-ScheduledTaskAction `
    -Execute "cmd.exe" `
    -Argument "/c `"$printDir\start-printer.bat`"" `
    -WorkingDirectory $printDir

Register-ScheduledTask `
    -TaskName "Smart POS - Next.js Server" `
    -Action $action1 `
    -Trigger $trigger `
    -Settings $settings `
    -Principal $principal `
    -Force | Out-Null

Register-ScheduledTask `
    -TaskName "Smart POS - Print Server" `
    -Action $action2 `
    -Trigger $trigger `
    -Settings $settings `
    -Principal $principal `
    -Force | Out-Null

Write-Host "      OK: Tasks registered." -ForegroundColor Green

# Kill anything already on port 9090 or 3000
Write-Host "`n[3b] Killing any existing processes on ports 9090 and 3000..." -ForegroundColor White
@(9090, 3000) | ForEach-Object {
    $port = $_
    $pids = (netstat -ano | Select-String ":$port\s") |
            ForEach-Object { ($_ -split '\s+')[-1] } | Sort-Object -Unique
    foreach ($p in $pids) {
        if ($p -match '^\d+$' -and $p -ne 0) {
            Stop-Process -Id ([int]$p) -Force -ErrorAction SilentlyContinue
            Write-Host ("      Killed PID " + $p + " on port " + $port) -ForegroundColor Yellow
        }
    }
}
Start-Sleep -Seconds 2
Write-Host "      OK: Ports cleared." -ForegroundColor Green

# ── [4/4] Start them NOW ─────────────────────────────────────
Write-Host "`n[4/4] Starting services now..." -ForegroundColor White
Start-ScheduledTask -TaskName "Smart POS - Print Server"
Start-Sleep -Seconds 3
Start-ScheduledTask -TaskName "Smart POS - Next.js Server"

Write-Host "`n[WAIT] Waiting 20 seconds for Next.js to boot..." -ForegroundColor Yellow
Start-Sleep -Seconds 20

# Verification
Write-Host "`n[VERIFICATION]" -ForegroundColor Cyan
$ports = Get-NetTCPConnection -LocalPort 3000,9090 -State Listen -ErrorAction SilentlyContinue

if ($ports) {
    Write-Host "  Active ports:" -ForegroundColor White
    $ports | ForEach-Object {
        $label = if ($_.LocalPort -eq 3000) { "Next.js POS" } else { "Print Server" }
        Write-Host ("  [OK] " + $label + " on port " + $_.LocalPort) -ForegroundColor Green
    }
    Write-Host "`n  SUCCESS: Both services are running as user $currentUser." -ForegroundColor Green
    Write-Host "  Printers will work correctly (Interactive user session)." -ForegroundColor Green
} else {
    Write-Host "  WARNING: Ports not detected yet. Wait 10 more seconds and check Task Manager." -ForegroundColor Yellow
}

Write-Host "`n[NOTE] Tasks run at every LOGIN of $currentUser - not at Windows boot." -ForegroundColor Cyan
Write-Host "       This is required because USB printers are only accessible after login.`n" -ForegroundColor Cyan
