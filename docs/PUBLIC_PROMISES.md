# Matriz de promessa pública do Titi

Esta matriz liga a copy da landing a evidências existentes e impede que uma demonstração visual seja tratada como telemetria real. O estado deve ser revisto em cada release.

| Promessa pública | Estado | Evidência reproduzível | Limite comunicado |
| --- | --- | --- | --- |
| Entende pedidos em linguagem natural e contexto | Comprovado no corpus local | `pnpm qa:ollama-tools`; testes do `OllamaProvider` e do `AssistantHarness` | o perfil rápido 4B mantém uma regressão contextual conhecida; o 9B é a opção de qualidade |
| A transcrição aparece enquanto a pessoa fala | Comprovado no pacote | testes do worker Parakeet e `pnpm qa:packaged-transcription` | microfone e dispositivo real continuam no gate manual |
| Voz neural local acelerada pela GPU | Comprovado no pacote | `pnpm qa:packaged-tts` e relatório `docs/SUPERTONIC_GPU_BENCHMARK.md` | DirectML depende de GPU/driver compatíveis e possui fallback CPU |
| Abre aplicativos, navega e controla Play/Pause | Comprovado em escopo delimitado | testes de catálogo/toolkit e smoke real descrito no `QA_PLAN.md` | não significa controlar qualquer interface; automação protegida é bloqueada ou confirmada |
| Observa todos os monitores localmente | Comprovado em dois monitores | testes do agente visual e smoke beta.5 preservado no gate atual | observação genérica é somente leitura e pode ter latência |
| Conversa, transcrição e TTS locais por padrão | Comprovado no código e pacote | endpoints Ollama locais validados, Parakeet e Supertonic empacotados | downloads, páginas, pesquisas e serviços externos usam internet quando pedidos |
| Histórico fica no computador e pode ser apagado | Comprovado no código | testes dos stores e controles em Configurações | desinstalação com escolha explícita de apagar ainda está no backlog |
| “Parar” encerra o modo ao vivo | Comprovado automaticamente | `src/renderer/src/voice/live-voice-command.test.ts` | 20 turnos com microfone real continuam no gate manual |

Elementos do mockup da landing são demonstrações do comportamento esperado do beta. Recibos como “resultado verificado” só representam fluxos cobertos acima; não são dados ao vivo de uma sessão do visitante.
