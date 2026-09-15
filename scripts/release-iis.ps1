[CmdletBinding()]
param(
    [ValidateSet("DjangoApp")]
    [string]$AppPoolName = "DjangoApp",

    [ValidateSet("DjangoApp")]
    [string]$SiteName = "DjangoApp",

    [string]$ExpectedPhysicalPath = "C:\inetpub\wwwroot\sitefolder\myproject",

    [ValidateSet("release/static-cache-strategy-v1-20260915")]
    [string]$ExpectedBranch = "release/static-cache-strategy-v1-20260915",

    [string]$Python = "python"
)

$ErrorActionPreference = "Stop"
$projectRoot = [System.IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot)).TrimEnd('\')
$expectedRoot = [System.IO.Path]::GetFullPath($ExpectedPhysicalPath).TrimEnd('\')
Set-Location -LiteralPath $projectRoot

function Invoke-Checked {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Command,
        [Parameter(ValueFromRemainingArguments = $true)]
        [string[]]$Arguments
    )

    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$Command failed with exit code $LASTEXITCODE"
    }
}

if ($projectRoot -ne $expectedRoot) {
    throw "Release checkout mismatch. Expected=$expectedRoot Actual=$projectRoot"
}

if ((git status --porcelain --untracked-files=all)) {
    throw "Release requires a clean Git worktree. Review and commit first."
}

$releaseSha = (git rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0) {
    throw "Unable to record the release Git SHA."
}
$releaseBranch = (git branch --show-current).Trim()
if ($LASTEXITCODE -ne 0 -or $releaseBranch -ne $ExpectedBranch) {
    throw "Release branch mismatch. Expected=$ExpectedBranch Actual=$releaseBranch"
}

Invoke-Checked $Python "manage.py" "check" "--deploy"
Invoke-Checked $Python "manage.py" "shell" "-c" `
    "from django.conf import settings; assert not settings.DEBUG, 'DJANGO_DEBUG must be false'; assert not settings.SASS_PROCESSOR_ENABLED, 'runtime Sass must be disabled'; assert settings.STATICFILES_STORAGE == 'myproject.staticfiles.StaticFilesStorage', 'fingerprinted storage is not active'"

Import-Module WebAdministration
$site = Get-Website -Name $SiteName
if (-not $site) {
    throw "IIS site does not exist: $SiteName"
}
$sitePath = [System.IO.Path]::GetFullPath([Environment]::ExpandEnvironmentVariables($site.PhysicalPath)).TrimEnd('\')
if ($sitePath -ne $expectedRoot) {
    throw "IIS site path mismatch. Expected=$expectedRoot Actual=$sitePath"
}
if ($site.ApplicationPool -ne $AppPoolName) {
    throw "IIS site/app-pool mismatch. Site=$SiteName ExpectedPool=$AppPoolName ActualPool=$($site.ApplicationPool)"
}
if (-not (Get-WebAppPoolState -Name $AppPoolName -ErrorAction Stop)) {
    throw "IIS application pool does not exist: $AppPoolName"
}
$staticRoot = Join-Path $projectRoot "staticfiles"
$backupRoot = Join-Path (Split-Path -Parent $projectRoot) "myproject-release-backups"
$releaseStamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupPath = Join-Path $backupRoot "staticfiles-$releaseStamp-$releaseSha"
New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
if (Test-Path -LiteralPath $staticRoot) {
    Copy-Item -LiteralPath $staticRoot -Destination $backupPath -Recurse
}
$rollbackRecord = [ordered]@{
    release_sha = $releaseSha
    previous_sha = "4c386c40c92849ff8b96354205e2ebf939144079"
    static_backup = if (Test-Path -LiteralPath $backupPath) { $backupPath } else { $null }
    created_at = (Get-Date).ToString("o")
    site = $SiteName
    app_pool = $AppPoolName
}
$rollbackRecord | ConvertTo-Json | Set-Content `
    -LiteralPath (Join-Path $backupRoot "latest-static-cache-release.json") `
    -Encoding UTF8

Stop-WebAppPool -Name $AppPoolName

try {
    Invoke-Checked $Python "manage.py" "collectstatic" "--clear" "--noinput" `
        "--ignore" "tests" "--ignore" "test.js" `
        "--ignore" "*.scss" "--ignore" "*.map"
    Invoke-Checked $Python "scripts/verify_static_manifest.py" "staticfiles"
    Invoke-Checked $Python "scripts/build_iis_static_config.py" `
        "staticfiles" "deploy/iis-static.web.config"
}
catch {
    Write-Error "Release failed; the IIS application pool remains stopped. $($_.Exception.Message)"
    throw
}

Start-WebAppPool -Name $AppPoolName

$state = (Get-WebAppPoolState -Name $AppPoolName).Value
if ($state -ne "Started") {
    throw "IIS application pool did not start: $state"
}

Write-Host "Release complete. SHA=$releaseSha Site=$SiteName AppPool=$AppPoolName State=$state RollbackRecord=$(Join-Path $backupRoot 'latest-static-cache-release.json')"
