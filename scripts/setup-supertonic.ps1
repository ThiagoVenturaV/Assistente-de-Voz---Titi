[CmdletBinding()]
param(
    [switch]$Force
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

function Assert-Hash {
    param(
        [Parameter(Mandatory)] [string]$Path,
        [Parameter(Mandatory)] [string]$Expected
    )
    $hasher = [Security.Cryptography.SHA256]::Create()
    $stream = [IO.File]::OpenRead($Path)
    try {
        $actual = [BitConverter]::ToString($hasher.ComputeHash($stream)).Replace('-', '')
    }
    finally {
        $stream.Dispose()
        $hasher.Dispose()
    }
    if ($actual -ne $Expected.ToUpperInvariant()) {
        throw "Hash inválido para $Path. Esperado $Expected; encontrado $actual."
    }
}

$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$runtimeRoot = Join-Path $projectRoot 'runtime\supertonic'
$modelRoot = Join-Path $runtimeRoot 'model-extracted'
$modelDirectory = 'sherpa-onnx-supertonic-3-tts-int8-2026-05-11'
$modelPath = Join-Path $modelRoot $modelDirectory
$temporaryRoot = Join-Path ([IO.Path]::GetTempPath()) 'titi-supertonic-setup'
$archivePath = Join-Path $temporaryRoot "$modelDirectory.tar.bz2"
$archiveUrl = "https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/$modelDirectory.tar.bz2"
$archiveSha256 = '82FA96F91C4EF8ABAAE3A14A3F4153FACF88BED821D1F7331CEC2700F432C427'
$requiredFiles = [ordered]@{
    'duration_predictor.int8.onnx' = 'C3EB91414D5FF8A7A239B7FE9E34E7E2BF8A8140D8375FFB14718B1C639325DB'
    'text_encoder.int8.onnx' = 'C7BEFD5EA8C3119769E8A6C1486C4EDC6A3BC8365C67621C881BBB774B9902FF'
    'vector_estimator.int8.onnx' = '20CD86FA5C6EFFEDFDA0E7CFFE5B0569CA401C440A0C3A1D72BF39286C0DB3FD'
    'vocoder.int8.onnx' = 'E923D60F53F95EB1CE235F1DC33EC56D9C057823C96FA6F8ACF98F32B0DA6152'
    'tts.json' = '42078D3AEF1CD43AB43021F3C54F47D2D75CEB4E75F627F118890128B06A0D09'
    'unicode_indexer.bin' = '8402CA48E5189A8950138580B0FFF64DB6F072F24AC07CD54BA8B2FBB9883B30'
    'voice.bin' = '67D5209B0EE8CE6C74105FFBE12FE6A7628AEA3B4BA2FCB308A4A67938A93CE8'
}

function Test-VerifiedModel {
    if (-not (Test-Path -LiteralPath $modelPath -PathType Container)) { return $false }
    foreach ($entry in $requiredFiles.GetEnumerator()) {
        $path = Join-Path $modelPath $entry.Key
        if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { return $false }
        Assert-Hash -Path $path -Expected $entry.Value
    }
    return $true
}

if (-not $Force -and (Test-VerifiedModel)) {
    Write-Host 'Voz neural Supertonic 3 já está verificada.' -ForegroundColor Green
    exit 0
}

New-Item -ItemType Directory -Force -Path $temporaryRoot, $modelRoot | Out-Null
Write-Host 'Baixando o modelo neural Supertonic 3 INT8...'
Invoke-WebRequest -UseBasicParsing -Uri $archiveUrl -OutFile $archivePath
Assert-Hash -Path $archivePath -Expected $archiveSha256

$entries = & tar.exe -tf $archivePath
if ($LASTEXITCODE -ne 0) { throw 'Não foi possível inspecionar o arquivo do Supertonic.' }
foreach ($entry in $entries) {
    $normalized = $entry.Replace('\', '/')
    if (-not $normalized.StartsWith($modelDirectory + '/')) {
        throw "Entrada insegura no arquivo do Supertonic: $entry"
    }
    if (($normalized.Split('/')) -contains '..') {
        throw "Entrada insegura no arquivo do Supertonic: $entry"
    }
    if ($normalized.Contains(':')) {
        throw "Entrada insegura no arquivo do Supertonic: $entry"
    }
}

if (Test-Path -LiteralPath $modelPath) {
    $resolvedModel = (Resolve-Path -LiteralPath $modelPath).Path
    if (-not $resolvedModel.StartsWith($modelRoot + [IO.Path]::DirectorySeparatorChar)) {
        throw 'O diretório do modelo está fora do runtime esperado.'
    }
    Remove-Item -LiteralPath $resolvedModel -Recurse -Force
}

& tar.exe -xf $archivePath -C $modelRoot
if ($LASTEXITCODE -ne 0) { throw 'Não foi possível extrair o modelo Supertonic.' }
if (-not (Test-VerifiedModel)) { throw 'O modelo Supertonic extraído está incompleto.' }

Write-Host 'Voz neural local Supertonic 3 pronta.' -ForegroundColor Green
