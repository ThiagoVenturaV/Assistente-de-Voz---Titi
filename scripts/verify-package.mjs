import { readFile, stat } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import asar from '@electron/asar'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const archivePath = resolve(
  process.argv[2] ?? join(projectRoot, 'release', 'win-unpacked', 'resources', 'app.asar')
)

const sourcePackage = JSON.parse(
  await readFile(join(projectRoot, 'package.json'), 'utf8')
)
const packagedPackage = JSON.parse(
  asar.extractFile(archivePath, 'package.json').toString('utf8')
)
const packagedMain = asar.extractFile(
  archivePath,
  join('out', 'main', 'index.js')
).toString('utf8')
const packagedSupertonicWorker = asar.extractFile(
  archivePath,
  join('out', 'main', 'supertonic-worker.js')
).toString('utf8')
const packagedRuntimeCode = `${packagedMain}\n${packagedSupertonicWorker}`

if (packagedPackage.name !== sourcePackage.name) {
  throw new Error(
    `Pacote incorreto: esperado ${sourcePackage.name}, encontrado ${packagedPackage.name}.`
  )
}

if (packagedPackage.version !== sourcePackage.version) {
  throw new Error(
    `Versão interna incorreta: esperado ${sourcePackage.version}, encontrado ${packagedPackage.version}.`
  )
}

for (const marker of [
  'tool_calls',
  'tool_choice',
  '[SEM_FERRAMENTA]',
  'open_application',
  'computer_observe',
  'windows-ui-automation.ps1',
  'focusImageBase64',
  'app-skills.json',
  'voice:push-to-talk-requested',
  'voice:synthesize',
  'sherpa-onnx-node',
  'directml',
  'DADOS LOCAIS CURADOS',
  'windowsHide',
  'keep_alive'
]) {
  if (!packagedRuntimeCode.includes(marker)) {
    throw new Error(`O pacote não contém o marcador obrigatório: ${marker}.`)
  }
}

for (const forbiddenMarker of [
  'TITI_CAPTURE_DIR',
  'captureQaScreens',
  "tool-confirmation-dialog .primary-button"
]) {
  if (packagedRuntimeCode.includes(forbiddenMarker)) {
    throw new Error(
      `Pacote contém um gancho de QA proibido em produção: ${forbiddenMarker}.`
    )
  }
}

const resourcesPath = dirname(archivePath)
const requiredResources = [
  {
    path: join(resourcesPath, 'runtime', 'whisper', 'bin', 'Release', 'parakeet-cli.exe'),
    minimumBytes: 100_000
  },
  {
    path: join(resourcesPath, 'runtime', 'whisper', 'models', 'ggml-parakeet-tdt-0.6b-v3-q8_0.bin'),
    minimumBytes: 600_000_000
  },
  {
    path: join(resourcesPath, 'runtime', 'windows-ui-automation', 'windows-ui-automation.ps1'),
    minimumBytes: 2_000
  },
  {
    path: join(resourcesPath, 'runtime', 'supertonic', 'model-extracted', 'sherpa-onnx-supertonic-3-tts-int8-2026-05-11', 'vector_estimator.int8.onnx'),
    minimumBytes: 70_000_000
  },
  {
    path: join(resourcesPath, 'runtime', 'supertonic', 'model-extracted', 'sherpa-onnx-supertonic-3-tts-int8-2026-05-11', 'vocoder.int8.onnx'),
    minimumBytes: 20_000_000
  },
  {
    path: join(resourcesPath, 'runtime', 'supertonic', 'directml', 'node_modules', 'sherpa-onnx-win-x64', 'sherpa-onnx-c-api.dll'),
    minimumBytes: 4_000_000,
    sha256: '16e2bf37bcfb8cac1261dd569134538b4c03bd09c87bed9ba63b36e475b6193a'
  },
  {
    path: join(resourcesPath, 'runtime', 'supertonic', 'directml', 'node_modules', 'sherpa-onnx-win-x64', 'onnxruntime.dll'),
    minimumBytes: 15_000_000,
    sha256: 'e7eedec6a6f26dc39dc948276a75ef6d2bee3fff944d874ceed0bbd3b97bff40'
  },
  {
    path: join(resourcesPath, 'runtime', 'supertonic', 'directml', 'node_modules', 'sherpa-onnx-win-x64', 'onnxruntime_providers_shared.dll'),
    minimumBytes: 20_000,
    sha256: '265c8daf29637cb259cac8be9f08f2cd45f3883f0f0e4949cbfddd5b4cbec3b6'
  },
  {
    path: join(resourcesPath, 'runtime', 'supertonic', 'directml', 'node_modules', 'sherpa-onnx-win-x64', 'DirectML.dll'),
    minimumBytes: 15_000_000,
    sha256: '9c9e6d822561c6c41b90e6994b3e8857cf1d66dbfb1e0c4c799c7c89b4e92da1'
  },
  {
    path: join(resourcesPath, 'runtime', 'supertonic', 'directml', 'node_modules', 'sherpa-onnx-win-x64', 'sherpa-onnx.node'),
    minimumBytes: 500_000,
    sha256: 'fe786f8424bd22bc2b1c1394f8c019d06d40aa88410f18ab56d5d225eb10cf51'
  },
  {
    path: join(resourcesPath, 'runtime', 'supertonic', 'directml', 'node_modules', 'sherpa-onnx-win-x64', 'sherpa-onnx-cxx-api.dll'),
    minimumBytes: 250_000,
    sha256: 'bff174e9602cad51b15299ba01a18693367261cd8a35eb55b91a5134c4fca2a6'
  },
  {
    path: join(resourcesPath, 'runtime', 'supertonic', 'directml', 'NOTICE.md'),
    minimumBytes: 1_000
  },
  {
    path: join(resourcesPath, 'runtime', 'supertonic', 'directml', 'licenses', 'onnxruntime-LICENSE.txt'),
    minimumBytes: 1_000
  },
  {
    path: join(resourcesPath, 'runtime', 'supertonic', 'directml', 'licenses', 'sherpa-onnx-LICENSE.txt'),
    minimumBytes: 10_000
  },
  {
    path: join(resourcesPath, 'app.asar.unpacked', 'node_modules', 'sherpa-onnx-win-x64', 'sherpa-onnx.node'),
    minimumBytes: 500_000
  },
  {
    path: join(resourcesPath, 'app.asar.unpacked', 'node_modules', 'sherpa-onnx-win-x64', 'onnxruntime.dll'),
    minimumBytes: 15_000_000
  },
  {
    path: join(resourcesPath, 'app.asar.unpacked', 'node_modules', '@koromix', 'koffi-win32-x64', 'win32_x64', 'koffi.node'),
    minimumBytes: 500_000
  }
]
for (const resource of requiredResources) {
  const metadata = await stat(resource.path).catch(() => null)
  if (!metadata?.isFile() || metadata.size < resource.minimumBytes) {
    throw new Error(`Recurso obrigatório ausente ou incompleto: ${resource.path}.`)
  }
  if (resource.sha256) {
    const digest = createHash('sha256')
      .update(await readFile(resource.path))
      .digest('hex')
    if (digest !== resource.sha256) {
      throw new Error(`Recurso obrigatório com hash incorreto: ${resource.path}.`)
    }
  }
}

console.log(
  `Pacote verificado: ${packagedPackage.name} ${packagedPackage.version}, ferramentas, Parakeet incremental e Supertonic DirectML presentes.`
)
