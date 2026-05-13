[CmdletBinding()]
param(
    # Keep empty by default; resolve after param binding for reliability with -File.
    [string]$WorkDir = "",
    [string]$SetupScriptName = "setup-usb.ps1",
    [string]$UserDataName = "user-data",
    [string]$MetaDataName = "meta-data",
    [string]$OutputIsoName = "ubuntu-24.04-autoinstall.iso",
    [string]$TargetDrive = "X:",
    [switch]$PreferOscdimg
)

$ErrorActionPreference = "Stop"

if (-not $WorkDir) {
    $WorkDir = Split-Path -Parent $MyInvocation.MyCommand.Path
}

function Write-Step {
    param([string]$Message)
    Write-Host ("[{0}] {1}" -f (Get-Date -Format "HH:mm:ss"), $Message) -ForegroundColor Cyan
}

function Assert-File {
    param([string]$PathToCheck, [string]$Name)
    if (-not (Test-Path -LiteralPath $PathToCheck)) {
        throw "$Name not found: $PathToCheck"
    }
}

function Get-OscdimgPath {
    $cmd = Get-Command oscdimg.exe -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }

    $candidates = @(
        "${env:ProgramFiles(x86)}\Windows Kits\10\Assessment and Deployment Kit\Deployment Tools\amd64\Oscdimg\oscdimg.exe",
        "${env:ProgramFiles(x86)}\Windows Kits\11\Assessment and Deployment Kit\Deployment Tools\amd64\Oscdimg\oscdimg.exe"
    )
    foreach ($c in $candidates) {
        if (Test-Path -LiteralPath $c) { return $c }
    }
    return $null
}

