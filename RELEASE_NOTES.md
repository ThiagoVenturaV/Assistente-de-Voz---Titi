# Titi Beta 0.2.0-beta.5

Esta pré-release substitui a `0.2.0-beta.4`. É uma prévia pública para testadores no Windows e continua sem assinatura Authenticode pública.

## O que mudou

- Pedidos em linguagem natural para observar as telas chamam diretamente a nova ferramenta `computer_look`, sem depender de o modelo decidir usar a ferramenta.
- A visão local captura todos os monitores conectados, inclusive telas com coordenadas negativas, e envia as imagens somente ao Ollama local. As capturas ficam em memória, não são gravadas e não saem para a nuvem.
- O teste real “Olhe todas as minhas telas e confirme se o YouTube está aberto em algum monitor” observou 2 monitores e confirmou o objetivo com 95% de confiança.
- Sites conhecidos como YouTube, GitHub e Gmail abrem diretamente pela URL correta. Destinos incertos continuam usando pesquisa.
- A confirmação de abertura agora procura a janela em qualquer monitor e ignora retângulos inválidos expostos pela UI Automation, eliminando a falha com coordenadas infinitas do Brave.
- O TTS Supertonic volta a tocar no aplicativo empacotado: a política de segurança do renderer agora permite o áudio local criado por `blob:` sem liberar mídia remota.
- O ledger de abertura guarda somente aplicativo, processo e título da janela; ele não persiste a lista de abas e controles observados.
- Permanecem a transcrição Parakeet incremental, a voz Supertonic DirectML com fallback para CPU e a confirmação exclusiva do Antigravity durante a beta.

## Evidência automatizada e real

- `pnpm test`: 32 arquivos e 328 testes aprovados.
- `pnpm typecheck` e build de produção: aprovados.
- `pnpm package:dir` e `pnpm verify:package`: aprovados para o candidato beta.5.
- Smoke do TTS empacotado: backend `directml`, 4,9 s de áudio; primeira síntese em 0,88 s, síntese aquecida em 0,24 s e WAV PCM mono de 44.100 Hz com 431.888 bytes.
- Visão multimonitor no aplicativo empacotado: 2 monitores observados, resultado confirmado e duração de 29,4 s no hardware de desenvolvimento.

## Instalação e dados

O instalador pode ser aplicado sobre o perfil preservado em `%APPDATA%\titi-desktop`. Configurações e conversas não fazem parte do instalador. O modelo de conversa continua sendo um download separado de aproximadamente 6,6 GB.

## Integridade do instalador

`Titi-Setup-0.2.0-beta.5.exe` tem 892.366.535 bytes (851,03 MiB), SHA-256 `F8357C88D3127F654522911B1798E0EE3A16932E11D4C716080443C83588C0F0` e estado Authenticode `NotSigned`. O hash deve ser recalculado sempre que o instalador for reconstruído ou assinado; hashes das betas anteriores nunca devem ser reutilizados.

## Limites conhecidos

- A visão multimonitor é somente leitura e levou cerca de 29 s no cenário real medido; a latência depende do modelo multimodal local e do número/resolução das telas.
- A automação genérica ainda depende da árvore de acessibilidade. Digitação livre, arrastar e menus de contexto não estão liberados; o clique visual permanece restrito ao Play/Pause do Spotify.
- DirectML depende de uma GPU e de um driver Windows compatíveis. Em máquinas sem suporte, o fallback CPU preserva a voz com menor velocidade.
- O standby precisa de validação manual adicional com jogos reais e tarefas em andamento.
- O instalador beta não possui assinatura Authenticode pública, então o Windows pode exibir um aviso de reputação.
