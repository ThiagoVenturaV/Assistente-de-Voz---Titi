import { readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

const projectRoot = resolve(import.meta.dirname, '..')
const listed = spawnSync(
  'git',
  ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
  { cwd: projectRoot, encoding: 'utf8', windowsHide: true }
)

if (listed.status !== 0) {
  throw new Error(`Não foi possível enumerar os arquivos do repositório: ${listed.stderr.trim()}`)
}

const patterns = [
  ['chave privada', /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
  ['token AWS', /AKIA[0-9A-Z]{16}/],
  ['token GitHub', /gh[pousr]_[A-Za-z0-9]{36,255}/],
  ['token OpenAI', /sk-(?:proj-)?[A-Za-z0-9_-]{32,}/],
  ['token Slack', /xox[baprs]-[A-Za-z0-9-]{20,}/],
  ['chave Stripe ativa', /(?:sk|rk)_live_[A-Za-z0-9]{16,}/],
  ['chave Google API', /AIza[0-9A-Za-z_-]{35}/]
]
const findings = []

for (const relativePath of listed.stdout.split('\0').filter(Boolean)) {
  if (relativePath === 'scripts/check-secrets.mjs') continue
  const path = resolve(projectRoot, relativePath)
  const content = await readFile(path).catch(() => null)
  if (!content || content.length > 5 * 1024 * 1024 || content.includes(0)) continue
  const text = content.toString('utf8')
  for (const [label, pattern] of patterns) {
    const match = pattern.exec(text)
    if (!match) continue
    const line = text.slice(0, match.index).split(/\r?\n/).length
    findings.push(`${relativePath}:${line} (${label})`)
  }
}

if (findings.length > 0) {
  throw new Error(`Possíveis segredos encontrados:\n${findings.join('\n')}`)
}

console.log('Nenhum segredo de formato conhecido foi encontrado nos arquivos do projeto.')
