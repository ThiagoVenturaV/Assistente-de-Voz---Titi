# Titi Beta 0.2.0-beta.8

Esta pré-release substitui a `0.2.0-beta.7`. É uma prévia pública para testadores no Windows e continua sem assinatura Authenticode pública.

## Por que esta atualização é importante

A beta 8 aproxima o comportamento real da decisão de produto desta fase: ações permitidas e de baixo risco executam diretamente, enquanto somente abrir ou controlar o Antigravity pede confirmação. Compras, envios, publicações, exclusões, credenciais, pagamentos, comandos e aplicativos protegidos continuam bloqueados.

## O que mudou

- Novo **autoteste guiado** em Configurações → Atividade verifica microfone, transcrição local, inferência do modelo, tool calling restrito a `current_datetime` e voz neural com confirmação humana do áudio.
- O autoteste não cria conversa, não abre aplicativos, não envia dados e não devolve ao renderer a resposta do modelo nem a data/hora consultada.
- Clique acessível de baixo risco e fechamento de janela deixam de abrir o modal genérico durante o beta; o Antigravity continua com confirmação exclusiva.
- O onboarding corrige o tamanho aproximado do modelo rápido: cerca de 2,5 GB para `qwen3:4b-instruct`; o perfil de qualidade informa cerca de 6,6 GB.
- O diagnóstico seguro resume ambiente, exporta somente dados redigidos e declara ausência de upload automático.
- Acessibilidade ganhou alvos essenciais de 44 × 44 px, estados ao vivo concisos, redução de movimento e recuperação legível quando o microfone some.
- CI e release preparam Electron de forma serial, verificam os runtimes de voz por hash, bloqueiam versão estável não assinada, geram manifesto/checksums e retomam somente rascunhos de release.
- Permanecem a transcrição Parakeet incremental, a voz Supertonic acelerada por DirectML, a visão local multimonitor, a navegação direta e o cronômetro de atividade.

## Evidência do candidato

- `pnpm typecheck`: aprovado.
- `pnpm test`: 47 arquivos e 415 testes aprovados.
- Landing: build e 5 testes renderizados aprovados.
- Auditorias do aplicativo e da landing: zero vulnerabilidades conhecidas no nível alto; scanner de segredos aprovado.
- `pnpm package:win` e `pnpm verify:package`: aprovados para o candidato local beta 8.
- Transcrição empacotada: 10 atualizações parciais em 15 s, frase final correta e processamento final em 6,736 s nesta rodada.
- TTS empacotado: backend `directml`, 4,9 s de áudio; primeira síntese em 0,76 s e síntese aquecida em 0,20 s nesta rodada.
- CI da PR de preparação: verde em checkout Windows limpo, incluindo pacote de produção.

## Integridade do instalador

O candidato local `Titi-Setup-0.2.0-beta.8.exe` tem 892.692.865 bytes (851,34 MiB), SHA-256 `A9852D70EE90C54534662B07691C9AC50D20F3439E743D4BFD764EF4DFCCEFFC` e estado Authenticode `NotSigned`. O ASAR local tem SHA-256 `B8368259F85792588551AC2E7F13E8359D3016E14CB072B896344DF2C28109D0`. Esses valores identificam somente o candidato local; tamanho, checksums e manifesto públicos serão registrados depois que o workflow da tag gerar e publicar os bytes definitivos. Nenhum hash da beta 7 é reutilizado.

## Instalação e dados

O instalador foi projetado para reutilizar o perfil em `%APPDATA%\titi-desktop`; configurações e conversas não fazem parte do pacote. A preservação sobre a beta 7 e a instalação do ativo público ainda precisam ser comprovadas no NSIS final antes da landing apontar para esta versão.

## Limites conhecidos

- A visão multimonitor é somente leitura e sua latência depende do modelo multimodal local e do número e resolução das telas.
- A automação genérica ainda depende da árvore de acessibilidade. Digitação livre, arrastar e menus de contexto não estão liberados; o clique visual permanece restrito ao Play/Pause do Spotify.
- DirectML depende de GPU e driver Windows compatíveis. Em máquinas sem suporte, o fallback CPU preserva a voz com menor velocidade.
- A matriz completa de voz audível, eco, vinte turnos, suspensão, jogos e Windows 10/11 limpos continua manual.
- O instalador beta não possui assinatura Authenticode pública, então o Windows pode exibir um aviso de reputação.
- Cliente remoto e modo reunião do Perssua não fazem parte desta versão.
