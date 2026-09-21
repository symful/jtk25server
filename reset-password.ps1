<#
.SYNOPSIS
    Rotates ALL admin passwords (global + per-class) on Cloudflare wrangler secrets
    and local env files (.dev.vars, .env) with crypto-random generated passwords.

.DESCRIPTION
    Parses worker-configuration.d.ts to discover ADMIN_PASS_* secret names, generates
    crypto-safe random passwords, writes them to local env files, and optionally pushes
    them to Cloudflare via `wrangler secret bulk`.

    IMPORTANT — CRITICAL CAVEAT:
    =============================
    src/admin.ts authenticate() compares PLAINTEXT (env.ADMIN_PASS_X === bearer).
    Secrets MUST hold plaintext passwords. The SHA-256 values in the manifest file
    are fingerprints ONLY — not a security boundary. True hash-at-rest would require
    changing the auth code in admin.ts (out of scope; noted as future option).

.PARAMETER Length
    Password length in characters. Default: 16. Min: 8. Max: 64.

.PARAMETER SkipWrangler
    Skip the remote wrangler secret bulk call entirely.

.PARAMETER PrintOnly
    Dry-run mode: generate passwords, write locals, print table, but NO wrangler call.

.PARAMETER Force
    Skip the confirmation prompt before the wrangler bulk call.

.EXAMPLE
    .\reset-password.ps1 -PrintOnly -SkipWrangler -Force
    # Dry run: generates passwords, writes .dev.vars, prints table, no remote changes.

.EXAMPLE
    .\reset-password.ps1 -Force
    # Full rotation: generates + writes locals + pushes to Cloudflare.
#>
[CmdletBinding()]
param(
    [ValidateRange(8, 64)]
    [int]$Length = 16,

    [switch]$SkipWrangler,

    [switch]$PrintOnly,

    [switch]$Force
)

$ErrorActionPreference = "Stop"

# ─── Resolve paths relative to this script ───────────────────────────────────
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$TypeFile  = Join-Path $ScriptDir "worker-configuration.d.ts"
$DevVarsFile = Join-Path $ScriptDir ".dev.vars"
$EnvFile     = Join-Path $ScriptDir ".env"
$GitignoreFile = Join-Path $ScriptDir ".gitignore"

# ─── Parse ADMIN_PASS_* names from worker-configuration.d.ts ──────────────────
if (-not (Test-Path -LiteralPath $TypeFile)) {
    throw "worker-configuration.d.ts not found at $TypeFile"
}

$TypeContent = Get-Content -LiteralPath $TypeFile -Raw
$Matches_ = [regex]::Matches($TypeContent, '(ADMIN_PASS_[A-Z0-9_]+)')
$SecretNames = @()
foreach ($m in $Matches_.Captures) {
    $name = $m.Value
    if ($SecretNames -notcontains $name) {
        $SecretNames += $name
    }
}

if ($SecretNames.Count -eq 0) {
    throw "No ADMIN_PASS_* entries found in worker-configuration.d.ts"
}

Write-Host "Discovered $($SecretNames.Count) secrets from worker-configuration.d.ts:" -ForegroundColor Cyan
foreach ($s in $SecretNames) { Write-Host "  - $s" -ForegroundColor Gray }

# ─── Crypto-safe password generator with rejection sampling ───────────────────
# Charset: alphanumeric minus ambiguous chars (no O, 0, I, l, 1)
$CharSet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"
$CharSetLen = $CharSet.Length

function New-CryptoPassword {
    param([int]$PwdLength)

    # Rejection sampling to avoid modulo bias.
    # Max valid index = $CharSetLen * [Math]::Floor(256 / $CharSetLen) - 1
    # We reject bytes > that threshold.
    $maxValidIndex = $CharSetLen * [Math]::Floor(256 / $CharSetLen) - 1

    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $bytes = New-Object byte[] 1
    $result = New-Object System.Text.StringBuilder($PwdLength)

    while ($result.Length -lt $PwdLength) {
        $rng.GetBytes($bytes)
        $b = $bytes[0]
        if ($b -le $maxValidIndex) {
            [void]$result.Append($CharSet[$b % $CharSetLen])
        }
    }
    $rng.Dispose()
    return $result.ToString()
}

