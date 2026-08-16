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
  'DADOS LOCAIS CURADOS',
  'windowsHide',
  'keep_alive'
]) {
  if (!packagedMain.includes(marker)) {
    throw new Error(`O pacote não contém o marcador obrigatório: ${marker}.`)
  }
}

for (const forbiddenMarker of [
  'TITI_CAPTURE_DIR',
  'captureQaScreens',
  "tool-confirmation-dialog .primary-button"
]) {
  if (packagedMain.includes(forbiddenMarker)) {
    throw new Error(
      `Pacote contém um gancho de QA proibido em produção: ${forbiddenMarker}.`
    )
  }
}

const resourcesPath = dirname(archivePath)
const requiredResources = [
  {
    path: join(resourcesPath, 'runtime', 'whisper', 'bin', 'Release', 'whisper-cli.exe'),
    minimumBytes: 100_000
  },
  {
    path: join(resourcesPath, 'runtime', 'whisper', 'models', 'ggml-large-v3-turbo-q8_0.bin'),
    minimumBytes: 800_000_000
  },
  {
    path: join(resourcesPath, 'runtime', 'whisper', 'models', 'ggml-silero-v6.2.0.bin'),
    minimumBytes: 800_000
  },
  {
    path: join(resourcesPath, 'runtime', 'windows-ui-automation', 'windows-ui-automation.ps1'),
    minimumBytes: 2_000
  }
]
for (const resource of requiredResources) {
  const metadata = await stat(resource.path).catch(() => null)
  if (!metadata?.isFile() || metadata.size < resource.minimumBytes) {
    throw new Error(`Recurso obrigatório ausente ou incompleto: ${resource.path}.`)
  }
}

console.log(
  `Pacote verificado: ${packagedPackage.name} ${packagedPackage.version}, ferramentas, processos ocultos, Whisper Large v3 Turbo Q8 e VAD presentes.`
)
