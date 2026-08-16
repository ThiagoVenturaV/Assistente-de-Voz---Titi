# Gate de QA — Titi `0.2.0-beta.3`

Auditoria atualizada em 16/08/2026. Este documento define o que precisa estar comprovado antes de orientar o usuário a instalar a nova versão ou publicar o download como beta público.

## Veredito atual

**A PRÉ-RELEASE PÚBLICA ATUAL É `0.2.0-beta.3`, NÃO ASSINADA.** A beta.3 corrige tool calls indevidas em perguntas conceituais, torna estável a distinção navegador/página e Spotify open/play, preserva contexto entre turnos e expõe os controles observados de forma útil. Permanecem cancelamento, estados honestos, standby, controle opt-in de interfaces, fallback visual local, Parakeet incremental e Supertonic neural local. Por decisão explícita para a beta, ferramentas permitidas executam direto; somente o Antigravity pede confirmação. Typecheck, 306 testes, matriz local 19/19, CI, NSIS, verificação estrutural, instalação preservando o perfil, os dois workers empacotados e os hashes publicados passam. Como o candidato continua `NotSigned`, pode acionar o aviso de reputação do Windows e só deve ser tratado como pré-release para testadores.

Antes do teste, o usuário havia desinstalado a versão anterior: a pasta de instalação foi removida, enquanto configurações e conversas permaneceram em `%APPDATA%\titi-desktop`. A beta.2 foi instalada sobre esse perfil e reabriu os dados existentes.

## Evidências desta auditoria

| Verificação | Estado | Evidência em 16/08/2026 |
|---|---|---|
| Versão declarada na fonte | Aprovado | `package.json` declara `0.2.0-beta.3` |
| Typecheck | Aprovado | `pnpm typecheck`, código 0 |
| Testes automatizados | Aprovado na branch | `pnpm test`: 30 arquivos e 306 testes aprovados |
| Build de produção | Aprovado | `pnpm build`: main, preload e renderer compilados |
| Linguagem natural e seleção de ferramentas | Aprovado no nível de contrato | `pnpm qa:ollama-tools`: 19/19 no Qwen 3.5 9B local, cobrindo as seis ferramentas, aplicativo genérico, pedidos compostos, correções, referências entre turnos, conversa sem efeito e observar → agir; o script não executa efeitos externos |
| Conversa real do provider | Aprovado sem efeitos externos | `pnpm exec vitest run scripts/check-ollama-conversation.test.ts`: 4/4 fluxos sequenciais no `OllamaProvider` real com Qwen 3.5 9B, definições reais das seis ferramentas e executor gravador; comprovou conversa conceitual sem efeito, Spotify composto, correção contextual, web, hora e observar → agir na mesma cadeia |
| Dados da versão anterior | Preservados após o NSIS | A instalação reabriu o nome, as configurações e a conversa anterior; `settings.json` e `conversations.json` continuam presentes em `%APPDATA%\titi-desktop` |
| Instalador publicado | Aprovado como pré-release | tag `v0.2.0-beta.3` aponta para `a0298a2`; EXE, blockmap e `latest.yml` públicos conferem em tamanho e SHA-256, e o download anônimo responde HTTP 200 |
| Pacote corretivo de diretório | Aprovado | `pnpm package:win` regenerou `win-unpacked`; `verify:package` confirmou beta.3, workers, módulos nativos, Parakeet, Supertonic e marcadores funcionais |
| Runtime local de voz empacotado | Aprovado | `ggml-parakeet-tdt-0.6b-v3-q8_0.bin` com 668.757.119 bytes e runtime mínimo de 9.104.960 bytes em `win-unpacked/resources/runtime/whisper`; executáveis de teste e modelos Whisper/VAD não entram no pacote |
| Ensaio local de transcrição pt-BR | Aprovado sem microfone real | voz Microsoft Maria curta transcrita exatamente em 1,21 s; áudio controlado de 55,4 s transcrito por inteiro em 7,81 s, enquanto o Whisper anterior cortou o meio e repetiu o final três vezes; microfone do usuário continua no smoke manual |
| Transcrição incremental | Aprovado com áudio real controlado | 10 revisões em 15 s; primeira parcial em 165 ms, revisão contextual de “Tite” para “Titi” e frase final correta; 306 testes continuam verdes |
| Voz neural empacotada | Aprovado | worker Supertonic executado de dentro do `app.asar` com Electron: 4,9 s de áudio gerados em 0,95 s, WAV de 431.888 bytes; emojis são removidos antes da síntese |
| Automação de interface empacotada | Aprovado estruturalmente | `windows-ui-automation.ps1` com 9.242 bytes em `win-unpacked/resources/runtime`, incluindo UI Automation, captura em memória, recorte ampliado e clique relativo; o verificador exige o recurso e `focusImageBase64` no ASAR |
| Manifesto de release | Aprovado localmente | `latest.yml` declara beta.3, 878.333.160 bytes e SHA-512 correspondente ao NSIS final |
| Assinatura do instalador | Risco explícito | `Get-AuthenticodeSignature` retorna `NotSigned` para o instalador beta.3 e `win-unpacked/Titi.exe` |
| Ensaio visual real do Spotify | Aprovado na fonte | com árvore acessível vazia, o Ollama local identificou Play com 95%, o clique relativo iniciou a reprodução e a inspeção independente mostrou Pause; o recorte ampliado corrigiu a classificação pós-clique para `playing` com 95% |
| Política de confirmação beta | Aprovado automaticamente | web, Spotify, aplicativos e UI permitida executam direto; somente abrir/controlar Antigravity é sensível; alvos protegidos continuam bloqueados |
| Catálogo real do Windows | Aprovado para as fontes requeridas | `Get-StartApps` retornou Brave (`Brave`), Spotify (`SpotifyAB.SpotifyMusic_zpdnekdrzrea0!Spotify`), ChatGPT/Codex (`OpenAI.Codex_2p2nqsd0c76g0!App`), Antigravity e Antigravity IDE |
| Instalação do NSIS atual | Aprovado estruturalmente | o NSIS final beta.3 retornou código 0, o pacote instalado declara beta.3, seu ASAR tem o mesmo SHA-256 `E5FC35…F0314E` do `win-unpacked` e os hashes de `settings.json` e `conversations.json` não mudaram |

