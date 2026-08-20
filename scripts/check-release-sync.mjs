import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(fileURLToPath(import.meta.url), '..', '..')
const rootPackagePath = resolve(projectRoot, 'package.json')
const landingPackagePath = resolve(projectRoot, 'landing', 'package.json')
const landingPagePath = resolve(projectRoot, 'landing', 'app', 'page.tsx')
const latestYamlPath = resolve(projectRoot, 'release', 'latest.yml')
const releaseNotesPath = resolve(projectRoot, 'RELEASE_NOTES.md')
const readmePath = resolve(projectRoot, 'README.md')

function expect(condition, message) {
  if (!condition) {
    throw new Error(`Verificação de coerência falhou: ${message}`)
  }
}

const rootPackage = JSON.parse(await readFile(rootPackagePath, 'utf8'))
const landingPackage = JSON.parse(await readFile(landingPackagePath, 'utf8'))
const landingPage = await readFile(landingPagePath, 'utf8')
const latestYaml = await readFile(latestYamlPath, 'utf8')
const releaseNotes = existsSync(releaseNotesPath) ? await readFile(releaseNotesPath, 'utf8') : ''
const readme = existsSync(readmePath) ? await readFile(readmePath, 'utf8') : ''

expect(rootPackage.version, 'package principal sem versão definida')
const version = rootPackage.version
const expectedBadge = `V${version.replace('-beta.', ' BETA.')}`

expect(
  landingPackage.version === version,
  `landing/package.json está em ${landingPackage.version}, mas root está em ${version}`
)

const expectedDownload = `Titi-Setup-${version}.exe`
expect(
  landingPage.includes(`v${version}/Titi-Setup-${version}.exe`),
  `landing/app/page.tsx não aponta para ${expectedDownload}`
)
expect(
  landingPage.includes(expectedBadge),
  `texto de versão beta não atualizado: esperado ${expectedBadge}`
)
expect(
  latestYaml.includes(`version: ${version}`),
  `release/latest.yml não declara version: ${version}`
)
expect(
  latestYaml.includes(expectedDownload),
  `release/latest.yml não referencia ${expectedDownload}`
)

if (releaseNotes.includes('## ')) {
  expect(
    releaseNotes.includes(`# Titi Beta ${version}`),
    `RELEASE_NOTES.md não inicia com Titi Beta ${version}`
  )
}

if (readme.includes('Estado atual:')) {
  expect(
    readme.includes(`pré-release \`${version}\``) || readme.includes(`pré-release ${version}`),
    'README não declara versão atual compatível com o package.json'
  )
}

console.log(`Sincronização de release confirmada para ${version}.`)