function Get-PasswordFingerprint {
    param([string]$PlainPassword)
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($PlainPassword)
    $sha = [System.Security.Cryptography.SHA256]::Create()
    $hash = $sha.ComputeHash($bytes)
    $sha.Dispose()
    return ($hash | ForEach-Object { $_.ToString("x2") }) -join ""
}

function Mask-Password {
    param([string]$PlainPassword)
    if ($PlainPassword.Length -le 6) {
        return $PlainPassword.Substring(0, [Math]::Max(1, $PlainPassword.Length - 2)) + "..."
    }
    return $PlainPassword.Substring(0, 4) + "..." + $PlainPassword.Substring($PlainPassword.Length - 2)
}

# ─── Generate all passwords ──────────────────────────────────────────────────
Write-Host "`nGenerating $Length-char crypto-safe passwords..." -ForegroundColor Cyan

$Generated = @()  # array of PSCustomObjects
foreach ($name in $SecretNames) {
    $pwd = New-CryptoPassword -PwdLength $Length
    $fp  = Get-PasswordFingerprint -PlainPassword $pwd
    $Generated += [PSCustomObject]@{
        Name      = $name
        Password  = $pwd
        Fingerprint = $fp
    }
}

# ─── Print table (masked) ────────────────────────────────────────────────────
Write-Host "`nGenerated passwords:" -ForegroundColor Green
Write-Host ("-" * 72)
Write-Host ("{0,-28} {1,-22} {2}" -f "SECRET NAME", "MASKED", "SHA-256 FINGERPRINT")
Write-Host ("-" * 72)
foreach ($entry in $Generated) {
    $masked = Mask-Password -PlainPassword $entry.Password
    Write-Host ("{0,-28} {1,-22} {2}" -f $entry.Name, $masked, $entry.Fingerprint)
}
Write-Host ("-" * 72)

# ─── Write local env files (idempotent: replace in-place, preserve ordering) ─
function Update-EnvFile {
    param(
        [string]$FilePath,
        [hashtable]$Updates
    )

    $lines = @()
    if (Test-Path -LiteralPath $FilePath) {
        $lines = Get-Content -LiteralPath $FilePath
    }

    $existingKeys = @{}
    foreach ($line in $lines) {
        if ($line -match '^(ADMIN_PASS_[A-Z0-9_]+)=') {
            $existingKeys[$Matches[1]] = $true
        }
    }

    $result = @()
    $updatedKeys = @{}

    foreach ($line in $lines) {
        if ($line -match '^(ADMIN_PASS_[A-Z0-9_]+)=') {
            $key = $Matches[1]
            if ($Updates.ContainsKey($key)) {
                $result += "$key=$($Updates[$key])"
                $updatedKeys[$key] = $true
            } else {
                $result += $line
            }
        } else {
            $result += $line
        }
    }

    foreach ($key in $Updates.Keys) {
        if (-not $updatedKeys.ContainsKey($key)) {
            $result += "$key=$($Updates[$key])"
        }
    }

    $result | Set-Content -LiteralPath $FilePath -Encoding UTF8
}

# Build hashtable for updates
$UpdateMap = @{}
foreach ($entry in $Generated) {
    $UpdateMap[$entry.Name] = $entry.Password
}

# Update .dev.vars
Update-EnvFile -FilePath $DevVarsFile -Updates $UpdateMap
Write-Host "`nUpdated: $DevVarsFile" -ForegroundColor Green

# Update .env (create if missing)
Update-EnvFile -FilePath $EnvFile -Updates $UpdateMap
Write-Host "Updated: $EnvFile" -ForegroundColor Green

# ─── Manifest file ───────────────────────────────────────────────────────────
$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$ManifestName = "admin-passwords-$Timestamp.txt"
$ManifestPath = Join-Path $ScriptDir $ManifestName

