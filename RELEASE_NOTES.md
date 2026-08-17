# Titi Beta 0.2.0-beta.7

Esta pré-release substitui a `0.2.0-beta.6`. É uma prévia pública para testadores no Windows e continua sem assinatura Authenticode pública.

## O que mudou

- `qwen3:4b-instruct` passa a ser o perfil **Rápido (padrão)** para novas configurações; `qwen3.5:9b` continua disponível como perfil **Qualidade (mais lento)**.
- O seletor de modelos identifica os dois perfis recomendados e continua aceitando outros modelos instalados no Ollama.
- O prompt do agente reforça que uma correção do usuário substitui o pedido anterior e nunca deve repetir o alvo antigo.
- O botão **X** do mascote flutuante fica sempre visível, ganhou uma área de clique de 36 × 36 px e um rótulo acessível. O fechamento foi comprovado no aplicativo instalado.
- O benchmark reproduzível de Qwen 4B, Qwen 3.5 9B e Nemotron Mini está documentado em `docs/OLLAMA_AGENT_MODEL_BENCHMARK.md`.
- Permanecem a transcrição Parakeet incremental, a voz Supertonic acelerada por DirectML, a visão local multimonitor, a navegação direta para sites conhecidos, a mensagem ditada imediata e o cronômetro de atividade.

## Evidência automatizada e real

- `pnpm typecheck`: aprovado.
- `pnpm test`: 34 arquivos e 331 testes aprovados.
- Build e 2 testes renderizados da landing: aprovados.
- `pnpm package:win` e `pnpm verify:package`: aprovados para o candidato beta.7.
- Qwen 4B: 18/19 cenários de linguagem natural e tool calling, média de 1,05 s por requisição nesta rodada e 4/4 fluxos pelo `OllamaProvider` no benchmark controlado.
- Qwen 3.5 9B: 19/19 no contrato e 4/4 pelo provider; permanece como opção de qualidade. Nemotron Mini não é oferecido por incompatibilidade e falhas semânticas.
- Transcrição empacotada: 10 atualizações parciais em 15 s, frase final correta e processamento final em 6,834 s.
- TTS empacotado: backend `directml`, 4,9 s de áudio; primeira síntese em 0,73 s, síntese aquecida em 0,23 s e WAV PCM mono de 44.100 Hz com 431.888 bytes.
- Instalação silenciosa sobre a beta.6: código 0, ASAR instalado idêntico ao pacote e hashes de configurações, conversas e atividade preservados.
- Smoke visual instalado: o X permaneceu visível no mascote, foi exposto como “Ocultar mascote” e deixou apenas a janela principal aberta após o clique.

## Instalação e dados

O instalador pode ser aplicado sobre o perfil preservado em `%APPDATA%\titi-desktop`. Configurações e conversas não fazem parte do instalador. O modelo de conversa padrão continua sendo um download separado de aproximadamente 2,5 GB.

## Integridade do instalador

`Titi-Setup-0.2.0-beta.7.exe` tem 892.673.907 bytes (851,32 MiB), SHA-256 `D39A3F53B17DF20F30971469EE0AC3094F938FB24D3001423C995597A6A540BA` e estado Authenticode `NotSigned`. O `latest.yml` declara a mesma versão, o mesmo tamanho e o SHA-512 do NSIS final. O ASAR instalado e o ASAR do pacote possuem SHA-256 `A9070C81C2EE746C28391DFAB5FF31F9D5096581CE6154161E2B028D1CE26ECF`.

## Limites conhecidos

- O perfil rápido 4B falhou no cenário contextual “Abra o Chrome” → “Na verdade, abre o Brave” do corpus de 19 casos. O perfil 9B passou nesse cenário e permanece disponível; nenhuma ferramenta foi executada durante o benchmark.
- A visão multimonitor é somente leitura e sua latência depende do modelo multimodal local e do número e resolução das telas.
- A automação genérica ainda depende da árvore de acessibilidade. Digitação livre, arrastar e menus de contexto não estão liberados; o clique visual permanece restrito ao Play/Pause do Spotify.
- DirectML depende de GPU e driver Windows compatíveis. Em máquinas sem suporte, o fallback CPU preserva a voz com menor velocidade.
- O standby precisa de validação manual adicional com jogos reais e tarefas em andamento.
- O instalador beta não possui assinatura Authenticode pública, então o Windows pode exibir um aviso de reputação.
