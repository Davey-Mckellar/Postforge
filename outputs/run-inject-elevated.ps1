#Requires -RunAsAdministrator
$ErrorActionPreference = "Stop"
$outputs = $PSScriptRoot
$inject = Join-Path $outputs "inject-iso.ps1"
$log = Join-Path $outputs "inject-elevated.log"
Start-Transcript -Path $log -Force | Out-Null

function Write-Step([string]$m) {
    Write-Host ("[{0}] {1}" -f (Get-Date -Format "HH:mm:ss"), $m) -ForegroundColor Cyan
}

Write-Step "Disk 1 (USB) — ensure a drive letter for Rufus"
$disk = Get-Disk -Number 1 -ErrorAction Stop
if ($disk.IsSystem) { throw "Refusing to modify system disk." }

$parts = @(Get-Partition -DiskNumber 1 -ErrorAction SilentlyContinue)
$withLetter = $parts | Where-Object { $_.DriveLetter -and [int]$_.DriveLetter -ne 0 }

if ($withLetter) {
    $letterPart = $withLetter | Select-Object -First 1
    Write-Step "Existing drive letter: $($letterPart.DriveLetter):"
} else {
    if ($parts.Count -eq 0) {
        Write-Step "No partitions — creating full-disk partition with assigned letter"
        $null = New-Partition -DiskNumber 1 -UseMaximumSize -AssignDriveLetter
    } else {
        Write-Step "Partition(s) without letter — assigning letter to partition 1"
        Set-Partition -DiskNumber 1 -PartitionNumber $parts[0].PartitionNumber -AssignDriveLetter
    }
    Start-Sleep -Seconds 2
    $letterPart = Get-Partition -DiskNumber 1 -ErrorAction Stop |
        Where-Object { $_.DriveLetter -and [int]$_.DriveLetter -ne 0 } |
        Select-Object -First 1
}

if (-not $letterPart) {
    throw "Could not obtain a drive letter for Disk 1."
}

$target = "$($letterPart.DriveLetter):"
Write-Step "Target for Rufus: $target"

if (-not (Test-Path -LiteralPath $inject)) {
    throw "inject-iso.ps1 not found: $inject"
}

try {
    & $inject -WorkDir $outputs -TargetDrive $target
} finally {
    Stop-Transcript
}
