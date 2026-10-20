param([Parameter(Mandatory = $true)][string]$FrontendPath, [Parameter(Mandatory = $true)][string]$LogPath)
Set-Location $FrontendPath
Get-NetTCPConnection -LocalPort 8443 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
$pnpm = if (Get-Command pnpm -ErrorAction SilentlyContinue) { "pnpm" } else { "npx" }
if ($pnpm -eq "pnpm") { & pnpm run dev 2>&1 | & "$PSScriptRoot\Write-RotatingLog.ps1" -Path $LogPath } else { & npx pnpm run dev 2>&1 | & "$PSScriptRoot\Write-RotatingLog.ps1" -Path $LogPath }
