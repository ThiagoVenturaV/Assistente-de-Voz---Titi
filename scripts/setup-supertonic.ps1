[CmdletBinding()]
param(
    [switch]$Force
)

$ErrorActionPreference = 'Stop'
$setupScript = Join-Path $PSScriptRoot 'setup-whisper.ps1'
if ($Force) {
    & $setupScript -Force
}
else {
    & $setupScript
}
