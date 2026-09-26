# Soundwave AI - yt-dlp Standalone Downloader for Windows
$ErrorActionPreference = "SilentlyContinue"
$ProgressPreference = "SilentlyContinue"

$repoRoot = $PSScriptRoot
if ($repoRoot -match "scripts$") {
    $repoRoot = Split-Path -Parent $repoRoot
}

$vendorDir = Join-Path $repoRoot "vendor\yt-dlp"
if (-not (Test-Path $vendorDir)) {
    New-Item -ItemType Directory -Path $vendorDir -Force | Out-Null
}

$ytdlpExe = Join-Path $vendorDir "yt-dlp.exe"

if (Test-Path $ytdlpExe) {
    if ((Get-Item $ytdlpExe).Length -gt 1000000) {
        # YouTube regularly breaks older extractors ("The page needs to be
        # reloaded") — self-update the vendored copy on every launch. The
        # check is a no-op when already current; on failure the working
        # binary is kept as-is.
        Write-Host "[INFO] Checking vendored yt-dlp for updates..."
        try { & $ytdlpExe --ignore-config -U *> $null } catch { }
        if ((Test-Path $ytdlpExe) -and ((Get-Item $ytdlpExe).Length -gt 1000000)) {
            Write-Host "[INFO] yt-dlp.exe ready at vendor\yt-dlp\yt-dlp.exe"
            exit 0
        }
        # Update left a missing/truncated binary — fall through to a fresh download.
    }
}

Write-Host "[INFO] Downloading standalone yt-dlp.exe for background video downloading..."
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls13

$downloadUrls = @(
    "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe",
    "https://github.com/yt-dlp/yt-dlp-nightly-builds/releases/latest/download/yt-dlp.exe"
)

$downloaded = $false
foreach ($url in $downloadUrls) {
    try {
        Write-Host " -> Fetching: $url"
        Invoke-WebRequest -Uri $url -OutFile $ytdlpExe -UseBasicParsing -TimeoutSec 90
        if ((Test-Path $ytdlpExe) -and ((Get-Item $ytdlpExe).Length -gt 1000000)) {
            $downloaded = $true
            break
        }
    } catch {
        Write-Host " -> Download failed from $url, trying mirror..."
    }
}

if ($downloaded) {
    Write-Host "[SUCCESS] Standalone yt-dlp.exe ready at $ytdlpExe"
    exit 0
} else {
    Write-Host "[WARNING] Could not download yt-dlp.exe automatically. You can install it via: winget install yt-dlp"
    exit 1
}
