[CmdletBinding()]
param(
    # Default empty: $PSScriptRoot is not reliable in param defaults when launched via powershell -File.
    [string]$WorkDir = "",
    [string]$IsoUrl = "https://releases.ubuntu.com/24.04.2/ubuntu-24.04.2-live-server-amd64.iso",
    [string]$IsoName = "ubuntu-24.04.2-live-server-amd64.iso",
    # Leave empty to resolve latest portable build (rufus-*p.exe) from GitHub API.
    [string]$RufusUrl = "",
    [switch]$Force
)

$ErrorActionPreference = "Stop"

if (-not $WorkDir) {
    $WorkDir = Split-Path -Parent $MyInvocation.MyCommand.Path
}

function Write-Step {
    param([string]$Message)
    Write-Host ("[{0}] {1}" -f (Get-Date -Format "HH:mm:ss"), $Message) -ForegroundColor Cyan
}

function Get-RufusPortableDownloadUrl {
    $headers = @{
        Accept     = "application/vnd.github+json"
        "User-Agent" = "postforge-setup-usb"
    }
    $rel = Invoke-RestMethod -Uri "https://api.github.com/repos/pbatard/rufus/releases/latest" -Headers $headers
    $portable = $rel.assets | Where-Object { $_.name -match '^rufus-[0-9.]+p\.exe$' } | Select-Object -First 1
    if (-not $portable) {
        throw "Could not find portable Rufus asset (rufus-*p.exe) in latest GitHub release."
    }
    return $portable.browser_download_url
}

function Download-File {
    param(
        [string]$Url,
        [string]$OutFile,
        [switch]$ForceDownload
    )

    if ((Test-Path -LiteralPath $OutFile) -and -not $ForceDownload) {
        Write-Step "Exists, skipping download: $OutFile"
        return
    }

    Write-Step "Downloading: $Url"
    if (Get-Command curl.exe -ErrorAction SilentlyContinue) {
        & curl.exe -fL --retry 8 --retry-delay 10 --connect-timeout 60 -o $OutFile $Url
        if ($LASTEXITCODE -ne 0) {
            throw "curl failed downloading $Url"
        }
    } else {
        Invoke-WebRequest -Uri $Url -OutFile $OutFile -UseBasicParsing -TimeoutSec 86400
    }
    Write-Step "Saved: $OutFile"
}

Write-Step "Using folder: $WorkDir"
if (-not (Test-Path -LiteralPath $WorkDir)) {
    New-Item -ItemType Directory -Path $WorkDir -Force | Out-Null
}

$isoPath = Join-Path $WorkDir $IsoName
$rufusPath = Join-Path $WorkDir "rufus.exe"

Download-File -Url $IsoUrl -OutFile $isoPath -ForceDownload:$Force

if (-not $RufusUrl) {
    Write-Step "Resolving latest portable Rufus download URL from GitHub..."
    $RufusUrl = Get-RufusPortableDownloadUrl
    Write-Step "Rufus URL: $RufusUrl"
}
Download-File -Url $RufusUrl -OutFile $rufusPath -ForceDownload:$Force

if (-not (Test-Path -LiteralPath $isoPath)) { throw "ISO download missing: $isoPath" }
if (-not (Test-Path -LiteralPath $rufusPath)) { throw "Rufus download missing: $rufusPath" }

$isoSizeGB = [math]::Round((Get-Item -LiteralPath $isoPath).Length / 1GB, 2)
Write-Step "ISO ready ($isoSizeGB GiB): $isoPath"
Write-Step "Rufus ready: $rufusPath"
Write-Step "setup-usb.ps1 completed."
