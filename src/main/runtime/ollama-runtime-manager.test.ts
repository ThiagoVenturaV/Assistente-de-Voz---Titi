import { describe, expect, it } from 'vitest'
import type { RuntimeStatus } from '../../shared/contracts'
import { selectSetupAction } from './ollama-runtime-manager'

const disconnected: RuntimeStatus = {
  provider: 'ollama',
  connected: false,
  model: 'qwen3.5:9b',
  availableModels: [],
  message: 'Desconectado',
  checkedAt: '2026-08-15T00:00:00.000Z'
}

describe('selectSetupAction', () => {
  it('solicita a instalação quando o mecanismo não existe', () => {
    expect(selectSetupAction(disconnected, false, false)).toBe('install-engine')
  })

  it('inicia um mecanismo instalado que está parado', () => {
    expect(selectSetupAction(disconnected, true, false)).toBe('start-engine')
  })

  it('baixa o modelo somente depois que o mecanismo está conectado', () => {
    expect(selectSetupAction({ ...disconnected, connected: true }, true, false)).toBe('download-model')
  })

  it('fica pronto quando mecanismo e modelo estão disponíveis', () => {
    expect(selectSetupAction({ ...disconnected, connected: true }, true, true)).toBe('ready')
  })
})
