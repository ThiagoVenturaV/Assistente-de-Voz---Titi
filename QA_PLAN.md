# Gate de QA — Titi `0.2.0-beta.2`

Auditoria atualizada em 16/08/2026. Este documento define o que precisa estar comprovado antes de orientar o usuário a instalar a nova versão ou publicar o download como beta público.

## Veredito atual

**A PRÉ-RELEASE PÚBLICA `0.2.0-beta.1` PRECISA SER SUBSTITUÍDA; A `0.2.0-beta.2` É O CANDIDATO NÃO ASSINADO.** A fonte da beta.2 remove a rota interna de QA da versão pública antiga e acrescenta cancelamento, timeout, estados honestos, serialização, standby, correções do CI, controle opt-in de interfaces acessíveis, fallback visual local de Play/Pause no Spotify, recuperação semântica de tool calling e transcrição com Whisper Large v3 Turbo Q8, Silero VAD e revisão contextual local. Por decisão explícita para a beta, ferramentas permitidas executam direto; somente o Antigravity pede confirmação. Typecheck, 289 testes, matriz local 10/10, build, NSIS e verificação estrutural passam. O instalador foi reconstruído depois dos corretivos de linguagem natural e voz, portanto o smoke da versão instalada precisa ser repetido com este hash. Como o candidato está `NotSigned`, pode acionar o aviso de reputação do Windows e só deve ser tratado como pré-release para testadores.

Antes do teste, o usuário havia desinstalado a versão anterior: a pasta de instalação foi removida, enquanto configurações e conversas permaneceram em `%APPDATA%\titi-desktop`. A beta.2 foi instalada sobre esse perfil e reabriu os dados existentes.

## Evidências desta auditoria

| Verificação | Estado | Evidência em 16/08/2026 |
|---|---|---|
| Versão declarada na fonte | Aprovado | `package.json` declara `0.2.0-beta.2` |
| Typecheck | Aprovado | `pnpm typecheck`, código 0 |
| Testes automatizados | Aprovado na branch | `pnpm test`: 28 arquivos e 289 testes aprovados |
| Build de produção | Aprovado | `pnpm build`: main, preload e renderer compilados |
| Linguagem natural e seleção de ferramentas | Aprovado no nível de contrato | `pnpm qa:ollama-tools`: 10/10 para ações simples, correções, pedido composto Spotify+Play, pesquisa, hora, Antigravity e duas perguntas sem efeito; o script não executa as ferramentas retornadas |
| Dados da versão anterior | Preservados após o NSIS | A instalação reabriu o nome, as configurações e a conversa anterior; `settings.json` e `conversations.json` continuam presentes em `%APPDATA%\titi-desktop` |
| Instalador publicado | Reprovado para recomendação | `Titi-Setup-0.2.0-beta.1.exe`, SHA-256 `A4E833…21471`, ainda contém a rota interna de QA |
| Pacote corretivo de diretório | Aprovado | `pnpm package:win` regenerou `win-unpacked`; `verify:package` confirmou `titi-desktop 0.2.0-beta.2`, voz e marcadores funcionais |
| Runtime local de voz empacotado | Aprovado | `ggml-large-v3-turbo-q8_0.bin` com 874.188.075 bytes e `ggml-silero-v6.2.0.bin` com 885.098 bytes em `win-unpacked/resources/runtime/whisper`; o pacote não contém o modelo `small` antigo |
| Ensaio local de transcrição pt-BR | Aprovado sem microfone real | voz Microsoft Maria: “Não, o Spotify não está rodando. Abra o Spotify e dê play.” transcrita exatamente em 9,51 s com Q8, VAD e contexto otimizado; a revisão local corrigiu os quatro erros históricos testados; microfone do usuário continua no smoke manual |
| Automação de interface empacotada | Aprovado estruturalmente | `windows-ui-automation.ps1` com 9.242 bytes em `win-unpacked/resources/runtime`, incluindo UI Automation, captura em memória, recorte ampliado e clique relativo; o verificador exige o recurso e `focusImageBase64` no ASAR |
| Manifesto de release | Aprovado localmente | `latest.yml` declara beta.2, nome, tamanho 883.460.000 bytes e SHA-512 correspondentes |
| Assinatura do instalador | Risco explícito | `Get-AuthenticodeSignature` retorna `NotSigned` para o instalador beta.2 e `win-unpacked/Titi.exe` |
| Ensaio visual real do Spotify | Aprovado na fonte | com árvore acessível vazia, o Ollama local identificou Play com 95%, o clique relativo iniciou a reprodução e a inspeção independente mostrou Pause; o recorte ampliado corrigiu a classificação pós-clique para `playing` com 95% |
| Política de confirmação beta | Aprovado automaticamente | web, Spotify, aplicativos e UI permitida executam direto; somente abrir/controlar Antigravity é sensível; alvos protegidos continuam bloqueados |
| Catálogo real do Windows | Aprovado para as fontes requeridas | `Get-StartApps` retornou Brave (`Brave`), Spotify (`SpotifyAB.SpotifyMusic_zpdnekdrzrea0!Spotify`), ChatGPT/Codex (`OpenAI.Codex_2p2nqsd0c76g0!App`), Antigravity e Antigravity IDE |
| Instalação do NSIS atual | Aprovado estruturalmente | o instalador final retornou código 0 em `%LOCALAPPDATA%\Programs\Titi`, o ASAR instalado declara `0.2.0-beta.2`, o Q8 confere com o hash oficial, configurações e conversas foram preservadas e o processo abriu; interação visual e microfone continuam no smoke manual |

