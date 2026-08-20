export interface SupportedLocalModel {
  name: string
  label: string
  approximateDownloadGb: number
  profile: 'fast' | 'quality'
}

export const SUPPORTED_LOCAL_MODELS: readonly SupportedLocalModel[] = [
  {
    name: 'qwen3:4b-instruct',
    label: 'qwen3:4b-instruct — Rápido (padrão)',
    approximateDownloadGb: 2.5,
    profile: 'fast'
  },
  {
    name: 'qwen3.5:9b',
    label: 'qwen3.5:9b — Qualidade (mais lento)',
    approximateDownloadGb: 6.6,
    profile: 'quality'
  }
] as const

export function localModelDownloadLabel(modelName: string): string {
  const model = SUPPORTED_LOCAL_MODELS.find(({ name }) => name === modelName)
  return model
    ? `cerca de ${String(model.approximateDownloadGb).replace('.', ',')} GB`
    : 'tamanho informado pelo Ollama'
}