## Bloqueadores do candidato

### RC-00 — substituir o pacote público com instrumentação interna

- [x] remover `TITI_CAPTURE_DIR`, `captureQaScreens` e cliques automáticos do processo principal;
- [x] fazer o verificador falhar se qualquer marcador reaparecer no ASAR;
- [x] gerar e verificar um novo `win-unpacked` sem esses marcadores;
- [x] gerar o NSIS beta.3 a partir da fonte final e ligar a tag própria ao commit `a0298a2`;
- [x] instalar sobre o perfil preservado, executar a matriz automatizada crítica e só então trocar o download público; os smokes manuais restantes continuam abaixo.

### RC-01 — gerar o artefato correto

- [x] Executar `pnpm package:win` em Windows com a árvore de trabalho final.
- [x] Existir `release/Titi-Setup-0.2.0-beta.3.exe` e seu `.blockmap`.
- [x] `release/win-unpacked/resources/app.asar` conter `titi-desktop` versão `0.2.0-beta.3`.
- [x] `pnpm verify:package` terminar com código 0 após o empacotamento beta.3.
- [x] Conferir que somente o EXE beta.3, seu blockmap e `latest.yml` foram enviados ao release novo.

Instaladores anteriores continuam no diretório local `release/`; o upload deve selecionar explicitamente somente o EXE beta.3, seu `.blockmap` e `latest.yml`.

### RC-02 — alinhar instalador, manifesto e publicação

- [x] `release/latest.yml` declarar `0.2.0-beta.3`, o nome e o tamanho do instalador candidato.
- [x] Calcular e registrar o SHA-256 do NSIS final: `42458B01E7144B7C03D2CEB0CA355EF8E436D988107E306B9DBCE750B1E32BA1`.
- [ ] Recalcular e publicar o SHA-256 se o arquivo for assinado, pois a assinatura altera os bytes.
- [x] `RELEASE_NOTES.md`, README e a fonte da landing page identificarem `0.2.0-beta.3`; a landing só deve ser publicada depois do release existir.
- [x] Título, tag, ativos e link do GitHub Release publicado apontarem para essa mesma versão e arquivo.
- [x] Não anunciar atualização automática: o aplicativo ainda usa atualização manual.

### RC-03 — confiança do executável

- [ ] `Get-AuthenticodeSignature` retornar `Valid` e o editor esperado para o instalador e o executável principal.
- [x] Identificar o candidato beta.3: 878.333.160 bytes (837,64 MiB) e SHA-256 `42458B…32BA1`.
- [x] O digest SHA-256 publicado pelo GitHub corresponder ao arquivo local e o link anônimo responder HTTP 200.
- [ ] O Microsoft Defender com proteção em tempo real ativa examinar o instalador beta.3 final sem registrar detecção correspondente.
- [ ] Nenhum segredo, conversa, arquivo de perfil ou caminho pessoal da máquina de build estar dentro do ASAR ou dos recursos.

Para uma versão estável e recomendada amplamente, assinatura válida continua sendo gate. Esta pré-release pode ser publicada para testadores porque o estado `NotSigned` será informado de forma explícita; o aviso do Windows não deve ser contornado nem descrito como garantia de segurança.

### RC-04 — provar o executável empacotado

- [x] Instalar o candidato reconstruído como usuário comum sem terminal, PowerShell ou CMD visível.
- [ ] Abrir o `win-unpacked` atual em perfil isolado e confirmar onboarding, home, mascote e a nova configuração de controle sem janela branca.
- [x] Confirmar `0.2.0-beta.3` no ASAR e Parakeet completo em `resources`.
- [x] Instalar o candidato reconstruído e confirmar `0.2.0-beta.3` no pacote instalado.
- [ ] Confirmar visualmente na beta.3 que interface, mascote, histórico e estado local carregam sem janela branca.
- [ ] Testar entrada do Parakeet, microfone e saída de voz na instalação final.
- [ ] Fechar e abrir o candidato atual três vezes sem crash, janela branca ou duplicação da janela principal.
- [ ] Executar um smoke contínuo de 30 minutos sem crescimento anormal de CPU, RAM, handles ou processos.

