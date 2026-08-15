import type {
  ChatMessage,
  RuntimeStatus,
  TitiSettings
} from '../../shared/contracts'

export interface AssistantProvider {
  status(settings: TitiSettings): Promise<RuntimeStatus>
  complete(messages: ChatMessage[], settings: TitiSettings): Promise<string>
}
