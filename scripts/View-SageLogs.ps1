param([string]$LogDirectory = (Join-Path $PSScriptRoot "..\logs"))
if (-not (Test-Path $LogDirectory)) { Write-Host "No SAGE logs yet: $LogDirectory"; exit 0 }
Write-Host "Following SAGE logs. Filter by request ID with: Select-String '<request-id>' .\logs\*.log"
Get-Content -Path (Join-Path $LogDirectory "*.log") -Wait
