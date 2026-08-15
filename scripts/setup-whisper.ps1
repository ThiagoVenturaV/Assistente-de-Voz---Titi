[CmdletBinding()]
param(
    [switch]$Force
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$runtimeRoot = Join-Path $projectRoot 'runtime\whisper'
$binRoot = Join-Path $runtimeRoot 'bin'
$modelRoot = Join-Path $runtimeRoot 'models'
$executablePath = Join-Path $binRoot 'Release\whisper-cli.exe'
$modelPath = Join-Path $modelRoot 'ggml-small.bin'
$temporaryRoot = Join-Path ([IO.Path]::GetTempPath()) 'titi-whisper-setup'
$archivePath = Join-Path $temporaryRoot 'whisper-bin-x64.zip'

$archiveUrl = 'https://github.com/ggml-org/whisper.cpp/releases/download/v1.9.2/whisper-bin-x64.zip'
$archiveSha256 = '49dcc16de826f20bd53d44f947a1ae49dfa81f86cad67a64d80820cb192d674a'
$modelUrl = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin'
$modelSha1 = '55356645c2b361a969dfd0ef2c5a50d530afd8d5'

New-Item -ItemType Directory -Force -Path $temporaryRoot, $modelRoot | Out-Null

if ($Force -or -not (Test-Path -LiteralPath $executablePath)) {
    Write-Host 'Baixando whisper.cpp v1.9.2...'
    Invoke-WebRequest -UseBasicParsing -Uri $archiveUrl -OutFile $archivePath
    Assert-Hash -Path $archivePath -Algorithm SHA256 -Expected $archiveSha256
    Assert-SafeArchive -Path $archivePath

    if (Test-Path -LiteralPath $binRoot) {
        $resolvedBin = (Resolve-Path -LiteralPath $binRoot).Path
        if (-not $resolvedBin.StartsWith($projectRoot + [IO.Path]::DirectorySeparatorChar)) {
            throw 'O diretório de destino está fora do projeto.'
        }
        Remove-Item -LiteralPath $resolvedBin -Recurse -Force
    }
    New-Item -ItemType Directory -Force -Path $binRoot | Out-Null
    Expand-Archive -LiteralPath $archivePath -DestinationPath $binRoot -Force
}

if ($Force -or -not (Test-Path -LiteralPath $modelPath)) {
    Write-Host 'Baixando Whisper Small multilíngue...'
    Invoke-WebRequest -UseBasicParsing -Uri $modelUrl -OutFile $modelPath
}
Assert-Hash -Path $modelPath -Algorithm SHA1 -Expected $modelSha1

Write-Host 'Runtime local de voz pronto.' -ForegroundColor Green

function Assert-Hash {
    param(
        [Parameter(Mandatory)] [string]$Path,
        [Parameter(Mandatory)] [string]$Algorithm,
        [Parameter(Mandatory)] [string]$Expected
    )
    $actual = (Get-FileHash -LiteralPath $Path -Algorithm $Algorithm).Hash.ToLowerInvariant()
    if ($actual -ne $Expected.ToLowerInvariant()) {
        throw "Hash inválido para $Path. Esperado $Expected; encontrado $actual."
    }
}

function Assert-SafeArchive {
    param([Parameter(Mandatory)] [string]$Path)
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $archive = [IO.Compression.ZipFile]::OpenRead($Path)
    try {
        foreach ($entry in $archive.Entries) {
            if ($entry.FullName -match '(^[\\/]|\.\.[\\/])') {
                throw "Entrada insegura no arquivo: $($entry.FullName)"
            }
        }
    }
    finally {
        $archive.Dispose()
    }
}
