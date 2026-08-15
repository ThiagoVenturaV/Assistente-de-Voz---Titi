# Gate de QA — Titi `0.2.0-beta.1`

Auditoria atualizada em 15/08/2026. Este documento define o que precisa estar comprovado antes de orientar o usuário a instalar a nova versão ou publicar o download como beta público.

## Veredito atual

**A PRÉ-RELEASE PUBLICADA PRECISA SER SUBSTITUÍDA; A CORRETIVA ESTÁ APROVADA SOMENTE COMO `win-unpacked`.** A auditoria encontrou no ASAR público uma rota interna de QA capaz de aprovar confirmações sob uma variável local. A branch removeu toda essa rota e o verificador agora reprova seus marcadores. O novo pacote de diretório passou com as correções de URL/redação, seleção de microfone e cancelamento, mas ainda não existe um NSIS corretivo instalado. O instalador continua `NotSigned` e pode acionar o aviso de reputação do Windows.

O usuário desinstalou a versão anterior. A pasta de instalação foi removida, enquanto configurações e conversas permaneceram em `%APPDATA%\titi-desktop`. Esse é o estado ideal para o teste obrigatório de instalação da nova versão com preservação de dados.

## Evidências desta auditoria

| Verificação | Estado | Evidência em 15/08/2026 |
|---|---|---|
| Versão declarada na fonte | Aprovado | `package.json` declara `0.2.0-beta.1` |
| Typecheck | Aprovado | `pnpm typecheck`, código 0 |
| Testes automatizados | Aprovado na branch | `pnpm test`: 24 arquivos e 212 testes aprovados |
| Build de produção | Aprovado | `pnpm build`: main, preload e renderer compilados; a sandbox bloqueou acesso do esbuild, e a execução normal fora dela passou |
| Seleção de ferramentas pelo modelo | Aprovado no nível de contrato | `pnpm qa:ollama-tools`: 4/4 para Spotify, Brave, Codex e Antigravity; o script não executa efeitos laterais |
| Dados da versão anterior | Preservados | `%APPDATA%\titi-desktop\settings.json` e `conversations.json` existem e contêm JSON válido; a pasta `%LOCALAPPDATA%\Programs\Titi` não existe após a desinstalação |
| Instalador publicado | Reprovado para recomendação | `Titi-Setup-0.2.0-beta.1.exe`, SHA-256 `A4E833…21471`, ainda contém a rota interna de QA |
| Pacote corretivo de diretório | Aprovado | `pnpm package:dir` confirmou `titi-desktop 0.2.0-beta.1`, recursos locais e ausência dos marcadores proibidos |
| Runtime local de voz empacotado | Aprovado | `whisper-cli.exe` com 479.232 bytes e `ggml-small.bin` com 487.601.967 bytes em `win-unpacked/resources/runtime/whisper` |
| Manifesto de release | Aprovado localmente | `release/latest.yml` aponta para `0.2.0-beta.1`, mesmo nome e tamanho do instalador |
| Assinatura do instalador | Risco explícito da pré-release | `Get-AuthenticodeSignature`: instalador e `release/win-unpacked/Titi.exe` estão `NotSigned` |
| Smoke visual empacotado | Aprovado | `win-unpacked` abriu com perfil isolado e gerou capturas de onboarding, home, mascote, configurações, conversa e confirmação |
| Confirmação de ferramenta | Aprovado no pacote | negar “Abra o Brave” impediu o efeito; aprovar Brave, Spotify, Codex e Antigravity registrou `confirmationStatus: approved` e encaminhamento `app-id` |
| Catálogo real do Windows | Aprovado para as fontes requeridas | `Get-StartApps` retornou Brave (`Brave`), Spotify (`SpotifyAB.SpotifyMusic_zpdnekdrzrea0!Spotify`), ChatGPT/Codex (`OpenAI.Codex_2p2nqsd0c76g0!App`), Antigravity e Antigravity IDE |
| Instalação do NSIS | Pendente | o executável do instalador ainda não foi rodado; somente `win-unpacked` foi testado |

## Bloqueadores do candidato