## Bloqueadores do candidato

### RC-00 — substituir o pacote público com instrumentação interna

- [x] remover `TITI_CAPTURE_DIR`, `captureQaScreens` e cliques automáticos do processo principal;
- [x] fazer o verificador falhar se qualquer marcador reaparecer no ASAR;
- [x] gerar e verificar um novo `win-unpacked` sem esses marcadores;
- [ ] gerar o NSIS corretivo a partir de commit/tag próprios;
- [ ] instalar, executar a matriz crítica e só então trocar o download público.

### RC-01 — gerar o artefato correto

- [x] Executar `pnpm package:win` em Windows com a árvore de trabalho final.
- [x] Existir `release/Titi-Setup-0.2.0-beta.2.exe` e seu `.blockmap`.
- [x] `release/win-unpacked/resources/app.asar` conter `titi-desktop` versão `0.2.0-beta.2`.
- [x] `pnpm verify:package` terminar com código 0 após o empacotamento beta.2.
- [ ] Conferir que nenhum arquivo `0.1.x` será enviado por engano ao release novo.

Os instaladores `0.1.0` e `0.1.1` continuam no diretório local `release/`; o upload deve selecionar explicitamente somente o candidato e seu `.blockmap`.

### RC-02 — alinhar instalador, manifesto e publicação

- [x] `release/latest.yml` declarar `0.2.0-beta.2`, o nome e o tamanho do instalador candidato.
- [x] Calcular o SHA-256 do build beta.2 atual: `140244B26508B57A241646762420AB2EAF369FD98E12F107DF702DEE19DA393A`.
- [ ] Recalcular e publicar o SHA-256 se o arquivo for assinado, pois a assinatura altera os bytes.
- [x] `RELEASE_NOTES.md`, README e a fonte da landing page identificarem `0.2.0-beta.2`; a landing só deve ser publicada depois do release existir.
- [ ] Título, tag, ativo e link do GitHub Release publicado apontarem para essa mesma versão e arquivo.
- [x] Não anunciar atualização automática: o aplicativo ainda usa atualização manual.

### RC-03 — confiança do executável

- [ ] `Get-AuthenticodeSignature` retornar `Valid` e o editor esperado para o instalador e o executável principal.
- [x] O candidato beta.2 local foi identificado por tamanho (883.460.000 bytes; 842,53 MiB) e SHA-256 antes da publicação.
- [ ] O hash publicado corresponder byte a byte ao arquivo baixado do release.
- [ ] O Microsoft Defender com proteção em tempo real ativa examinar o instalador beta.2 final sem registrar detecção correspondente.
- [ ] Nenhum segredo, conversa, arquivo de perfil ou caminho pessoal da máquina de build estar dentro do ASAR ou dos recursos.