# wsl.exe exists even when the optional WSL feature is not installed (stub).
function Test-WslFunctional {
    if (-not (Get-Command wsl.exe -ErrorAction SilentlyContinue)) { return $false }
    $out = Join-Path $env:TEMP "wsl-installed-check.out"
    $err = Join-Path $env:TEMP "wsl-installed-check.err"
    Remove-Item -LiteralPath $out, $err -Force -ErrorAction SilentlyContinue
    $p = Start-Process -FilePath "wsl.exe" -ArgumentList @("-l", "-q") -Wait -PassThru -WindowStyle Hidden `
        -RedirectStandardOutput $out -RedirectStandardError $err
    return ($p.ExitCode -eq 0)
}

function Test-WslXorriso {
    if (-not (Test-WslFunctional)) { return $false }
    & wsl.exe -e sh -lc "command -v xorriso >/dev/null 2>&1"
    return ($LASTEXITCODE -eq 0)
}

function To-WslPath {
    param([string]$WindowsPath)
    $p = & wsl.exe -e wslpath -a "$WindowsPath"
    if ($LASTEXITCODE -ne 0) {
        throw "Unable to convert path to WSL format: $WindowsPath"
    }
    return $p.Trim()
}

function Patch-GrubFile {
    param([string]$Path)

    if (-not (Test-Path -LiteralPath $Path)) {
        Write-Step "GRUB file missing, skipping: $Path"
        return
    }

    Write-Step "Patching GRUB kernel args in: $Path"
    $lines = Get-Content -LiteralPath $Path
    $changed = $false

    for ($i = 0; $i -lt $lines.Count; $i++) {
        $line = $lines[$i]
        if ($line -match '^\s*linux\s+' -and $line -notmatch '\bautoinstall\b') {
            if ($line -match '\s---(\s*)$') {
                $lines[$i] = $line -replace '\s---(\s*)$', ' autoinstall ds=nocloud ---$1'
            } else {
                $lines[$i] = "$line autoinstall ds=nocloud"
            }
            $changed = $true
        }
    }

    if ($changed) {
        Set-Content -LiteralPath $Path -Value $lines -Encoding ascii
        Write-Step "Injected autoinstall args into linux lines."
    } else {
        Write-Step "No GRUB changes needed."
    }
}

Write-Step "Using working directory: $WorkDir"
if (-not (Test-Path -LiteralPath $WorkDir)) {
    throw "WorkDir does not exist: $WorkDir"
}

$setupScript = Join-Path $WorkDir $SetupScriptName
$userData = Join-Path $WorkDir $UserDataName
$metaData = Join-Path $WorkDir $MetaDataName
$outputIso = Join-Path $WorkDir $OutputIsoName
$rufusExe = Join-Path $WorkDir "rufus.exe"

Assert-File -PathToCheck $setupScript -Name $SetupScriptName
Assert-File -PathToCheck $userData -Name $UserDataName
Assert-File -PathToCheck $metaData -Name $MetaDataName

Write-Step "Running prerequisite downloader script: $SetupScriptName"
& $setupScript -WorkDir $WorkDir

Assert-File -PathToCheck $rufusExe -Name "rufus.exe"

$sourceIso = Get-ChildItem -LiteralPath $WorkDir -Filter "ubuntu-24.04*.iso" -File |
    Where-Object { $_.Name -ne $OutputIsoName } |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
if (-not $sourceIso) {
    throw "Could not find source Ubuntu ISO in $WorkDir after setup-usb.ps1."
}

Write-Step "Source ISO detected: $($sourceIso.FullName)"

$tempRoot = Join-Path $env:TEMP ("ubuntu-autoinstall-" + [guid]::NewGuid().ToString("N"))
$mount = $null

try {
    Write-Step "Creating temp extraction folder: $tempRoot"
    New-Item -ItemType Directory -Path $tempRoot -Force | Out-Null

    Write-Step "Mounting source ISO via Mount-DiskImage"
    $mount = Mount-DiskImage -ImagePath $sourceIso.FullName -PassThru
    Start-Sleep -Seconds 1
    $vol = $mount | Get-Volume
    if (-not $vol.DriveLetter) { throw "Could not resolve mounted ISO drive letter." }
    $mountedDrive = "$($vol.DriveLetter):\"
    Write-Step "Mounted at $mountedDrive"

    Write-Step "Copying ISO contents to temp folder"
    robocopy $mountedDrive $tempRoot /E /NFL /NDL /NJH /NJS /NP | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "robocopy failed with exit code $LASTEXITCODE" }

    Write-Step "Clearing read-only flags copied from the ISO (needed to patch GRUB)"
    Get-ChildItem -LiteralPath $tempRoot -Recurse -Force -File -ErrorAction SilentlyContinue | ForEach-Object {
        if ($_.IsReadOnly) { $_.IsReadOnly = $false }
    }

    Write-Step "Injecting cloud-init files into ISO root"
    Copy-Item -LiteralPath $userData -Destination (Join-Path $tempRoot "user-data") -Force
    Copy-Item -LiteralPath $metaData -Destination (Join-Path $tempRoot "meta-data") -Force

    Patch-GrubFile -Path (Join-Path $tempRoot "boot\grub\grub.cfg")
    Patch-GrubFile -Path (Join-Path $tempRoot "EFI\boot\grub.cfg")

    if (Test-Path -LiteralPath $outputIso) {
        Write-Step "Removing prior output ISO: $outputIso"
        Remove-Item -LiteralPath $outputIso -Force
    }

    $wslXorriso = (-not $PreferOscdimg) -and (Test-WslXorriso)
    $oscdimg = Get-OscdimgPath

    if ($wslXorriso) {
        Write-Step "WSL + xorriso detected. Using xorriso (recommended for Linux ISOs)."
        $wSrc = To-WslPath $tempRoot
        $wOut = To-WslPath $outputIso

        $cmd = @"
xorriso -as mkisofs -r -V 'UBUNTU_24_04_AUTOINSTALL' -o '$wOut' -J -joliet-long -l `
  -b boot/grub/i386-pc/eltorito.img -c boot.catalog `
  -no-emul-boot -boot-load-size 4 -boot-info-table `
  -eltorito-alt-boot -e EFI/boot/bootx64.efi -no-emul-boot `
  '$wSrc'
"@

        & wsl.exe -e sh -lc $cmd
        if ($LASTEXITCODE -ne 0) { throw "xorriso failed with exit code $LASTEXITCODE" }
    }
    elseif ($oscdimg) {
        if ((Test-WslFunctional) -and -not $PreferOscdimg) {
            Write-Step "WSL is installed but xorriso was not found; using oscdimg instead."
            Write-Step "Tip: sudo apt-get update && sudo apt-get install -y xorriso  (then re-run for xorriso path)"
        } else {
            Write-Step "Using oscdimg from Windows ADK."
        }
        $biosImg = Join-Path $tempRoot "boot\grub\i386-pc\eltorito.img"
        $efiImg = Join-Path $tempRoot "EFI\boot\bootx64.efi"
        Assert-File -PathToCheck $biosImg -Name "BIOS boot image"
        Assert-File -PathToCheck $efiImg -Name "EFI boot image"

        & $oscdimg -m -o -u2 -udfver102 "-bootdata:2#p0,e,b$biosImg#pEF,e,b$efiImg" $tempRoot $outputIso
        if ($LASTEXITCODE -ne 0) { throw "oscdimg failed with exit code $LASTEXITCODE" }
    }
    else {
        throw @"
No ISO repack tool found. Do one of the following, then re-run inject-iso.ps1:
  1) Install WSL + xorriso:  wsl --install   then in Ubuntu:  sudo apt-get update && sudo apt-get install -y xorriso
  2) Install Windows ADK (Deployment Tools) so oscdimg.exe is available, or add it to PATH.
"@
    }

    Assert-File -PathToCheck $outputIso -Name "Output ISO"
    Write-Step "Created autoinstall ISO: $outputIso"

    Write-Step "Launching Rufus CLI with preselected ISO and formatting flags"
    $rufusArgs = @(
        "--iso", $outputIso,
        "--drive", $TargetDrive,
        "--format", "GPT",
        "--fstype", "FAT32"
    )
    Start-Process -FilePath $rufusExe -ArgumentList $rufusArgs
    Write-Step "Rufus launched."
}
finally {
    if ($mount) {
        Write-Step "Dismounting source ISO"
        Dismount-DiskImage -ImagePath $sourceIso.FullName -ErrorAction SilentlyContinue
    }
    if (Test-Path -LiteralPath $tempRoot) {
        Write-Step "Cleaning temp folder"
        Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}

Write-Step "Completed successfully."