### RC-00 — substituir o pacote público com instrumentação interna

- [x] remover `TITI_CAPTURE_DIR`, `captureQaScreens` e cliques automáticos do processo principal;
- [x] fazer o verificador falhar se qualquer marcador reaparecer no ASAR;
- [x] gerar e verificar um novo `win-unpacked` sem esses marcadores;
- [ ] gerar o NSIS corretivo a partir de commit/tag próprios;
- [ ] instalar, executar a matriz crítica e só então trocar o download público.

### RC-01 — gerar o artefato correto

- [x] Executar `pnpm package:win` em Windows com a árvore de trabalho final.
- [x] Existir `release/Titi-Setup-0.2.0-beta.1.exe` e seu `.blockmap`.
- [x] `release/win-unpacked/resources/app.asar` conter `titi-desktop` versão `0.2.0-beta.1`.
- [x] `pnpm verify:package` terminar com código 0 após o empacotamento.
- [ ] Conferir que nenhum arquivo `0.1.x` será enviado por engano ao release novo.

Os instaladores `0.1.0` e `0.1.1` continuam no diretório local `release/`; o upload deve selecionar explicitamente somente o candidato e seu `.blockmap`.

### RC-02 — alinhar instalador, manifesto e publicação

- [x] `release/latest.yml` declarar `0.2.0-beta.1`, o nome e o tamanho do instalador candidato.
- [x] Calcular o SHA-256 do build atual: `A4E83368A0345BB37289A745116C90087DCA2E69D385BE5CDF0E5023CD921471`.
- [ ] Recalcular e publicar o SHA-256 se o arquivo for assinado, pois a assinatura altera os bytes.
- [x] `RELEASE_NOTES.md`, README e a fonte da landing page identificarem `0.2.0-beta.1`; a landing usa o nome correto do instalador.
- [ ] Título, tag, ativo e link do GitHub Release publicado apontarem para essa mesma versão e arquivo.
- [x] Não anunciar atualização automática: o aplicativo ainda usa atualização manual.

### RC-03 — confiança do executável

- [ ] `Get-AuthenticodeSignature` retornar `Valid` e o editor esperado para o instalador e o executável principal.
- [x] O candidato local foi identificado por tamanho e SHA-256 antes da publicação.
- [ ] O hash publicado corresponder byte a byte ao arquivo baixado do release.
- [x] O Microsoft Defender com proteção em tempo real ativa examinou o instalador final sem registrar detecção correspondente.
- [ ] Nenhum segredo, conversa, arquivo de perfil ou caminho pessoal da máquina de build estar dentro do ASAR ou dos recursos.

Para uma versão estável e recomendada amplamente, assinatura válida continua sendo gate. Esta pré-release pode ser publicada para testadores porque o estado `NotSigned` será informado de forma explícita; o aviso do Windows não deve ser contornado nem descrito como garantia de segurança.

### RC-04 — provar o executável empacotado

- [ ] Instalar como usuário comum sem terminal, PowerShell ou CMD visível.
- [x] Abrir o `win-unpacked` em perfil isolado e confirmar onboarding, home, mascote e configurações sem janela branca.
- [x] Confirmar `0.2.0-beta.1` no ASAR e Whisper completo em `resources`.
- [ ] Abrir o Titi pelo instalador e confirmar `0.2.0-beta.1` no pacote instalado.
- [ ] Confirmar que interface, mascote, sprites, Whisper e voz carregam na instalação final.
- [ ] Fechar e abrir três vezes sem crash, janela branca ou instâncias duplicadas.
- [ ] Executar um smoke contínuo de 30 minutos sem crescimento anormal de CPU, RAM, handles ou processos.

### RC-05 — provar as ferramentas de verdade

O teste do modelo em JSON é necessário, mas não basta. O caminho completo precisa passar pelo `AssistantHarness`, confirmação, auditoria, catálogo do Windows e aplicativo real.

