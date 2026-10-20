param([Parameter(Mandatory = $true)][string]$Path, [int]$MaxBytes = 10485760, [int]$Keep = 14)
$directory = Split-Path -Parent $Path
New-Item -ItemType Directory -Force -Path $directory | Out-Null
process {
  $line = $_ | Out-String
  Write-Host $line -NoNewline
  if ((Test-Path $Path) -and (Get-Item $Path).Length -ge $MaxBytes) {
    for ($i = $Keep - 1; $i -ge 1; $i--) { $old = "$Path.$i"; if (Test-Path $old) { Move-Item $old "$Path.$($i + 1)" -Force } }
    Move-Item $Path "$Path.1" -Force
  }
  Add-Content -LiteralPath $Path -Value $line
}
