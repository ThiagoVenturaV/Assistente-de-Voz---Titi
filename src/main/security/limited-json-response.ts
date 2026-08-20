export const MAX_LOCAL_JSON_RESPONSE_BYTES = 8 * 1024 * 1024

export async function readLimitedJsonResponse<T>(
  response: Response,
  maximumBytes = MAX_LOCAL_JSON_RESPONSE_BYTES
): Promise<T> {
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes <= 0) {
    throw new Error('O limite da resposta JSON é inválido.')
  }

  const declaredLength = Number(response.headers.get('content-length'))
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) {
    throw new Error('A resposta do serviço local excedeu o limite permitido.')
  }
  if (!response.body) throw new Error('O serviço local retornou uma resposta vazia.')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let received = 0
  let text = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      received += value.byteLength
      if (received > maximumBytes) {
        await reader.cancel().catch(() => undefined)
        throw new Error('A resposta do serviço local excedeu o limite permitido.')
      }
      text += decoder.decode(value, { stream: true })
    }
    text += decoder.decode()
  } finally {
    reader.releaseLock()
  }

  return JSON.parse(text) as T
}