Para uma versão estável e recomendada amplamente, assinatura válida continua sendo gate. Esta pré-release pode ser publicada para testadores porque o estado `NotSigned` será informado de forma explícita; o aviso do Windows não deve ser contornado nem descrito como garantia de segurança.

### RC-04 — provar o executável empacotado

- [x] Instalar o candidato reconstruído como usuário comum sem terminal, PowerShell ou CMD visível.
- [ ] Abrir o `win-unpacked` atual em perfil isolado e confirmar onboarding, home, mascote e a nova configuração de controle sem janela branca.
- [x] Confirmar `0.2.0-beta.2` no ASAR e Whisper completo em `resources`.
- [x] Instalar o candidato reconstruído e confirmar `0.2.0-beta.2` no pacote instalado.
- [ ] Confirmar visualmente que interface, mascote e sprites carregam; Whisper Q8 e o runtime de UI Automation foram confirmados estruturalmente na instalação atual.
- [ ] Testar entrada do Whisper, microfone e saída de voz na instalação final.
- [ ] Fechar e abrir o candidato atual três vezes sem crash, janela branca ou duplicação da janela principal.
- [ ] Executar um smoke contínuo de 30 minutos sem crescimento anormal de CPU, RAM, handles ou processos.

### RC-05 — provar as ferramentas de verdade

O teste do modelo em JSON é necessário, mas não basta. O caminho completo precisa passar pelo `AssistantHarness`, política beta de confirmação, auditoria, catálogo do Windows, UI Automation e aplicativo real.

- [x] O modelo e a recuperação semântica passaram em 10/10 cenários naturais; a frase “Spotify não está rodando; abre ele e dá play” resultou em `spotify({ action: "play" })`, e perguntas conceituais não produziram efeito.
- [x] O Windows registrou fontes reais para Brave, Spotify, ChatGPT/Codex, Antigravity e Antigravity IDE.
- [ ] No pacote atual, “Abra o Spotify”, “Abra o Brave” e “Abra o Codex” executam direto e registram o resultado honesto.
- [ ] “Abra o Antigravity” continua mostrando confirmação; negar impede o efeito e aprovar usa o AppID registrado.
- [ ] Um aplicativo recém-instalado e seguro é descoberto pelo nome sem confirmação e cria `app-skills.json` apenas após sucesso.
- [ ] Na segunda abertura, a receita aprendida é reutilizada sem varrer caminhos desnecessariamente.
- [ ] Aplicativo inexistente retorna falha e nunca diz que foi aberto.
- [ ] Nome ambíguo não abre silenciosamente o candidato errado.
- [ ] `cmd`, PowerShell, caminho `.exe`, argumento de linha de comando e URI não permitida são bloqueados sem processo filho.
- [ ] Negar ou deixar expirar a confirmação do Antigravity não executa efeito lateral.
- [ ] Pesquisa web e pesquisa no aplicativo de música executam direto durante a beta e registram destino/termo no log local.
- [ ] Com controle de interface desligado, `computer_observe` e `computer_action` falham sem tocar no aplicativo.
- [ ] Com controle ligado, uma ação genérica só avança após observar o mesmo alvo na mesma interação; alvo ausente, antigo ou ambíguo é bloqueado.
- [ ] No Spotify real com acessibilidade disponível, `play` aciona o botão acessível e só confirma quando `Pause/Pausar` aparece; `pause` verifica a transição inversa.
- [x] Com a árvore acessível vazia no Spotify real, o fallback visual local identificou o Play, clicou no controle inferior relativo à janela e uma inspeção independente confirmou Pause; a classificação do recorte ampliado retornou `playing` com 95%.
- [ ] No pacote instalado, repetir Play/Pause com a janela movida e redimensionada; a captura imediatamente anterior ao clique deve recalcular o ponto relativo e a captura posterior deve confirmar o ícone oposto.
- [ ] Para Próxima/Anterior ou quando o fallback visual estiver indisponível, a tecla multimídia permanece `dispatched`, sem afirmar que a faixa mudou.
- [ ] O log de atividade registra pedido, decisão, sucesso/falha e duração, sem tokens, credenciais ou conteúdo sensível.

