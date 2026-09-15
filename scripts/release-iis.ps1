[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$AppPoolName,

    [string]$Python = "python"
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
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

if ((git status --porcelain)) {
    throw "Release requires a clean Git worktree. Review and commit first."
}

Invoke-Checked $Python "manage.py" "check" "--deploy"
Invoke-Checked $Python "manage.py" "shell" "-c" `
    "from django.conf import settings; assert not settings.DEBUG, 'DJANGO_DEBUG must be false'"

Import-Module WebAdministration
Stop-WebAppPool -Name $AppPoolName

try {
    Invoke-Checked $Python "manage.py" "collectstatic" "--clear" "--noinput" `
        "--ignore" "tests" "--ignore" "test.js" `
        "--ignore" "*.scss" "--ignore" "*.map"
    Invoke-Checked $Python "scripts/verify_static_manifest.py" "staticfiles"
    Copy-Item -LiteralPath "deploy/iis-static.web.config" `
        -Destination "staticfiles/web.config" -Force
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

Write-Host "Release complete. AppPool=$AppPoolName State=$state"