### RC-05 — provar as ferramentas de verdade

O teste do modelo em JSON é necessário, mas não basta. O caminho completo precisa passar pelo `AssistantHarness`, política beta de confirmação, auditoria, catálogo do Windows, UI Automation e aplicativo real.

- [x] O modelo e a recuperação semântica passaram em 19/19 cenários; as seis ferramentas, correções e referências entre turnos foram selecionadas corretamente, “Spotify não está rodando; abre ele e dá play” resultou em `spotify({ action: "play" })`, e perguntas conceituais não produziram efeito.
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

- [x] Com histórico ligado, configurações e conversas preservadas mantiveram exatamente seus hashes após instalar a `0.2.0-beta.3`.
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
2. Instalar `Titi-Setup-0.2.0-beta.3.exe` como usuário comum e observar se algum console aparece.
3. Confirmar que o onboarding não reinicia indevidamente, o nome do mascote e as configurações continuam, e as conversas antigas podem ser abertas.
4. Confirmar que novos arquivos `actions.json`, `memory.json` e `app-skills.json` só surgem quando a respectiva função é usada e a privacidade permite.
5. Rodar a matriz real de Spotify, Brave, Codex/ChatGPT e Antigravity.
6. Rodar três turnos do modo ao vivo pelo mascote e um turno de aperte-para-falar.
7. Testar standby com um jogo real e observar processos/VRAM.
8. Reiniciar o Windows, abrir novamente e repetir uma ferramenta e um turno de voz.
9. Recalcular os hashes dos dados e verificar que apenas arquivos esperados mudaram.

Resultado estrutural da instalação beta.3 em 16/08/2026: o NSIS retornou código 0 e o `app.asar` instalado declara `0.2.0-beta.3`. Antes e depois, `settings.json` manteve 568 bytes e SHA-256 `2AEB68B48B7505AC29E71D3017E80B139309DBA359E802A329CA1D069E621074`; `conversations.json` manteve 43.581 bytes e SHA-256 `8D30ECB31652C6F896D02F0D04763640837136526B5817206E99B82419DDFE9B`.

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
- [x] o script de verificação inspeciona os recursos obrigatórios do Parakeet e os marcadores funcionais no ASAR;
- anexar ao release o resultado dos testes manuais P0/P1 e o hash final.

## Critério exato para dizer “pode instalar”

Só orientar o usuário a instalar quando **todos** estes itens forem verdadeiros:

1. existe um instalador final `Titi-Setup-0.2.0-beta.3.exe`, com estado de assinatura e hash publicados;
2. a versão interna, `latest.yml`, tag, notas e link de download são `0.2.0-beta.3`;
3. typecheck, 181+ testes, build, QA do modelo, empacotamento e verificação do pacote passam no mesmo candidato;
4. a instalação real sobre os dados preservados passa sem perda de nome, configurações ou conversas;
5. Spotify, Brave e Codex/ChatGPT abrem direto; Antigravity pede confirmação; a UI do Spotify passa no ciclo observar → agir → verificar;
6. modo ao vivo, aperte-para-falar, microfone e mascote passam no Windows real;
7. Ollama e verificações auxiliares nunca exibem consoles e respeitam ownership;
8. histórico privado e memória local passam na inspeção de disco;
9. standby de jogo passa sem retomar microfone/modelo indevidamente;
10. não há P0 aberto nem P1 que contradiga uma função anunciada na landing page.

Sem assinatura, a mensagem permitida é “pré-release de teste não assinada”, acompanhada do hash e do aviso de SmartScreen. Isso pode atender ao beta público para testadores, mas nunca ao gate de versão estável recomendada.

### Estado contra esse critério

- **Artefato e integridade beta.3:** aprovado localmente e no GitHub para o hash atual; pré-release pública não assinada.
- **Execução isolada do `win-unpacked` beta.3 atual:** workers Parakeet e Supertonic aprovados de dentro do pacote; inspeção visual final pendente.
- **Instalação NSIS beta.3 sobre dados preservados:** aprovada para integridade, versão e preservação exata do perfil; microfone/áudio audível e matriz completa de ferramentas permanecem manuais.
- **Smoke funcional real de voz, abertura aprovada dos quatro aplicativos, memória e jogo:** pendente.
- **Verificação do download publicado:** aprovada para tag, commit, três ativos, tamanhos, digests e acesso anônimo; assinatura continua ausente.

Portanto, a beta.3 está publicada para testadores com hash e aviso explícito de que não é assinada. Os smokes manuais restantes continuam impedindo tratá-la como versão estável.
