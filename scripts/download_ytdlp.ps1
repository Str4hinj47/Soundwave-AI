# PowerShell script to download standalone yt-dlp.exe for Windows
$ErrorActionPreference = "SilentlyContinue"

$vendorDir = Join-Path $PSScriptRoot "..\vendor\yt-dlp"
if (-not (Test-Path $vendorDir)) {
    New-Item -ItemType Directory -Path $vendorDir -Force | Out-Null
}

$targetExe = Join-Path $vendorDir "yt-dlp.exe"
if (-not (Test-Path $targetExe) -or (Get-Item $targetExe).Length -lt 1000000) {
    Write-Host "[INFO] Downloading standalone yt-dlp.exe for Windows..."
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    try {
        Invoke-WebRequest -Uri "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe" -OutFile $targetExe -UseBasicParsing
        if ((Test-Path $targetExe) -and (Get-Item $targetExe).Length -gt 1000000) {
            Write-Host "[INFO] Successfully installed yt-dlp.exe in vendor\yt-dlp\yt-dlp.exe"
        }
    } catch {
        Write-Host "[WARNING] Could not auto-download yt-dlp.exe: $_"
    }
}
