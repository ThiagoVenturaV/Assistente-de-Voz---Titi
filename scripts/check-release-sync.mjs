import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

function expect(condition, message) {
  if (!condition) throw new Error(`Verificação de coerência falhou: ${message}`)
}

export function expectedBadgeForVersion(version) {
  return `V${version.replace('-beta.', ' BETA.')}`
}

export async function checkReleaseSync(projectRoot) {
  const read = (path) => readFile(join(projectRoot, path), 'utf8')
  const [
    rootPackage,
    landingPackage,
    landingLock,
    landingPage,
    latestYaml,
    releaseNotes,
    readme,
    qaPlan,
    backlog,
    marketingPlan
  ] = await Promise.all([
    read('package.json').then(JSON.parse),
    read('landing/package.json').then(JSON.parse),
    read('landing/package-lock.json').then(JSON.parse),
    read('landing/app/page.tsx'),
    read('release/latest.yml'),
    optionalRead(projectRoot, 'RELEASE_NOTES.md'),
    optionalRead(projectRoot, 'README.md'),
    optionalRead(projectRoot, 'QA_PLAN.md'),
    optionalRead(projectRoot, 'BACKLOG.md'),
    optionalRead(projectRoot, 'MARKETING_PLAN.md')
  ])

  expect(rootPackage.version, 'package principal sem versão definida')
  const version = rootPackage.version
  const tag = `v${version}`
  const expectedDownload = `Titi-Setup-${version}.exe`

  expect(
    landingPackage.version === version,
    `landing/package.json está em ${landingPackage.version}, mas root está em ${version}`
  )
  expect(
    landingLock.version === version && landingLock.packages?.['']?.version === version,
    'landing/package-lock.json não replica a versão atual nos dois campos principais'
  )
  expect(
    landingPage.includes(`/releases/download/${tag}/${expectedDownload}`),
    `landing/app/page.tsx não aponta para ${expectedDownload}`
  )
  expect(
    landingPage.includes(`/releases/tag/${tag}`),
    `landing/app/page.tsx não aponta para as notas de ${tag}`
  )
  expect(
    landingPage.includes(`softwareVersion: "${version}"`),
    'metadado SoftwareApplication não declara a versão atual'
  )
  expect(
    landingPage.includes(expectedBadgeForVersion(version)),
    `texto de versão beta não atualizado: esperado ${expectedBadgeForVersion(version)}`
  )
  expect(
    latestYaml.includes(`version: ${version}`) && latestYaml.includes(expectedDownload),
    'release/latest.yml não referencia exatamente a versão e o instalador atuais'
  )

  if (releaseNotes.includes('## ')) {
    expect(
      releaseNotes.includes(`# Titi Beta ${version}`),
      `RELEASE_NOTES.md não inicia com Titi Beta ${version}`
    )
  }
  if (readme.includes('Estado atual:')) {
    expect(
      readme.slice(0, 1_500).includes(`\`${version}\``) || readme.slice(0, 1_500).includes(version),
      'README não declara versão atual compatível com o package.json'
    )
  }
  if (qaPlan) {
    expect(qaPlan.includes(`Titi \`${version}\``), 'QA_PLAN.md não identifica o candidato atual')
  }
  if (backlog.includes('Auditoria multidisciplinar atual')) {
    expect(backlog.includes(`Auditoria multidisciplinar atual — \`${version}\``), 'BACKLOG.md não identifica a auditoria atual')
  }
  if (marketingPlan) {
    expect(
      marketingPlan.slice(0, 600).includes(version),
      'MARKETING_PLAN.md não identifica a versão atual no resumo executivo'
    )
  }

  return { version, tag, expectedDownload }
}

async function optionalRead(projectRoot, path) {
  const absolutePath = join(projectRoot, path)
  return existsSync(absolutePath) ? readFile(absolutePath, 'utf8') : ''
}

const isMainModule = process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)
if (isMainModule) {
  const result = await checkReleaseSync(resolve(import.meta.dirname, '..'))
  console.log(`Sincronização de release confirmada para ${result.version}.`)
}
