# EHR System - Network Access Info Script

Write-Host "`n================================" -ForegroundColor Cyan
Write-Host "EHR System - Network Access Info" -ForegroundColor Cyan
Write-Host "================================`n" -ForegroundColor Cyan

# Get local IP address (exclude loopback and link-local)
$localIP = (Get-NetIPAddress -AddressFamily IPv4 | 
    Where-Object {$_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.*" -and $_.PrefixOrigin -ne "WellKnown"} | 
    Select-Object -First 1).IPAddress

if ($localIP) {
    Write-Host "Your Local Network IP: " -NoNewline -ForegroundColor Yellow
    Write-Host $localIP -ForegroundColor Green
} else {
    Write-Host "Could not detect network IP" -ForegroundColor Red
    $localIP = "<YOUR_IP_HERE>"
}

Write-Host "`n================================" -ForegroundColor Cyan
Write-Host "URLs for Testing Team:" -ForegroundColor Cyan
Write-Host "================================`n" -ForegroundColor Cyan

Write-Host "Frontend (Next.js):" -ForegroundColor White
Write-Host "  Local:   " -NoNewline
Write-Host "http://localhost:3000" -ForegroundColor Green
Write-Host "  Network: " -NoNewline
Write-Host "http://$($localIP):3000" -ForegroundColor Yellow

Write-Host "`nBackend (Express API):" -ForegroundColor White
Write-Host "  Local:   " -NoNewline
Write-Host "http://localhost:5000" -ForegroundColor Green
Write-Host "  Network: " -NoNewline
Write-Host "http://$($localIP):5000" -ForegroundColor Yellow

Write-Host "`n================================" -ForegroundColor Cyan
Write-Host "Instructions:" -ForegroundColor Cyan
Write-Host "================================`n" -ForegroundColor Cyan

Write-Host "1. Share the Network URLs with your testing team" -ForegroundColor White
Write-Host "2. Make sure they're on the same WiFi/network" -ForegroundColor White
Write-Host "3. Windows Firewall must allow ports 3000 and 5000" -ForegroundColor White

Write-Host "`n================================" -ForegroundColor Cyan
Write-Host "Firewall Configuration:" -ForegroundColor Cyan
Write-Host "================================`n" -ForegroundColor Cyan

# Check if running as administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if ($isAdmin) {
    Write-Host "Running as Administrator - Can configure firewall`n" -ForegroundColor Green
    
    $response = Read-Host "Do you want to add firewall rules for ports 3000 and 5000? (y/n)"
    
    if ($response -eq 'y' -or $response -eq 'Y') {
        try {
            # Add firewall rule for Next.js (port 3000)
            New-NetFirewallRule -DisplayName "Next.js Development Server" `
                -Direction Inbound `
                -Protocol TCP `
                -LocalPort 3000 `
                -Action Allow `
                -ErrorAction SilentlyContinue
            
            # Add firewall rule for Express API (port 5000)
            New-NetFirewallRule -DisplayName "Express API Server" `
                -Direction Inbound `
                -Protocol TCP `
                -LocalPort 5000 `
                -Action Allow `
                -ErrorAction SilentlyContinue
            
            Write-Host "`nFirewall rules added successfully!" -ForegroundColor Green
        } catch {
            Write-Host "`nFirewall rules may already exist or error occurred" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "To configure firewall, run PowerShell as Administrator and execute:" -ForegroundColor Yellow
    Write-Host "`nNew-NetFirewallRule -DisplayName 'Next.js Dev' -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow" -ForegroundColor Gray
    Write-Host "New-NetFirewallRule -DisplayName 'Express API' -Direction Inbound -Protocol TCP -LocalPort 5000 -Action Allow`n" -ForegroundColor Gray
}

Write-Host "`n================================" -ForegroundColor Cyan
Write-Host "Testing:" -ForegroundColor Cyan
Write-Host "================================`n" -ForegroundColor Cyan

Write-Host "Your team can test by:" -ForegroundColor White
Write-Host "1. Opening browser on their device" -ForegroundColor White
Write-Host "2. Going to: " -NoNewline -ForegroundColor White
Write-Host "http://$($localIP):3000" -ForegroundColor Yellow
Write-Host "3. They should see the EHR login page`n" -ForegroundColor White

Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
