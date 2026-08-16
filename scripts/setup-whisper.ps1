[CmdletBinding()]
param(
    [switch]$Force
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

function Assert-Hash {
    param(
        [Parameter(Mandatory)] [string]$Path,
        [Parameter(Mandatory)] [string]$Algorithm,
        [Parameter(Mandatory)] [string]$Expected
    )
    $hasher = [Security.Cryptography.HashAlgorithm]::Create($Algorithm)
    if ($null -eq $hasher) {
        throw "Algoritmo de hash não suportado: $Algorithm."
    }
    $stream = [IO.File]::OpenRead($Path)
    try {
        $actual = [BitConverter]::ToString($hasher.ComputeHash($stream)).Replace('-', '').ToLowerInvariant()
    }
    finally {
        $stream.Dispose()
        $hasher.Dispose()
    }
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

$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$runtimeRoot = Join-Path $projectRoot 'runtime\whisper'
$binRoot = Join-Path $runtimeRoot 'bin'
$modelRoot = Join-Path $runtimeRoot 'models'
$executablePath = Join-Path $binRoot 'Release\parakeet-cli.exe'
$modelPath = Join-Path $modelRoot 'ggml-parakeet-tdt-0.6b-v3-q8_0.bin'
$temporaryRoot = Join-Path ([IO.Path]::GetTempPath()) 'titi-whisper-setup'
$archivePath = Join-Path $temporaryRoot 'whisper-bin-x64.zip'

$archiveUrl = 'https://github.com/ggml-org/whisper.cpp/releases/download/v1.9.2/whisper-bin-x64.zip'
$archiveSha256 = '49dcc16de826f20bd53d44f947a1ae49dfa81f86cad67a64d80820cb192d674a'
$modelUrl = 'https://huggingface.co/ggml-org/parakeet-GGUF/resolve/main/ggml-parakeet-tdt-0.6b-v3-q8_0.bin'
$modelSha256 = '4d64e9e96c2792186d072fde0034df0ad670cf680a2f53069052ead827fd600e'

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
    Write-Host 'Baixando Parakeet TDT 0.6B v3 Q8 multilíngue...'
    Invoke-WebRequest -UseBasicParsing -Uri $modelUrl -OutFile $modelPath
}
Assert-Hash -Path $modelPath -Algorithm SHA256 -Expected $modelSha256

Write-Host 'Runtime local de voz pronto.' -ForegroundColor Green