- [x] O modelo selecionou a ferramenta correta em 4/4 prompts para Spotify, Brave, Codex e Antigravity.
- [x] O Windows registrou fontes reais para Brave, Spotify, ChatGPT/Codex, Antigravity e Antigravity IDE.
- [x] No `win-unpacked`, “Abra o Brave” exibiu confirmação e negar impediu o efeito lateral.
- [x] “Abra o Spotify” foi aprovado, encaminhado pelo AppID registrado e o processo ficou em execução.
- [x] “Abra o Brave” foi aprovado, encaminhado pelo AppID registrado e o processo ficou em execução.
- [x] “Abra o Codex” resolveu para ChatGPT/OpenAI Codex; o processo ficou em execução.
- [x] “Abra o Antigravity” resolveu para o AppID registrado; o processo ficou em execução.
- [ ] Um aplicativo recém-instalado e seguro é descoberto pelo nome, pede confirmação antes da primeira abertura e cria `app-skills.json` apenas após sucesso.
- [ ] Na segunda abertura, a receita aprendida é reutilizada sem varrer caminhos desnecessariamente.
- [ ] Aplicativo inexistente retorna falha e nunca diz que foi aberto.
- [ ] Nome ambíguo não abre silenciosamente o candidato errado.
- [ ] `cmd`, PowerShell, caminho `.exe`, argumento de linha de comando e URI não permitida são bloqueados sem processo filho.
- [ ] Negar ou deixar a confirmação expirar não executa efeito lateral.
- [ ] Pesquisa web e pesquisa no aplicativo de música mostram destino/termo antes de abrir.
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

- [ ] Com histórico ligado, nome, configurações e conversas preservados da `0.1.x` aparecem após instalar a `0.2.0-beta.1`.
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
2. Instalar `Titi-Setup-0.2.0-beta.1.exe` como usuário comum e observar se algum console aparece.
3. Confirmar que o onboarding não reinicia indevidamente, o nome do mascote e as configurações continuam, e as conversas antigas podem ser abertas.
4. Confirmar que novos arquivos `actions.json`, `memory.json` e `app-skills.json` só surgem quando a respectiva função é usada e a privacidade permite.
5. Rodar a matriz real de Spotify, Brave, Codex/ChatGPT e Antigravity.
6. Rodar três turnos do modo ao vivo pelo mascote e um turno de aperte-para-falar.
7. Testar standby com um jogo real e observar processos/VRAM.
8. Reiniciar o Windows, abrir novamente e repetir uma ferramenta e um turno de voz.
9. Recalcular os hashes dos dados e verificar que apenas arquivos esperados mudaram.

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

1. existe um instalador final `Titi-Setup-0.2.0-beta.1.exe`, assinado e com hash publicado;
2. a versão interna, `latest.yml`, tag, notas e link de download são `0.2.0-beta.1`;
3. typecheck, 181+ testes, build, QA do modelo, empacotamento e verificação do pacote passam no mesmo candidato;
4. a instalação real sobre os dados preservados passa sem perda de nome, configurações ou conversas;
5. Spotify, Brave, Codex/ChatGPT e Antigravity abrem pelo executável empacotado, com falha honesta e confirmação segura;
6. modo ao vivo, aperte-para-falar, microfone e mascote passam no Windows real;
7. Ollama e verificações auxiliares nunca exibem consoles e respeitam ownership;
8. histórico privado e memória local passam na inspeção de disco;
9. standby de jogo passa sem retomar microfone/modelo indevidamente;
10. não há P0 aberto nem P1 que contradiga uma função anunciada na landing page.

Se a assinatura ainda não estiver disponível, a mensagem permitida é somente “build privado de teste não assinado”, acompanhada do hash e do aviso de SmartScreen. Isso não atende ao gate de beta público.

### Estado contra esse critério

- **Artefato e integridade:** aprovado.
- **Execução isolada do `win-unpacked`:** aprovado para interface e negação segura de uma abertura.
- **Instalação NSIS sobre dados preservados:** pendente.
- **Smoke funcional real de voz, abertura aprovada dos quatro aplicativos, memória e jogo:** pendente.
- **Assinatura e verificação do download publicado:** pendente.

Portanto, o candidato pode ser usado agora no teste privado de instalação. Ainda não deve substituir o download público nem ser apresentado ao usuário como versão finalizada.
