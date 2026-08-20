import { describe, expect, it } from 'vitest'
import type { DiagnosticSummary, TitiSettings, ToolActionLogEntry } from '../../shared/contracts'
import { buildDiagnosticReport } from './diagnostic-report'

const summary: DiagnosticSummary = {
  appVersion: '0.2.0-beta.7',
  system: {
    platform: 'win32',
    release: '10.0.26100',
    arch: 'x64',
    logicalCpuCount: 16,
    totalMemoryBytes: 32_000_000_000,
    displayCount: 2
  },
  audio: { enabled: true, liveMode: false, inputDeviceSelected: true },
  storage: { freeBytes: 100_000_000_000 },
  runtime: { provider: 'ollama', model: 'qwen3:4b-instruct', health: 'ready' },
  automaticUpload: false
}

const settings: TitiSettings = {
  version: 1,
  onboardingComplete: true,
  mascotName: 'SEGREDO-NOME',
  launchAtStartup: true,
  showFloatingMascot: true,
  computerControlEnabled: true,
  keepHistory: true,
  provider: {
    kind: 'ollama',
    endpoint: 'https://usuario:token-super-secreto@example.com/api?key=segredo',
    model: 'qwen3:4b-instruct'
  },
  voice: {
    enabled: true,
    pushToTalkShortcut: 'CommandOrControl+Shift+Space',
    liveMode: false,
    speechRate: 1,
    inputDeviceId: 'ID-MICROFONE-SECRETO'
  },
  games: { standbyEnabled: true, executables: ['JOGO-PESSOAL.exe'] }
}

const activity: ToolActionLogEntry[] = [{
  id: 'id-pessoal',
  tool: 'open_url',
  status: 'confirmed',
  chainId: 'chain-secreta',
  arguments: { url: 'https://conta.example.com/?token=SEGREDO-URL' },
  ok: true,
  message: 'Abriu C:\\Users\\Pessoa\\arquivo-secreto.txt',
  details: { stdout: 'TOKEN-EM-DETALHES' },
  durationMs: 42.4,
  createdAt: '2026-08-19T10:00:00.000Z'
}]

describe('buildDiagnosticReport', () => {
  it('mantém sinais úteis sem exportar conteúdo pessoal ou segredos', () => {
    const report = buildDiagnosticReport({
      summary,
      settings,
      runtime: {
        provider: 'ollama', connected: true, model: 'qwen3:4b-instruct',
        availableModels: ['modelo-pessoal'], message: 'mensagem com segredo',
        checkedAt: '2026-08-19T10:00:00.000Z', engineInstalled: true,
        modelInstalled: true, setupAction: 'ready'
      },
      activity
    })
    const json = JSON.stringify(report)

    expect(report.runtime.endpointScope).toBe('custom-redacted')
    expect(report.runtime.availableModelCount).toBe(1)
    expect(report.recentActivity[0]).toMatchObject({ tool: 'open_url', durationMs: 42 })
    for (const forbidden of [
      'SEGREDO-NOME', 'token-super-secreto', 'example.com', 'ID-MICROFONE-SECRETO',
      'JOGO-PESSOAL', 'SEGREDO-URL', 'arquivo-secreto', 'TOKEN-EM-DETALHES',
      'id-pessoal', 'chain-secreta', 'modelo-pessoal', 'mensagem com segredo'
    ]) expect(json).not.toContain(forbidden)
  })

  it('classifica o endpoint local sem revelar a URL', () => {
    const report = buildDiagnosticReport({
      summary,
      settings: {
        ...settings,
        provider: { ...settings.provider, endpoint: 'http://127.0.0.1:11434/private' }
      },
      runtime: null,
      activity: []
    })

    expect(report.runtime.endpointScope).toBe('loopback')
    expect(JSON.stringify(report)).not.toContain('11434')
    expect(JSON.stringify(report)).not.toContain('/private')
  })
})