$ManifestLines = @()
$ManifestLines += "=" * 72
$ManifestLines += "ADMIN PASSWORD MANIFEST"
$ManifestLines += "Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
$ManifestLines += "Host: $env:COMPUTERNAME"
$ManifestLines += "Password length: $Length"
$ManifestLines += "=" * 72
$ManifestLines += ""
$ManifestLines += ("{0,-28} {1,-22} {2}" -f "SECRET NAME", "PASSWORD", "SHA-256 FINGERPRINT")
$ManifestLines += "-" * 72

foreach ($entry in $Generated) {
    $ManifestLines += ("{0,-28} {1,-22} {2}" -f $entry.Name, $entry.Password, $entry.Fingerprint)
}

$ManifestLines += "-" * 72
$ManifestLines += ""
$ManifestLines += "CRITICAL CAVEAT: src/admin.ts authenticate() compares PLAINTEXT"
$ManifestLines += "(env.ADMIN_PASS_X === bearer). These secrets MUST hold plaintext."
$ManifestLines += "The SHA-256 values above are fingerprints only, not a security boundary."
$ManifestLines += "True hash-at-rest requires changing the auth code in admin.ts (future option)."
$ManifestLines += ""
$ManifestLines += "DO NOT commit this file to version control."

$ManifestLines | Set-Content -LiteralPath $ManifestPath -Encoding UTF8
Write-Host "`nManifest written: $ManifestPath" -ForegroundColor Green

# ─── Append to .gitignore if needed ──────────────────────────────────────────
$gitignorePattern = "admin-passwords-*.txt"
$needsGitignore = $true
if (Test-Path -LiteralPath $GitignoreFile) {
    $giContent = Get-Content -LiteralPath $GitignoreFile
    foreach ($line in $giContent) {
        if ($line.Trim() -eq $gitignorePattern) {
            $needsGitignore = $false
            break
        }
    }
}

if ($needsGitignore) {
    Add-Content -LiteralPath $GitignoreFile -Value "`n$gitignorePattern"
    Write-Host "Appended '$gitignorePattern' to .gitignore" -ForegroundColor Yellow
}

# ─── Wrangler secret bulk ────────────────────────────────────────────────────
if ($PrintOnly) {
    Write-Host "`n[DRY RUN] Skipping wrangler secret bulk (PrintOnly mode)." -ForegroundColor Yellow
} elseif ($SkipWrangler) {
    Write-Host "`nSkipping wrangler secret bulk (-SkipWrangler)." -ForegroundColor Yellow
} else {
    # Confirm unless -Force
    if (-not $Force) {
        $confirm = Read-Host "`nAbout to push $($Generated.Count) secrets to Cloudflare via wrangler secret bulk. Continue? (y/N)"
        if ($confirm -ne "y" -and $confirm -ne "Y") {
            Write-Host "Aborted." -ForegroundColor Red
            exit 1
        }
    }

    # Build temp JSON
    $tempJson = Join-Path ([System.IO.Path]::GetTempPath()) "wrangler-secrets-$Timestamp.json"
    $secretObj = @{}
    foreach ($entry in $Generated) {
        $secretObj[$entry.Name] = $entry.Password
    }
    $secretObj | ConvertTo-Json | Set-Content -LiteralPath $tempJson -Encoding UTF8

    Write-Host "`nPushing secrets via: wrangler secret bulk $tempJson" -ForegroundColor Cyan
    try {
        & wrangler secret bulk $tempJson
        if ($LASTEXITCODE -ne 0) {
            throw "wrangler secret bulk failed with exit code $LASTEXITCODE"
        }
        Write-Host "Secrets pushed successfully." -ForegroundColor Green
    }
    finally {
        # Always clean up temp file
        if (Test-Path -LiteralPath $tempJson) {
            Remove-Item -LiteralPath $tempJson -Force
            Write-Host "Cleaned up temp file: $tempJson" -ForegroundColor Gray
        }
    }
}

# ─── Summary ─────────────────────────────────────────────────────────────────
Write-Host "`nDone. $($Generated.Count) passwords rotated." -ForegroundColor Green
Write-Host "Manifest: $ManifestPath" -ForegroundColor Gray
Write-Host "IMPORTANT: Store the manifest securely and delete it when no longer needed." -ForegroundColor Yellow
