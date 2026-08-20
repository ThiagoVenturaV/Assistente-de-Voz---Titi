import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { basename, join, resolve } from 'node:path'

const projectRoot = resolve(import.meta.dirname, '..')
const packageJson = JSON.parse(await readFile(join(projectRoot, 'package.json'), 'utf8'))
const releasePath = join(projectRoot, 'release')
const installerName = `Titi-Setup-${packageJson.version}.exe`
const installerPath = join(releasePath, installerName)
const appPath = join(releasePath, 'win-unpacked', 'Titi.exe')
const verifierPath = join(projectRoot, 'scripts', 'verify-authenticode.ps1')
const allowUnsignedPrerelease = process.argv.includes('--allow-unsigned-prerelease')

if (allowUnsignedPrerelease && !packageJson.version.includes('-')) {
  throw new Error('Somente uma pré-release pode ser verificada como não assinada.')
}

const verifierArguments = [
  '-NoProfile',
  '-NonInteractive',
  '-ExecutionPolicy', 'Bypass',
  '-File', verifierPath,
  '-AppPath', appPath,
  '-InstallerPath', installerPath
]

if (allowUnsignedPrerelease) {
  verifierArguments.push('-AllowUnsignedPrerelease')
}

if (process.env.TITI_WINDOWS_SIGNER_SUBJECT?.trim()) {
  verifierArguments.push('-ExpectedSubject', process.env.TITI_WINDOWS_SIGNER_SUBJECT.trim())
}

const verification = spawnSync('powershell.exe', verifierArguments, {
  cwd: projectRoot,
  encoding: 'utf8',
  windowsHide: true
})

if (verification.status !== 0) {
  throw new Error(`Falha ao validar as assinaturas Authenticode:\n${verification.stderr.trim()}`)
}

const signature = JSON.parse(verification.stdout.trim())
const updateManifest = await readFile(join(releasePath, 'latest.yml'), 'utf8')
const manifestPath = /^path:\s*['"]?(.+?)['"]?\s*$/m.exec(updateManifest)?.[1]
const manifestHash = /^sha512:\s*([^\s]+)\s*$/m.exec(updateManifest)?.[1]

if (!manifestPath || basename(manifestPath) !== installerName || !manifestHash) {
  throw new Error('latest.yml não referencia exatamente o instalador assinado desta versão.')
}

const installer = await readFile(installerPath)
const actualHash = createHash('sha512').update(installer).digest('base64')
if (actualHash !== manifestHash) {
  throw new Error('O SHA-512 do instalador não corresponde ao latest.yml.')
}

if (signature.status === 'NotSigned') {
  console.log('Pré-release confirmada como não assinada; SHA-512 consistente com latest.yml.')
} else {
  console.log(`Assinaturas válidas e consistentes: ${signature.subject} (${signature.thumbprint}).`)
}
