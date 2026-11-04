# PowerShell script to package Tizen .wgt file
$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$wgtPath = Join-Path $scriptDir "VarahovbaCinema.wgt"
$zipPath = Join-Path $scriptDir "temp_package.zip"

if (Test-Path $wgtPath) {
    Remove-Item $wgtPath -Force
}
if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
}

Write-Host "📦 Packaging Tizen application into VarahovbaCinema.wgt..." -ForegroundColor Cyan

# Files to include in the root of the .wgt
$filesToArchive = @(
    (Join-Path $scriptDir "config.xml"),
    (Join-Path $scriptDir "icon.png"),
    (Join-Path $scriptDir "index.html")
)

Compress-Archive -Path $filesToArchive -DestinationPath $zipPath -CompressionLevel Optimal
Rename-Item -Path $zipPath -NewName "VarahovbaCinema.wgt"

Write-Host "✅ VarahovbaCinema.wgt created successfully!" -ForegroundColor Green
Write-Host "Location: $wgtPath" -ForegroundColor Yellow