### RC-06 — voz, modo ao vivo e mascote

- [ ] O botão **Aperte para falar** captura enquanto usado, encerra a track e produz transcrição real.
- [ ] O botão **Ao vivo** no mascote inicia a escuta sem exigir ativar antes o outro botão.
- [ ] Completar três ciclos: ouvir → silêncio → transcrever → responder → falar → voltar a ouvir.
- [ ] Desligar o modo ao vivo durante início, gravação, transcrição, resposta do modelo e fala impede qualquer reinício posterior do microfone.
- [ ] Negar a permissão de microfone mostra erro compreensível e deixa o modo ao vivo desligado.
- [ ] Fechar o Titi encerra todas as tracks e cancela síntese de voz.
- [ ] O mascote usa estados coerentes de ouvindo, pensando, revisando, falando, sucesso, erro e standby.
- [ ] O atalho global funciona fora da janela, acusa conflito e é desregistrado ao sair.

### RC-07 — Ollama sem janelas e com ownership correto

- [ ] Com Ollama instalado e parado, o Titi inicia no máximo um `ollama serve` e nenhuma janela de terminal aparece.
- [ ] Durante 60 segundos de inicialização e polling de jogo, nenhuma janela de PowerShell/CMD/Terminal pisca na tela.
- [ ] Dez pedidos concorrentes de preparação continuam produzindo uma única inicialização.
- [ ] Se o Ollama já estava em execução antes do Titi, fechar o Titi não o encerra.
- [ ] Se o processo foi iniciado pelo Titi, sair do Titi encerra somente esse processo e não deixa órfão.
- [ ] Endpoint local personalizado é usado em status, health check, conversa e descarregamento do modelo.
- [ ] Em máquina sem Ollama, download, assinatura do instalador oficial, instalação consentida, progresso, limpeza e download do modelo são testados em VM limpa.

### RC-08 — histórico privado e memória local

- [x] Com histórico ligado, nome, configurações e conversas preservados da `0.1.x` aparecem após instalar a `0.2.0-beta.2`.
- [ ] “Lembre que...” cria uma memória explícita, aparece na área de memória e influencia uma resposta posterior.
- [ ] Remover uma memória e limpar todas impedem uso posterior.
- [ ] Com `keepHistory=false`, a conversa continua em RAM durante a sessão, mas reiniciar não grava novas mensagens.
- [ ] No modo privado, os timestamps/hashes de `conversations.json`, `actions.json`, `memory.json` e `app-skills.json` não mudam por causa da conversa privada.
- [ ] Reativar histórico não transforma retroativamente a sessão privada em conteúdo persistido.
- [ ] Corrupção simulada do JSON recupera o último backup válido sem apagar os dados preservados.

### RC-09 — standby durante jogos

- [ ] Um jogo em tela cheia é detectado após a tolerância prevista, sem falso positivo em Brave/Chrome/Codex/Antigravity.
- [ ] O mascote entra em standby, o modo ao vivo para e o modelo selecionado libera VRAM sem fechar o jogo.
- [ ] Ao fechar ou trocar do jogo, o Titi retoma uma vez, sem duplicar Ollama, microfone ou timers.
- [ ] Se o modo ao vivo estava desligado antes do jogo, permanece desligado depois.
- [ ] Medir CPU/RAM/VRAM na máquina-alvo Ryzen 5 5600, 32 GB e RTX 2060 Super durante idle, conversa e jogo.

## Checklist específico para a máquina do usuário

Como a versão antiga já foi desinstalada e os dados ficaram preservados, executar nesta ordem:

