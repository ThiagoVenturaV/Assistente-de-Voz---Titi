import { readFile, stat } from 'node:fs/promises'
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
}

console.log(
  `Pacote verificado: ${packagedPackage.name} ${packagedPackage.version}, ferramentas, Parakeet incremental e Supertonic neural presentes.`
)
