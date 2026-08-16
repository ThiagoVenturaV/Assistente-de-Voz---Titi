# Titi Beta 0.2.0-beta.3

Esta pré-release corretiva substitui a `0.2.0-beta.2`. É uma prévia pública para testadores no Windows e continua sem assinatura Authenticode pública.

## O que mudou

- Perguntas conceituais que recebam uma tool call vazia ou indevida do modelo agora são bloqueadas antes de qualquer efeito e refeitas como conversa normal.
- Perguntas claramente conversacionais deixam de pagar uma segunda rodada de classificação, reduzindo a latência sem enfraquecer a recuperação de pedidos de ação esquecidos.
- O schema e o prompt agora distinguem “abrir o navegador” de “abrir uma página” e `spotify.open` de `spotify.play`; dar Play usa uma única ferramenta que já abre o aplicativo quando necessário.
- Correções e referências entre mensagens entram no gate do modelo real, incluindo “na verdade abre o Brave”, “pesquisa isso no Brave” e “agora pausa ela”.
- O encadeamento `computer_observe` → `computer_action` preserva a mesma cadeia e só age sobre o nome exato observado; os controles encontrados também aparecem de forma legível na resposta.
- A matriz local agora cobre as seis ferramentas, aplicativos genéricos, pedidos compostos, conversa sem efeito lateral e múltiplos turnos.
- Removida do pacote a instrumentação interna de QA que tornou a beta.1 imprópria para distribuição.
- Todas as ferramentas agora passam por um controlador único, com identidade de cadeia e execução, timeout próprio e cancelamento propagado ao executor real.
- Cancelar uma interação também fecha somente a confirmação ligada àquela execução; aprovar e cancelar ao mesmo tempo não deixa a ação avançar.
- Efeitos externos não verificados usam o estado `dispatched`: o Titi informa que enviou o pedido, sem afirmar que aplicativo, página, busca ou tecla de mídia produziu o efeito esperado.
- O agente agora trata linguagem natural e pedidos compostos como planos de ferramentas. Uma promessa sem chamada é descartada, classificada localmente e refeita com `tool_choice` obrigatório; o caminho inverso bloqueia ferramentas quando o pedido era apenas uma explicação.
- Se a primeira resposta nativa do Ollama vier totalmente vazia, o mesmo classificador seguro agora decide entre conversa e ação; pedidos de ação seguem para a recuperação obrigatória em vez de terminarem sem executar a ferramenta.
- A leitura da resposta do Ollama permanece cancelável até o fim do corpo JSON, não apenas até a chegada dos cabeçalhos.
- Preparação, instalação, inicialização e download de modelo do Ollama podem ser interrompidos; processos iniciados pelo Titi são encerrados quando a operação falha ou é cancelada.
- O standby de jogo cancela conversas, transcrições, confirmações e preparação do runtime, pausa a voz sem apagar a preferência de modo ao vivo, oculta o mascote e verifica a descarga do modelo por `/api/ps`.
- Trocar diretamente entre dois jogos não tira o Titi do standby; falhas de observação não são tratadas como saída do jogo.
- O detector usa uma lista conservadora e aceita executáveis adicionais em Configurações, bloqueando caminhos e comandos.
- Conversas e configurações serializam mutações concorrentes para evitar perda silenciosa de mensagens ou patches.
- O motor de transcrição espera o processo encerrar após cancelamento antes de limpar os arquivos temporários.
- A transcrição trocou o Whisper pelo NVIDIA Parakeet TDT 0.6B v3 Q8 de 668.757.119 bytes, executado localmente em CPU. O modelo suporta português, pontuação e ditado longo sem depender de prompt textual.
- O Parakeet agora permanece carregado em um worker dedicado. O Titi envia blocos de áudio durante a fala e revisa a frase na interface; no ensaio final de 15 segundos, a primeira parcial apareceu em 165 ms e o próprio modelo corrigiu “Tite” para “Titi” ao receber mais contexto.
- CPU continua como padrão por evidência: no áudio longo de QA, Parakeet Q8 levou 9,9 s na CPU e 40,2 s com CUDA 12.4 na RTX 2060 Super. A GPU fica livre para o modelo de conversa.
- O modo ao vivo pode ser encerrado por frases naturais como “pare a conversa” e “encerre o modo ao vivo”, sem enviar esse comando ao modelo.
- A voz instalada no Windows foi substituída pelo Supertonic 3 INT8, uma voz neural em português, totalmente local e isolada em worker. O smoke do pacote final gerou 4,9 s de áudio em 0,95 s.
- Markdown, URLs e emojis permanecem no chat, mas são removidos do texto enviado à voz para que símbolos não sejam narrados.
- A captura do microfone agora exige fala sustentada em vez de um pico isolado, aplica filtros passa-altas e passa-baixas e reduz 48 kHz para 16 kHz com o resampler de áudio do sistema, mantendo um fallback determinístico.
- A revisão contextual não reescreve mais a frase. Aliases observados no histórico são determinísticos; nomes novos passam por um schema de substituições e são aceitos somente se o trecho existir literalmente, o destino pertencer ao catálogo, a confiança for alta e a semelhança fonética for plausível. Verbos, ações, negações e números são imutáveis nessa etapa.
- No ensaio local pt-BR curto, Parakeet transcreveu exatamente “Não, o Spotify não está rodando. Abra o Spotify e dê play.” em 1,21 s, contra 9,51 s do Whisper Q8.
- Num ensaio controlado de 55,4 s, a configuração antiga `audio-ctx 768` do Whisper cortou conteúdo e repetiu o fim três vezes; Parakeet preservou o texto completo, negações, tempos verbais, números e horário em 7,81 s.
- Qwen 0.8B, Gemma 1B, Phi-4 Mini e Qwen 9B foram comparados como reescritores. Os três SLMs acertaram apenas 5/9, 5/9 e 6/9; até o Qwen 9B mudou uma ação em 1/9. Por isso nenhum modelo generativo pode reescrever a transcrição inteira.
- O CI instala o Electron uma vez antes dos workers de teste, alinha a versão do pnpm e prepara/cacheia o runtime verificado do Parakeet antes de empacotar.
- Adicionado controle opt-in de aplicativos visíveis pela UI Automation do Windows. O Titi observa somente controles acessíveis, exige observação na mesma interação, rejeita alvos ambíguos e reobserva depois da ação.
- Spotify agora distingue `play` de `pause`, tenta primeiro o botão acessível e, quando a árvore do aplicativo vem vazia, usa um fallback visual exclusivo: captura a janela em memória, envia ao Ollama local somente um recorte ampliado da barra inferior, clica no Play/Pause relativo à janela e verifica o ícone resultante. A captura não é gravada nem enviada para serviços externos.
- Durante a beta, aplicativos, navegação, buscas, Spotify e controles observados executam direto por decisão explícita do usuário. Abrir ou controlar o Antigravity continua exigindo confirmação.

