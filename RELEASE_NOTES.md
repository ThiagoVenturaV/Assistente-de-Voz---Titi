# Titi Beta 0.2.0-beta.6

Esta pré-release substitui a `0.2.0-beta.5`. É uma prévia pública para testadores no Windows e continua sem assinatura Authenticode pública.

## O que mudou

- A cabeça do mascote passa a ser o ícone oficial do Titi no executável, na janela, no chat, no favicon, nos atalhos e na identidade social da landing page.
- A mensagem falada aparece no chat assim que a transcrição termina, antes de o modelo concluir a resposta.
- Enquanto o Titi pensa ou executa ações, o chat mostra um cronômetro em tempo real; ele para ao receber a resposta, interromper a tarefa ou entrar em standby.
- Permanecem a transcrição Parakeet incremental, a voz Supertonic acelerada por DirectML com fallback para CPU, a visão local multimonitor e a navegação direta para sites conhecidos.
- Durante a beta, comandos compatíveis continuam executando diretamente. Somente abrir ou controlar o Antigravity exige confirmação.

## Evidência automatizada e real

- `pnpm typecheck`: aprovado.
- `pnpm test`: 33 arquivos e 330 testes aprovados.
- Build e 2 testes renderizados da landing: aprovados.
- `pnpm package:win` e `pnpm verify:package`: aprovados para o candidato beta.6.
- QA real do Ollama local: 19/19 cenários de linguagem natural e tool calling aprovados, sem executar efeitos externos.
- Transcrição empacotada: 10 atualizações parciais em 15 s, frase final correta e processamento final em 10,69 s.
- TTS empacotado: backend `directml`, 4,9 s de áudio; primeira síntese em 1,01 s, síntese aquecida em 0,28 s e WAV PCM mono de 44.100 Hz com 431.888 bytes.
- Instalação silenciosa sobre a beta.5: código 0, ASAR instalado idêntico ao pacote e hashes de configurações, conversas e ações preservados.

## Instalação e dados

O instalador pode ser aplicado sobre o perfil preservado em `%APPDATA%\titi-desktop`. Configurações e conversas não fazem parte do instalador. O modelo de conversa continua sendo um download separado de aproximadamente 6,6 GB.

## Integridade do instalador

`Titi-Setup-0.2.0-beta.6.exe` tem 892.673.449 bytes (851,32 MiB), SHA-256 `173C79C4181991A7215066FAD7E4D1A982F49F6465D8B42648F2DD856F59C556` e estado Authenticode `NotSigned`. O `latest.yml` declara a mesma versão, o mesmo tamanho e o SHA-512 do NSIS final. O hash deve ser recalculado sempre que o instalador for reconstruído ou assinado; hashes das betas anteriores nunca devem ser reutilizados.

## Limites conhecidos

- A visão multimonitor é somente leitura e sua latência depende do modelo multimodal local e do número e resolução das telas.
- A automação genérica ainda depende da árvore de acessibilidade. Digitação livre, arrastar e menus de contexto não estão liberados; o clique visual permanece restrito ao Play/Pause do Spotify.
- DirectML depende de uma GPU e de um driver Windows compatíveis. Em máquinas sem suporte, o fallback CPU preserva a voz com menor velocidade.
- O standby precisa de validação manual adicional com jogos reais e tarefas em andamento.
- O instalador beta não possui assinatura Authenticode pública, então o Windows pode exibir um aviso de reputação.
