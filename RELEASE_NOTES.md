# Titi Beta 0.2.0-beta.2

Esta pré-release corretiva substitui a `0.2.0-beta.1`, que não deve mais ser recomendada. É uma prévia pública para testadores no Windows e continua sem assinatura Authenticode pública.

## O que mudou

- Removida do pacote a instrumentação interna de QA que tornou a beta.1 imprópria para distribuição.
- Todas as ferramentas agora passam por um controlador único, com identidade de cadeia e execução, timeout próprio e cancelamento propagado ao executor real.
- Cancelar uma interação também fecha somente a confirmação ligada àquela execução; aprovar e cancelar ao mesmo tempo não deixa a ação avançar.
- Efeitos externos não verificados usam o estado `dispatched`: o Titi informa que enviou o pedido, sem afirmar que aplicativo, página, busca ou tecla de mídia produziu o efeito esperado.
- O agente agora trata linguagem natural e pedidos compostos como planos de ferramentas. Uma promessa sem chamada é descartada, classificada localmente e refeita com `tool_choice` obrigatório; o caminho inverso bloqueia ferramentas quando o pedido era apenas uma explicação.
- A leitura da resposta do Ollama permanece cancelável até o fim do corpo JSON, não apenas até a chegada dos cabeçalhos.
- Preparação, instalação, inicialização e download de modelo do Ollama podem ser interrompidos; processos iniciados pelo Titi são encerrados quando a operação falha ou é cancelada.
- O standby de jogo cancela conversas, transcrições, confirmações e preparação do runtime, pausa a voz sem apagar a preferência de modo ao vivo, oculta o mascote e verifica a descarga do modelo por `/api/ps`.
- Trocar diretamente entre dois jogos não tira o Titi do standby; falhas de observação não são tratadas como saída do jogo.
- O detector usa uma lista conservadora e aceita executáveis adicionais em Configurações, bloqueando caminhos e comandos.
- Conversas e configurações serializam mutações concorrentes para evitar perda silenciosa de mensagens ou patches.
- O Whisper espera o processo encerrar após cancelamento antes de limpar os arquivos temporários.
- A transcrição trocou o modelo `small` pelo Whisper Large v3 Turbo Q8 de 874 MB, usa Silero VAD para separar voz de música/ruído, suprime tokens não falados e rejeita anotações acústicas antes que virem mensagens.
- A captura do microfone agora exige fala sustentada em vez de um pico isolado, aplica filtros passa-altas e passa-baixas e reduz 48 kHz para 16 kHz com o resampler de áudio do sistema, mantendo um fallback determinístico.
- Depois do Whisper, uma revisão contextual totalmente local compara a fala com os nomes dos aplicativos instalados e corrige deformações fonéticas prováveis. A resposta é estruturada, limitada por similaridade e confiança e volta automaticamente ao texto bruto se o Ollama estiver indisponível ou incerto.
- O contexto de áudio foi ajustado para comandos curtos: no ensaio local pt-BR com o Q8, a frase “Não, o Spotify não está rodando. Abra o Spotify e dê play.” foi transcrita exatamente em 9,51 s.
- A revisão contextual real corrigiu quatro erros observados no histórico, incluindo “pod5”/“esportes feio” para Spotify, “Google Trome” para Google Chrome e “anti-dravite” para Antigravity.
- O CI instala o Electron uma vez antes dos workers de teste, alinha a versão do pnpm e prepara/cacheia o runtime verificado do Whisper antes de empacotar.
- Adicionado controle opt-in de aplicativos visíveis pela UI Automation do Windows. O Titi observa somente controles acessíveis, exige observação na mesma interação, rejeita alvos ambíguos e reobserva depois da ação.
- Spotify agora distingue `play` de `pause`, tenta primeiro o botão acessível e, quando a árvore do aplicativo vem vazia, usa um fallback visual exclusivo: captura a janela em memória, envia ao Ollama local somente um recorte ampliado da barra inferior, clica no Play/Pause relativo à janela e verifica o ícone resultante. A captura não é gravada nem enviada para serviços externos.
- Durante a beta, aplicativos, navegação, buscas, Spotify e controles observados executam direto por decisão explícita do usuário. Abrir ou controlar o Antigravity continua exigindo confirmação.

Também permanecem as melhorias anteriores: comandos diretos com Ollama offline, catálogo seguro de aplicativos, confirmação central para a exceção do Antigravity, memória curada, modo privado, atalho global de voz e inicialização oculta do runtime.

## Evidência automatizada

- `pnpm typecheck`: aprovado.
- `pnpm test`: 28 arquivos e 289 testes aprovados.
- `pnpm qa:ollama-tools`: 10/10 cenários naturais aprovados, incluindo a frase composta que originou este corretivo e dois casos sem efeito lateral.
- `pnpm build`: main, preload e renderer aprovados.
- `pnpm package:win` e `pnpm verify:package`: aprovados para o artefato beta.2 local.

## Instalação e dados

O candidato deve ser instalado sobre o perfil preservado em `%APPDATA%\titi-desktop`. Configurações antigas recebem os padrões seguros do modo jogo sem apagar nome, voz ou conversas. O modelo de conversa continua sendo um download separado de aproximadamente 6,6 GB.

## Integridade do instalador

SHA-256 do candidato local `Titi-Setup-0.2.0-beta.2.exe` (883.460.000 bytes; 842,53 MiB):

`140244B26508B57A241646762420AB2EAF369FD98E12F107DF702DEE19DA393A`

Esse hash deve ser recalculado se o arquivo for assinado ou reconstruído. Não reutilize o hash da beta.1.

## Limites conhecidos

- A automação genérica depende da árvore de acessibilidade e aciona controles nomeados. O caminho visual está limitado a Play/Pause no Spotify; captura visual genérica, digitação livre e gestos não estão implementados.
- O standby precisa de validação manual com jogos reais, múltiplos monitores e tarefas em andamento.
- A voz usa as vozes instaladas no Windows; voz neural permanece como última etapa do backlog.
- O instalador beta ainda não possui assinatura Authenticode pública, então o Windows pode exibir um aviso de reputação.