1. Antes da instalação, registrar apenas tamanho, timestamp e hash dos JSONs em `%APPDATA%\titi-desktop`, sem copiar o conteúdo para o release.
2. Instalar `Titi-Setup-0.2.0-beta.2.exe` como usuário comum e observar se algum console aparece.
3. Confirmar que o onboarding não reinicia indevidamente, o nome do mascote e as configurações continuam, e as conversas antigas podem ser abertas.
4. Confirmar que novos arquivos `actions.json`, `memory.json` e `app-skills.json` só surgem quando a respectiva função é usada e a privacidade permite.
5. Rodar a matriz real de Spotify, Brave, Codex/ChatGPT e Antigravity.
6. Rodar três turnos do modo ao vivo pelo mascote e um turno de aperte-para-falar.
7. Testar standby com um jogo real e observar processos/VRAM.
8. Reiniciar o Windows, abrir novamente e repetir uma ferramenta e um turno de voz.
9. Recalcular os hashes dos dados e verificar que apenas arquivos esperados mudaram.

Resultado histórico do smoke de instalação em 15/08/2026: os itens 2 e 3 passaram no candidato anterior à UI Automation. Após a abertura, `settings.json` tinha 533 bytes e SHA-256 `8C73FF7496583D3A85BE5273E6039A282F8D97E17A842EFE4B244184A703269A`; `conversations.json` tinha 20.295 bytes e SHA-256 `90CA931029E10F3CD51D1062EA8F2D616FBE632FC6E1D8CE97F16DC52144FCAA`. Esses hashes são referência histórica; o instalador atual ainda precisa repetir o smoke.

## Gates automatizados finais

Executar sobre o commit exato usado para empacotar:

```powershell
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
pnpm qa:ollama-tools
pnpm package:win
pnpm verify:package
```

Além do código 0:

- nenhum teste ignorado, flaky ou dependente da ordem;
- CI verde em runner Windows limpo;
- qualquer alteração depois do empacotamento invalida o candidato e exige repetir build, testes, assinatura e hashes;
- [x] o script de verificação inspeciona os recursos obrigatórios do Whisper e os marcadores funcionais no ASAR;
- anexar ao release o resultado dos testes manuais P0/P1 e o hash final.

## Critério exato para dizer “pode instalar”

Só orientar o usuário a instalar quando **todos** estes itens forem verdadeiros:

1. existe um instalador final `Titi-Setup-0.2.0-beta.2.exe`, assinado e com hash publicado;
2. a versão interna, `latest.yml`, tag, notas e link de download são `0.2.0-beta.2`;
3. typecheck, 181+ testes, build, QA do modelo, empacotamento e verificação do pacote passam no mesmo candidato;
4. a instalação real sobre os dados preservados passa sem perda de nome, configurações ou conversas;
5. Spotify, Brave e Codex/ChatGPT abrem direto; Antigravity pede confirmação; a UI do Spotify passa no ciclo observar → agir → verificar;
6. modo ao vivo, aperte-para-falar, microfone e mascote passam no Windows real;
7. Ollama e verificações auxiliares nunca exibem consoles e respeitam ownership;
8. histórico privado e memória local passam na inspeção de disco;
9. standby de jogo passa sem retomar microfone/modelo indevidamente;
10. não há P0 aberto nem P1 que contradiga uma função anunciada na landing page.

Se a assinatura ainda não estiver disponível, a mensagem permitida é somente “build privado de teste não assinado”, acompanhada do hash e do aviso de SmartScreen. Isso não atende ao gate de beta público.

### Estado contra esse critério

- **Artefato e integridade beta.2:** aprovado localmente para o hash atual; candidato não assinado.
- **Execução isolada do `win-unpacked` beta.2 atual:** pendente repetir após UI Automation e política beta de confirmação.
- **Instalação NSIS atual sobre dados preservados:** pendente; o smoke anterior validou um binário agora substituído.
- **Smoke funcional real de voz, abertura aprovada dos quatro aplicativos, memória e jogo:** pendente.
- **Assinatura e verificação do download publicado:** pendente.

Portanto, o candidato pode seguir para teste privado de instalação, com hash e aviso explícito de que não é assinado. Ainda não deve substituir o download público nem ser apresentado como versão finalizada.