Também permanecem as melhorias anteriores: comandos diretos com Ollama offline, catálogo seguro de aplicativos, confirmação central para a exceção do Antigravity, memória curada, modo privado, atalho global de voz e inicialização oculta do runtime.

## Evidência automatizada

- `pnpm typecheck`: aprovado.
- `pnpm test`: 30 arquivos e 306 testes aprovados.
- `pnpm qa:ollama-tools`: 19/19 cenários aprovados no Qwen 3.5 9B local, cobrindo as seis ferramentas, referências entre turnos, correções e observação seguida de ação.
- `pnpm build`: main, preload e renderer aprovados.
- `pnpm package:win` e `pnpm verify:package`: aprovados para o artefato beta.3 final.
- Workers empacotados: Parakeet com 10 parciais e frase final correta; Supertonic com 4,9 s de áudio gerados em 0,95 s.
- Instalação silenciosa sobre a beta.2: código 0, versão interna beta.3 e hashes de configurações/conversas preservados exatamente.

## Instalação e dados

O candidato deve ser instalado sobre o perfil preservado em `%APPDATA%\titi-desktop`. Configurações antigas recebem os padrões seguros do modo jogo sem apagar nome, voz ou conversas. O modelo de conversa continua sendo um download separado de aproximadamente 6,6 GB.

## Integridade do instalador

SHA-256 de `Titi-Setup-0.2.0-beta.3.exe` (878.333.160 bytes; 837,64 MiB):

`42458B01E7144B7C03D2CEB0CA355EF8E436D988107E306B9DBCE750B1E32BA1`

O arquivo continua sem assinatura Authenticode. O hash deve ser recalculado se o instalador for assinado ou reconstruído; hashes das betas anteriores nunca devem ser reutilizados.

## Limites conhecidos

- A automação genérica depende da árvore de acessibilidade e aciona controles nomeados. O caminho visual está limitado a Play/Pause no Spotify; captura visual genérica, digitação livre e gestos não estão implementados.
- O standby precisa de validação manual com jogos reais, múltiplos monitores e tarefas em andamento.
- O Supertonic melhora naturalidade e privacidade, mas ainda não oferece clonagem de voz ou o nível máximo de expressividade de serviços maiores em nuvem.
- O instalador beta ainda não possui assinatura Authenticode pública, então o Windows pode exibir um aviso de reputação.
