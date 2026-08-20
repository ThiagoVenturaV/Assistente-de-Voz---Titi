# Backlog executável do Titi

Este documento é a fonte de verdade do trabalho futuro do produto. O `README.md` resume o estado da branch e seus limites; este backlog registra o que está comprovadamente pronto, o que ainda é parcial e o que precisa ser entregue para um beta completo e confiável.

## Direção do produto

Titi será um assistente de voz para Windows que conversa localmente, abre e opera aplicativos com segurança, delega trabalhos a agentes especializados e reduz o próprio consumo durante jogos. A experiência deve ser gráfica e amigável: nenhum terminal visível, nenhum comando arbitrário escondido e nenhuma ação sensível sem confirmação compreensível.

Princípios obrigatórios:

1. **Local-first e transparente:** dados, logs, voz e modelos permanecem no computador por padrão; qualquer uso de nuvem informa custo, dados enviados e dependência de internet.
2. **A pessoa continua no controle:** Titi mostra o que pretende fazer, pede confirmação conforme o risco e informa o resultado real da ferramenta.
3. **Qualquer aplicativo, com limites seguros:** descoberta e automação não podem equivaler a entregar um terminal irrestrito ao modelo.
4. **Falhar de forma legível:** erros indicam o que ocorreu e como tentar novamente; Titi nunca afirma sucesso sem evidência.
5. **Voz natural com orçamento de produto:** a voz neural local já faz parte do núcleo; qualidade, latência e fallback evoluem sem ultrapassar os portões de segurança, privacidade e confiabilidade.

## Legenda

- **Pronto no código:** implementação integrada com evidência automatizada, ainda sem aprovação no novo instalador.
- **Pronto:** comportamento e critérios foram exercitados no executável empacotado; itens históricos aparecem como **Pronto (base)**.
- **Parcial:** há interface ou implementação inicial, mas o resultado prometido ainda não está completo ou suficientemente testado.
- **Não iniciado:** não há implementação funcional encontrada no baseline.
- **P0:** bloqueia um beta público confiável.
- **P1:** necessário para cumprir a proposta completa do Titi.
- **P2:** evolução após os fluxos essenciais estarem estáveis.
- **P3:** última prioridade deliberada.

## Auditoria multidisciplinar atual — `0.2.0-beta.8`

Auditoria atualizada em 20/08/2026 por frentes de Produto/QA, PO, marketing e copy, com verificação do repositório, candidato, instalação e landing. Este bloco prevalece sobre os registros históricos abaixo.

### Veredito

**A beta.8 é candidata em preparação e ainda não está publicada nem instalada.** A preparação integrada na `main` fecha a política sem modal genérico, adiciona autoteste guiado, diagnóstico privado, recuperação de microfone, acessibilidade e release retomável; o Qwen 4B permanece como perfil rápido e o 9B como opção de qualidade. O gate atual é produzir e provar o NSIS beta 8 exato sem reutilizar artefatos da beta 7.

| Área | Estado atual | Evidência | Lacuna prioritária |
| --- | --- | --- | --- |
| Release e instalação | Candidata · beta.8 não publicada | workflow validado, retomada segura de rascunho, manifesto/checksums e bloqueio de estável não assinada possuem testes | Gerar, instalar e publicar o NSIS beta 8; Authenticode continua `NotSigned`; Windows 10/11 e rollback permanecem |
| Código e CI | Saudável com flake sob carga registrado | typecheck, build e 48 arquivos/423 testes passam; PRs #12/#25 e `main` verdes em checkout Windows limpo | A correção final de inicialização ainda precisa passar pela CI antes da tag; o timeout isolado do `ConversationStore` permanece registrado |
| Linguagem natural e ferramentas | Parcial avançado | Qwen 4B fez 18/19 no corpus e 4/4 no provider; autoteste prova tool calling; alvos perigosos falham fechados e somente Antigravity confirma | Repetir corpus contextual atualizado e ampliar automação observar → agir → verificar |
| Voz local | Parcial avançado | Parakeet incremental e Supertonic DirectML passam no pacote; autoteste guiado percorre a cadeia e pede confirmação humana do áudio | Faltam 20 turnos reais, dispositivos distintos, eco/recaptura e “pare” em todas as fases no instalado |
| App instalado | Beta.8 local aprovada | NSIS beta.8 corrigido preservou ações, conversas e configurações; ASAR instalado coincide; janela, histórico, 2 telas, autoteste e X do mascote foram verificados | Falta confirmação humana de microfone/áudio no autoteste e repetir ações externas reais |
| Landing | Beta.7 pública · política v22 | Sites v22 está pública com política correta do beta; candidata beta.8 compila e passa 5 testes, mas não será publicada antes da release | Publicar link beta.8 só após validar o ativo anônimo; contraste manual e prova real permanecem |
| Governança | Pronto no código | README, release, QA, backlog e marketing são conferidos pelo script; Issues #9/#10/#11 espelham Now/Next/Later | Atualizar evidências finais após NSIS/tag e adicionar donos quando houver equipe fixa |

### Fila executiva recomendada

**Now — beta.8 de confiança:** `TITI-SEC-003`, `TITI-CANCEL-001`, `TITI-GAME-001`, `TITI-VOICE-001/003`, `TITI-DIST-001`, `TITI-QA-001`, `TITI-INSTALL-001`, `TITI-ACC-001`, `TITI-PRIV-002`, `TITI-GOV-001` e `TITI-MKT-001`.

**Next — beta.8/9:** assinatura e updater, automação observar → agir → verificar, catálogo/ambiguidades, avaliação contínua, componentes do runtime, diagnóstico, desempenho, suporte/feedback, SEO, voz interrompível, ditado universal, receitas/perfis, conectores MCP e cockpit de tarefas.

**Later:** provedores/API/OAuth, delegação a agentes de código, navegador avançado, sincronização opcional, i18n, palavra de ativação, recursos assistivos e automação determinística.

### Escopo da implementação atual

- **Excluídos intencionalmente nesta fase:** `TITI-MEET-001` (modo de reunião) e `TITI-REMOTE-001` (cliente remoto).
- **Motivo:** manter a entrega no Windows local, reduzir risco de privacidade e fechar os pontos críticos de confiança primeiro.
- **Decisão de reteste:** retomar apenas com sinal verde explícito de segurança, UX e estabilidade.

### Radar competitivo e backlog inspirado — 17/08/2026

Pesquisa feita nas páginas oficiais dos produtos. A tabela registra padrões úteis, não afirma equivalência técnica nem recomenda copiar interface, marca ou política de dados. A vantagem que o Titi deve preservar é combinar essas ideias com execução local, linguagem natural em pt-BR, transparência e ação verificável no Windows.

| Referência | Recurso observado | Oportunidade para o Titi | Destino |
| --- | --- | --- | --- |
| [Perssua Voice](https://perssua.com/en/blog/perssua-v0210-voice-assistant) | conversa de voz interrompível, troca automática de idioma, busca de sessões e encerramento por fala | barge-in local, idioma por turno e encerramento natural sem depender de frase exata | `TITI-VOICE-004` |
| [Perssua MCP](https://perssua.com/en/blog/perssua-v0220-mcp-implementation) | Google Calendar, Drive, Gmail, Docs e Sheets via MCP/OAuth, com ações sugeridas e tokens locais | conectores por escopo, leitura antes de escrita e resultado traduzido para linguagem humana | `TITI-MCP-001` |
| [ChatGPT Computer Use](https://learn.chatgpt.com/use-cases/use-your-computer-with-codex) | tarefa delimitada entre aplicativos, prompts de permissão, resultado revisável e condução remota | cockpit com plano, progresso e recibo final verificável | `TITI-AGENT-001`, `TITI-SEC-003` |
| [Windows Voice Access](https://support.microsoft.com/en-US/accessibility/windows/voice-access/use-voice-access-on-a-multi-display-setup) | números e grades sobre a interface, múltiplos monitores, clique, rolagem e arrastar/soltar offline | camada visual determinística quando UI Automation/visão não produz alvo inequívoco | `TITI-ACC-002`, `TITI-AUTO-001` |
| [Copilot Vision](https://support.microsoft.com/en-us/microsoft-copilot/using-copilot-vision-with-microsoft-copilot) | conversa por voz sobre a tela em modo de orientação, sem agir diretamente | modo **observar e explicar** separado de **agir**, útil para confiança e aprendizado | `TITI-AGENT-001`, `TITI-TRUTH-001` |
| [Open Interpreter 01](https://01.openinterpreter.com/software/introduction) | arquitetura cliente/servidor, modelos substituíveis, perfis, skills e clientes de voz | receitas modulares e perfis de uso sem acoplar tudo ao renderer | `TITI-SKILL-001` |
| [Talon](https://talonvoice.com/docs/) | comandos por aplicativo, scripts, voz, ruídos e rastreamento ocular | perfis que mudam por aplicativo e entradas assistivas combináveis | `TITI-SKILL-001`, `TITI-ACC-002` |
| [VoiceAttack](https://voiceattack.com/) | perfis/macros, gatilhos por voz, teclado, mouse ou joystick, foco em jogos e TTS dinâmico | editor seguro de receitas, perfis para jogos e gatilhos alternativos | `TITI-SKILL-001`, `TITI-GAME-001` |
| [Wispr Flow](https://docs.wisprflow.ai/articles/4678293671-feature-context-awareness) | ditado em qualquer app, contexto próximo ao cursor, estilo por aplicativo e dicionários | modo de ditado global separado do agente, com contexto mínimo, opt-in e vocabulário local | `TITI-DICT-001` |
| [Home Assistant Assist](https://developers.home-assistant.io/docs/voice/pipelines/) | pipeline explícito, palavra de ativação, VAD, supressão de ruído, ganho e satélites | wake word local opcional e melhor tratamento de áudio para estabilidade | `TITI-WAKE-001` |
| [Jan](https://www.jan.ai/docs/desktop/quickstart) e [LM Studio](https://lmstudio.ai/docs/developer/rest) | catálogo de modelos, indicação de compatibilidade, download simples, local/nuvem, MCP, carregar/descarregar e TTL | transformar a seleção atual em um hub compreensível por hardware, capacidade e custo | `TITI-PROV-002`, `TITI-RUNTIME-PACK-001`, `TITI-MCP-001` |

#### TITI-VOICE-004 — Conversa full-duplex e interrupção natural

- **Prioridade/estado/trilha:** P1 · Não iniciado · Voz + UX + Performance
- **Inspiração validada:** Perssua permite interromper, continuar e mudar de direção durante a fala; a experiência oficial de voz da OpenAI também trata sobreposição como parte da conversa.
- **Resultado:** a pessoa fala por cima do Titi, corrige a intenção ou encerra a conversa sem procurar botão nem decorar comando.
- **Aceite:**
  - [ ] fala do usuário interrompe o TTS em até 250 ms e a nova transcrição passa a ser a intenção vigente;
  - [ ] echo cancellation/ducking impede a própria voz do Titi de virar comando;
  - [ ] VAD distingue pausa curta, fim de turno e interrupção com orçamento medido por hardware;
  - [ ] idioma é detectado por turno, preservando nomes próprios, aplicativos e termos técnicos;
  - [ ] “espera”, “para”, “cancela”, correções e mudança de direção funcionam em 20 turnos E2E;
  - [ ] indisponibilidade do full-duplex recua para turnos alternados sem fingir que ouviu.

#### TITI-DICT-001 — Ditado universal contextual e privado

- **Prioridade/estado/trilha:** P1 · Não iniciado · Voz + Desktop + Privacidade
- **Resultado:** ditar texto em qualquer campo do Windows sem obrigar o agente a responder ou executar uma tarefa.
- **Aceite:**
  - [ ] atalho global inicia/encerra o ditado e insere texto somente no campo que estava focado;
  - [ ] contexto do aplicativo e texto próximo ao cursor são opcionais, mínimos, exibidos e nunca lidos em senha/pagamento;
  - [ ] dicionário pessoal, pronúncias, aliases e correções aprendidas ficam locais, editáveis e apagáveis;
  - [ ] perfis aplicam pontuação, tom e formatação por categoria de app sem reescrever silenciosamente o sentido;
  - [ ] modo código preserva símbolos, indentação e nomes técnicos em um conjunto declarado de editores;
  - [ ] desfazer remove exatamente a última inserção do Titi e nenhuma outra edição do usuário.

#### TITI-SKILL-001 — Receitas, perfis e skills inspecionáveis

- **Prioridade/estado/trilha:** P1 · Não iniciado · Produto + Automação + Segurança
- **Resultado:** transformar rotinas repetidas em recursos reutilizáveis sem entregar shell irrestrito ao modelo.
- **Aceite:**
  - [ ] usuário grava ou monta uma receita apenas com ferramentas tipadas e alvos observados;
  - [ ] perfil pode ativar por aplicativo, janela, jogo ou comando explícito, sempre com indicador visível;
  - [ ] cada skill declara entradas, efeitos, permissões, aplicativos permitidos e condições de sucesso;
  - [ ] simulação mostra os passos antes de habilitar e teste prova resultado sem efeito de alto risco;
  - [ ] importação/exportação é legível, versionada, sem segredos e passa pela mesma política de risco;
  - [ ] histórico permite desativar e restaurar a última versão funcional.

#### TITI-MCP-001 — Hub de conectores e ferramentas

- **Prioridade/estado/trilha:** P1 · Não iniciado · Integrações + Segurança + Onboarding
- **Dependências:** `TITI-SEC-003`, `TITI-PRIV-002`, `TITI-PROV-001` e `TITI-PROV-004` quando houver OAuth oficial.
- **Resultado:** conectar serviços e dados por padrão aberto sem criar uma integração rígida para cada fornecedor.
- **Aceite:**
  - [ ] catálogo distingue MCP local/remoto, origem, mantenedor, dados acessados e ações possíveis;
  - [ ] conexão começa em leitura; escrita/envio/criação exige escopo e política específicos;
  - [ ] OAuth usa navegador e domínio oficiais; tokens ficam no Credential Manager e nunca chegam ao modelo/log;
  - [ ] conteúdo retornado é dado não confiável e não pode elevar permissões nem reconfigurar o Titi;
  - [ ] timeout, cancelamento, limite de chamadas e recibo de cada ferramenta aparecem na conversa/atividade;
  - [ ] primeiro piloto cobre calendário e notas locais antes de Gmail/Drive com escrita.

#### TITI-AGENT-001 — Cockpit de tarefas longas e verificáveis

- **Prioridade/estado/trilha:** P1 · Não iniciado · Harness + UX + Segurança
- **Resultado:** tarefas com vários passos deixam de parecer uma resposta travada e passam a ser acompanháveis e controláveis.
- **Aceite:**
  - [ ] cartão mostra objetivo, passos, tempo decorrido, ferramenta atual, itens concluídos e bloqueio;
  - [ ] usuário pode pausar, retomar, corrigir direção, assumir o controle ou cancelar imediatamente;
  - [ ] modo **observar e explicar** nunca executa; mudar para **agir** é uma transição explícita;
  - [ ] checkpoints permitem recuperar tarefa após reinício sem repetir efeitos já confirmados;
  - [ ] notificação local informa conclusão ou atenção, sem executar ação sensível em segundo plano;
  - [ ] recibo final separa planejado, executado, verificado, não confirmado e falhou.

#### TITI-WAKE-001 — Palavra de ativação local e áudio robusto

- **Prioridade/estado/trilha:** P2 · Descoberta · Voz + Privacidade + Performance
- **Resultado:** experiência mãos livres opcional sem transmitir áudio continuamente nem esconder quando o microfone está ativo.
- **Aceite:**
  - [ ] wake word roda localmente, vem desligada por padrão e possui indicador e mute global inequívocos;
  - [ ] VAD, supressão de ruído, ganho automático e sensibilidade têm teste/prévia e padrões conservadores;
  - [ ] benchmark mede falso despertar, perda de ativação, CPU/GPU, bateria e ruído em pt-BR;
  - [ ] áudio anterior à ativação não é persistido nem entregue ao LLM;
  - [ ] standby, tela bloqueada, reunião e jogo têm políticas explícitas;
  - [ ] falha recua para atalho/aperte-para-falar sem deixar captura órfã.

#### TITI-ACC-002 — Grade, números e entradas assistivas

- **Prioridade/estado/trilha:** P2 · Descoberta · Acessibilidade + Automação
- **Resultado:** oferecer um caminho determinístico quando voz natural, UI Automation ou visão não identificarem o alvo.
- **Aceite:**
  - [ ] “mostrar números” rotula controles acionáveis em todas as telas e respeita DPI/escala;
  - [ ] grade permite clique, clique duplo, botão direito, rolagem e arrastar/soltar com confirmação visual;
  - [ ] teclado opera integralmente a sobreposição e leitor de tela anuncia monitor/alvo;
  - [ ] suporte opcional a ruídos, gaze ou head tracking depende de hardware e consentimento explícitos;
  - [ ] sobreposição nunca aparece em captura/exportação sem indicação e some imediatamente ao cancelar;
  - [ ] matriz real cobre dois monitores, escalas distintas, tela cheia e alto contraste.

### Novos itens resultantes da auditoria

#### TITI-SEC-003 — Limite seguro da automação genérica

- **Prioridade/estado/trilha:** P0 · Parcial · Segurança + Automação
- **Problema:** `computer_action` executa clique sem confirmação em qualquer controle observado de um aplicativo não bloqueado; o nome do alvo não é classificado por efeito. Um controle “Comprar”, “Enviar”, “Publicar” ou “Excluir” pode ultrapassar a política declarada do beta.
- **Resultado:** manter execução direta apenas para ações comprovadamente reversíveis e de baixo risco, sem reintroduzir confirmação genérica em tudo.
- **Aceite:**
  - [x] lista fechada bloqueia ferramentas sem metadado de risco antes de execução e exige decisão por política;
  - [x] comprar, enviar, publicar, excluir, credenciais, pagamento e mudança de conta falham fechados antes do clique;
  - [x] texto observado continua dado não confiável e nunca concede autorização;
  - [x] testes de prompt injection e nomes enganosos provam ausência de efeito;
  - [x] Antigravity continua exigindo confirmação e alvos protegidos continuam bloqueados.

#### TITI-GOV-001 — Fonte de verdade e governança de release

- **Prioridade/estado/trilha:** P0 · Parcial avançado · Produto + PO + Release
- **Problema:** backlog, marketing, QA, landing e release repetem critérios e já divergiram em versão, política de confirmação, voz e estado das ferramentas.
- **Resultado:** uma fonte de verdade atual orienta produto, comunicação e suporte.
- **Aceite:**
  - [x] referências ativas usam a beta atual; trechos beta.1/beta.3 estão rotulados como históricos;
  - [ ] cada item possui estado, dono, versão-alvo, dependências e evidência reproduzível;
  - [x] script compara versão/download entre `package.json`, landing, release e documentação;
  - [x] QA contém somente o gate atual e links para relatórios históricos;
  - [x] GitHub Issues espelha o Now/Next/Later nos rastreadores públicos [#9](https://github.com/ThiagoVenturaV/Assistente-de-Voz---Titi/issues/9), [#10](https://github.com/ThiagoVenturaV/Assistente-de-Voz---Titi/issues/10) e [#11](https://github.com/ThiagoVenturaV/Assistente-de-Voz---Titi/issues/11).

#### TITI-MKT-001 — Promessa pública ligada à evidência

- **Prioridade/estado/trilha:** P0 · Pronto no código · Marketing + Produto + QA
- **Problema:** a landing usa “TUDO LOCAL”, “ação concluída” e fluxos de voz no presente enquanto parte dos smokes reais permanece aberta; o primeiro CTA não mostra tamanho, download adicional nem ausência de assinatura.
- **Resultado:** cada promessa pública é comprovada ou explicitamente marcada como beta/visão.
- **Aceite:**
  - [x] `docs/PUBLIC_PROMISES.md` liga as afirmações da landing a testes e limites do app instalado;
  - [x] absolutos foram substituídos por “núcleo local”/“localmente por padrão”, com os usos de internet explicados;
  - [x] antes do primeiro download aparecem versão, tamanho aproximado de 852 MiB, Windows suportado, aproximadamente 2,5 GB adicionais, ausência de assinatura/SmartScreen, notas e integridade; tamanho exato só entra após o ativo final;
  - [x] a ilustração é identificada como demo do beta e usa resultado verificado somente nos fluxos cobertos;
  - [x] headline principal e metadata preservam a mesma frase-mãe.

#### TITI-PRIV-002 — Política pública local-first

- **Prioridade/estado/trilha:** P0 · Parcial avançado · Privacidade + Produto + Marketing
- **Resultado:** a pessoa entende o que fica local, o que é persistido, o que usa internet e como apagar.
- **Aceite:**
  - [x] política pública cobre áudio, transcrição, conversa, memória, atividade, screenshots em memória, downloads, pesquisa/navegação e diagnóstico;
  - [x] links aparecem no primeiro bloco de confiança, rodapé, onboarding e configurações;
  - [ ] modo privado não altera hashes dos stores persistentes em teste instalado;
  - [x] o beta atual não possui upload automático, telemetria nem fingerprint; qualquer integração futura exige opt-in específico e revogável.

#### TITI-VOICE-003 — Aperte-para-falar seguro e operável por teclado

- **Prioridade/estado/trilha:** P0 · Parcial avançado · Voz + Acessibilidade + Renderer
- **Problema:** o botão atual depende de `pointerdown/up/leave`, sem captura de ponteiro, `pointercancel`, blur global ou limite máximo; Space/Enter também não têm comportamento equivalente. A landing diz “Diga ‘parar’”, mas o reconhecedor não aceita a palavra isolada.
- **Aceite:**
  - [x] capturar o ponteiro e encerrar em `pointerup`, `pointercancel`, perda de foco, desmontagem e timeout máximo de segurança;
  - [x] toque, mouse e Space/Enter iniciam/encerram a mesma máquina de estados sem gravação presa;
  - [x] `parar` isolado funciona somente quando o modo ao vivo está ativo, com testes de falsos positivos;
  - [x] permissão removida ou dispositivo perdido encerra captura e modo ao vivo, cancela o stream e oferece recuperação legível;
  - [ ] E2E prova nenhuma gravação ou reinício atrasado após qualquer encerramento.

#### TITI-EVAL-001 — Avaliação contínua de linguagem natural e voz

- **Prioridade/estado/trilha:** P1 · Parcial · IA + Voz + QA
- **Evidência atual:** existem QA de 19 cenários de tool calling, integração pelo `OllamaProvider` real, A/B pela interface instalada e smokes controlados de Parakeet/Supertonic. Em 16/08/2026, `qwen3:4b-instruct` fez 18/19 no contrato, 4/4 no provedor em cerca de metade do tempo do `qwen3.5:9b` e venceu o teste pelo aplicativo; por isso virou o perfil rápido padrão, mantendo o 9B como opção de qualidade. `nemotron-mini:4b` foi descartado por incompatibilidade. Detalhes em `docs/OLLAMA_AGENT_MODEL_BENCHMARK.md`.
- **Aceite:**
  - [ ] corpus pt-BR versionado cobre sotaques, ruído, correções, referência, negação, números, nomes de apps e pedidos sem ação;
  - [ ] release registra WER, latência de parcial/final, acerto de ferramenta, falso efeito e tempo de TTS;
  - [ ] regressão acima do orçamento bloqueia a release;
  - [ ] amostras reais só entram com consentimento e redação documentados.

#### TITI-RUNTIME-PACK-001 — Componentes e armazenamento do runtime

- **Prioridade/estado/trilha:** P1 · Parcial · Runtime + Release + UX
- **Resultado:** instalador/modelos grandes são compreensíveis, reparáveis e atualizáveis.
- **Aceite:**
  - [ ] UI mostra espaço por Parakeet, Supertonic e modelo de conversa antes de baixar/instalar;
  - [ ] componentes têm hash, licença, versão, reparar e remover;
  - [ ] downloads retomam e removem parcial ao cancelar;
  - [ ] decisão entre embutido e opcional é medida por sucesso de onboarding e custo de atualização.

#### TITI-GROWTH-001 — Beachhead, prova real e loop seguro de beta

- **Prioridade/estado/trilha:** P1 · Não iniciado · Marketing + Produto + Suporte
- **Resultado:** aprender com o público certo sem fingir adoção nem coletar conteúdo sensível.
- **Aceite:**
  - [ ] definir ICP primário/secundário, três jobs-to-be-done, objeções e “não é para”;
  - [ ] vídeo de 30–60 s usa o build público e três fluxos reproduzíveis, com legenda e estado real;
  - [ ] feedback coleta versão, Windows, etapa e código de erro, avisando para não enviar áudio, conversa, tokens ou caminhos pessoais;
  - [ ] métricas agregadas de visita → clique → download não usam conteúdo, fingerprint ou identificador persistente.

#### TITI-SEO-001 — Fundamentos de descoberta e confiança

- **Prioridade/estado/trilha:** P1 · Parcial avançado · Marketing + Web + Legal
- **Aceite:**
  - [x] canonical, `og:url`, `og:site_name`, robots, sitemap e `SoftwareApplication` JSON-LD aparecem no HTML público;
  - [ ] repositório possui descrição, homepage, tópicos e licença detectável coerente com `package.json`;
  - [x] rota de suporte e política de privacidade são encontráveis no rodapé;
  - [ ] textos críticos usam tamanho legível e alvos interativos móveis têm ao menos 44 × 44 CSS px;
  - [ ] domínio próprio é avaliado antes da promoção ampla.

#### TITI-QA-FLAKE-001 — Estabilidade de storage sob contenção

- **Prioridade/estado/trilha:** P1 · Parcial · Storage + QA + Performance
- **Evidência:** com suíte desktop e build da landing simultâneos, o caso de 20 mensagens concorrentes excedeu o timeout de 5 s uma vez e deixou teardown atrasado; passou 3/3 isolado, a suíte completa passou depois e as CIs estão verdes.
- **Aceite:**
  - [ ] reproduzir ou descartar a contenção em runner Windows limitado com telemetria de duração, sem conteúdo;
  - [ ] 20 mutações concorrentes preservam todas as mensagens e terminam dentro de orçamento definido por hardware;
  - [ ] teardown aguarda operações de I/O e nunca deixa diretório temporário `ENOTEMPTY`;
  - [ ] dez execuções da matriz de stress passam sem apenas inflar timeout para esconder regressão.

## Histórico preservado — auditoria da branch, release e site `0.2.0-beta.1`

O conteúdo desta seção registra a fotografia de 15/08/2026 e não deve orientar decisões atuais sem confrontar a auditoria beta.7 acima.

Auditoria atualizada em 15/08/2026 sobre `src/`, pacote local, GitHub Release, GitHub Actions e landing hospedada. Na tag publicada, `pnpm test` passou com **22 arquivos e 181 testes**. Na branch de trabalho auditada, `pnpm typecheck` e **24 arquivos/212 testes** passam após as correções de segurança, cancelamento, contexto e microfone; `pnpm package:dir` também gerou e verificou um novo `win-unpacked`. A tag pública `v0.2.0-beta.1` referencia o commit `31a81c8`, cujo workflow **Qualidade** terminou com sucesso. Esses resultados não substituem um novo instalador NSIS, a instalação real nem os testes manuais de voz, jogos e acessibilidade.

| Área | Estado | Evidência atual | Lacuna que permanece |
| --- | --- | --- | --- |
| Aplicativo e instalador Windows | Parcial · pré-release a substituir | GitHub Release publicou `Titi-Setup-0.2.0-beta.1.exe` (544.040.184 bytes); hash publicado e digest do ativo coincidem com `A4E833…21471` | A tag contém instrumentação de QA removida depois; gerar outro pacote, instalar, validar dados, assinar e provar rollback |
| Chat local | Pronto no código | Harness, Ollama, histórico JSON, conversa privada em RAM, orçamento de contexto e cancelamento por pedido estão no novo pacote de diretório | Resumo contínuo e smoke após instalação NSIS |
| Preparação da IA local | Parcial | Detecta, inicia oculto sem shell, reúne inícios concorrentes, respeita endpoint local e descarrega modelo | Cancelar/retomar download, recomendar por hardware e validar máquina limpa |
| Voz local | Parcial | Whisper/modelo, seleção de entrada, medidor de volume, botão Parar e `Esc` estão no novo pacote de diretório; o cancelamento alcança gravação, transcrição, geração, confirmação e fala | Provar 20 turnos, remoção de microfone e interrupção em cada fase no instalado real |
| Mascote | Pronto (base) | Nome personalizado, overlay, estados e botão Ao vivo | Acessibilidade, múltiplos monitores e jogos/tela cheia |
| Tool calling | Parcial | Argumentos, repetição, lote e ciclos são limitados; ledger preserva o resultado real; pedidos podem deixar de aguardar ferramenta/modelo ao cancelar; modelo escolheu 4/4 ferramentas | Efeito externo já iniciado não é reversível; faltam timeout específico e estado explícito para despacho não verificado |
| Abrir aplicativos | Parcial | Catálogo usa Menu Iniciar, apps registrados e pastas confiáveis; no `win-unpacked`, Brave, Spotify, Codex e Antigravity receberam despacho após confirmação | Os quatro despachos por AppID ficaram `verified:false`; falta escolha de ambiguidades, ícones, receita aprendida real, focar/fechar e NSIS |
| Web e mídia | Parcial | Abre HTTP/HTTPS, pesquisa e envia teclas de mídia | Operar páginas com consentimento e identificar a sessão de mídia correta |
| Segurança de ações | Parcial | Toda abertura de app, web e busca externa pede confirmação; credenciais em URL, ferramentas desconhecidas, terminais, comandos e caminhos são bloqueados; IPC principal é validado | Metadados de risco por ferramenta, futuras ações destrutivas, prompt injection e E2E de isolamento no pacote |
| Privacidade | Pronto no código | Modo privado fica em RAM, atividade/memória/aprendizado não persistem, conversas podem ser removidas, limpas e exportadas; JSON usa backup | Provar no executável e documentar migração/recuperação para releases |
| Iniciar com Windows | Parcial | Configuração chama API do sistema ao salvar | Testar instalação, atualização, desativação e múltiplos perfis |
| Standby em jogos | Parcial/experimental | Detector conservador com amostras consecutivas; pausa ao vivo, oculta mascote, descarrega modelo e restaura estado | Lista editável, testes com jogos reais/tela cheia e medição do prazo de 30 segundos |
| Delegação a agentes de código | Não iniciado | Aplicativos apenas podem ser abertos | Enviar tarefa, acompanhar execução e trazer resultado |
| Provedores de IA | Não iniciado | Contrato aceita apenas `ollama` | Onboarding local/API/OAuth, cofre de segredos e troca de provedor |
| Memória local | Parcial | Comandos explícitos salvam fatos/preferências; UI lista/remove/limpa; contexto curado é isolado como dado não confiável | Resumo de conversas, orçamento de contexto, edição e união das receitas de aplicativos com a memória geral |
| Observabilidade local | Parcial | Painel de atividade mostra resultado, confirmação e duração; URL, busca, credenciais e mensagens com endereço são redigidas; modo privado não grava | Exportação do diagnóstico, IDs/tentativas por cadeia e QA no pacote |
| Acessibilidade | Parcial | Foco visível, rótulos, `aria-live`, medidor acessível, alternativa por texto e redução de movimento existem no código | Auditoria integral por teclado/Narrador, contraste e pacote |
| Site e download | Parcial · público | Sites versão 8 está pública; download aponta para a release atual; links visíveis do GitHub foram removidos; faixa animada possui fallback de movimento reduzido; build e 2 testes de render passam | Corrigir “aplicativo aberto”, publicar política de privacidade e automatizar checagem do link/ativo |
| Voz natural | Não iniciado | Fala padrão do Windows | Voz neural local opcional, seleção e controle de recursos |

### Evidência de publicação preservada

- **GitHub Release:** pré-release pública, tag válida `v0.2.0-beta.1`, publicada em 15/08/2026, com instalador, `.blockmap` e `latest.yml`.
- **Integridade:** SHA-256 local, texto das notas e digest do ativo publicado coincidem em `A4E83368A0345BB37289A745116C90087DCA2E69D385BE5CDF0E5023CD921471`.
- **CI:** o commit da tag (`31a81c8`) e o `main` atual (`8505e14`) possuem execução pública bem-sucedida do workflow de tipos, testes e build.
- **Pacote publicado:** o ASAR local correspondente à geração da release declara `0.2.0-beta.1`; Whisper CLI e `ggml-small.bin` estão no `win-unpacked`; instalador e `Titi.exe` estão `NotSigned`.
- **Correção em pacote de diretório:** o commit da tag contém `TITI_CAPTURE_DIR`, `captureQaScreens` e chamadas de `executeJavaScript` para QA. A branch removeu essa rota inteira; o verificador proíbe os marcadores e aprovou o novo `win-unpacked`. Ainda falta gerar e instalar o NSIS corretivo.
- **Site:** Sites informa projeto ativo, público e versão mais recente 8 em `https://titi-assistente.thiago2013ventura.chatgpt.site`; a fonte contém a faixa contínua animada, desativa movimento quando solicitado e não mostra links do GitHub.
- **Limite da evidência:** `%LOCALAPPDATA%\Programs\Titi` não existe nesta auditoria; portanto, o instalador público ainda não foi exercitado nesta máquina após a desinstalação da versão antiga.

### Bloqueios atuais para declarar o produto completo

1. **A pré-release pública precisa ser substituída:** a instrumentação de captura existe no commit da tag. A remoção e o portão que rejeita marcadores de QA estão apenas na branch, ainda sem novo instalador aprovado.
2. **O novo instalador não foi exercitado:** falta provar NSIS, preservação dos dados `0.1.x`, reinício e desinstalação; o binário publicado também não tem assinatura Authenticode.
3. **O estado de abertura ainda é ambíguo:** os AppIDs dos quatro aplicativos foram despachados, mas o executor registrou `ok:true` junto de `verified:false`; produto, modelo, log e landing precisam distinguir “pedido enviado” de “aplicativo confirmado aberto”.
4. **Voz ainda não fechou o P0:** seleção, medidor, botão Parar e `Esc` estão no pacote de diretório; faltam vinte turnos, recuperação real de permissão/erro e prova de cancelamento em cada fase do instalado.
5. **Runtime e standby precisam de prova real:** cancelamento/retomada de download, falhas de espaço/rede, ausência de janelas e jogos em tela cheia ainda não passaram na matriz manual.
6. **QA e acessibilidade do executável estão abertos:** não há E2E instalado de onboarding/chat/modal/voz nem validação completa por teclado e Narrador.
7. **A proposta ampla ainda não está entregue:** automação de interface, delegação a agentes de código, múltiplos provedores e atualização no app permanecem não iniciados.

## Definição de pronto

Um item só muda para **Pronto** quando:

- sucesso, falha, cancelamento e dependência ausente estão cobertos;
- testes unitários/de integração passam e o fluxo crítico é exercitado no executável empacotado;
- nenhum processo ou terminal inesperado aparece;
- ações e falhas são mostradas sem alegar sucesso indevido;
- dados e logs seguem a política local-first;
- README, ajuda e notas da versão refletem o comportamento real;
- atualização por cima da versão anterior preserva configurações compatíveis;
- QA registra evidência reproduzível dos critérios de aceite.

## Portões do beta completo

O beta só pode ser declarado completo quando:

- não houver P0 aberto nem defeito conhecido que cause perda de dados, ação sem consentimento ou terminal inesperado;
- instalação limpa e atualização passarem em Windows 10 22H2 e Windows 11 atual, x64;
- chat, aperte-para-falar, 20 turnos ao vivo e uma ação real de cada classe passarem no app empacotado;
- modo sem histórico, confirmações, exclusão de dados e standby em jogo tiverem evidência funcional;
- instalador publicado tiver procedência verificável, notas de versão e caminho de rollback;
- acessibilidade P0 passar sem bloqueio de teclado ou leitor de tela.

---

## Marco 0 — Base entregue e protegida contra regressão

### TITI-BASE-001 — Aplicativo, mascote e conversa

- **Prioridade/estado:** P0 · Pronto (base)
- **Já entregue:** app gráfico instalável, nome do mascote, overlay animado, chat Ollama e histórico local.
- **Proteção:** smoke test de primeira execução, renomear/ocultar/exibir mascote, chat e reabertura após reinício.

### TITI-BASE-002 — Voz local essencial

- **Prioridade/estado:** P0 · Pronto (base)
- **Já entregue:** Parakeet local incremental, Supertonic 3 INT8 com DirectML/fallback CPU, aperte-para-falar e modo ao vivo pelo app/mascote.
- **Proteção:** preservar o fluxo microfone → transcrição → modelo → fala e a alternativa integral por texto.

### TITI-BASE-003 — Ferramentas iniciais

- **Prioridade/estado:** P0 · Pronto (base)
- **Já entregue:** ferramentas tipadas para abrir apps conhecidos, HTTP/HTTPS, pesquisa, mídia e data/hora.
- **Proteção:** preservar os fluxos conhecidos enquanto o catálogo amplia a descoberta sem aceitar caminho ou comando livre do modelo.

---

## Marco 1 — Beta seguro, honesto e estável

Objetivo: fazer as promessas já visíveis na interface funcionarem de verdade e eliminar riscos de distribuição pública.

### TITI-SEC-001 — Motor central de risco e confirmação

- **Prioridade/estado/trilha:** P0 · Parcial · Segurança + Harness
- **Evidência atual:** `ConfirmationToolExecutor`, broker correlacionado à cadeia e testes de aprovação, recusa, expiração, ferramenta desconhecida e argumentos inválidos. Na política beta.7, ações compatíveis executam direto e somente abrir/controlar Antigravity pede confirmação; `TITI-SEC-003` fecha o risco semântico do clique genérico.
- **Resultado:** toda ferramenta declara risco (`leitura`, `reversível`, `sensível`, `destrutiva`) e passa por uma política única.
- **Aceite:**
  - [x] web, busca, mídia e aplicativos permitidos seguem a política de execução direta da beta;
  - [x] abrir/controlar Antigravity mostra ação, alvo e consequência antes do executor;
  - [x] negar/expirar cancela antes do executor real e devolve o motivo ao modelo;
  - [x] renomear/remover `confirmSensitiveActions` para que o contrato represente a política real e não sugira uma chave genérica enganosa;
  - [x] registro de nova ferramenta exige metadados explícitos de risco e falha fechado se estiverem ausentes;
  - [x] futuras compras, mensagens, publicação, conta e exclusão possuem casos de política antes de serem habilitadas;
  - [x] testes provam que prompt injection ou chamada direta não contornam a política.

### TITI-SEC-002 — Validar IPC, argumentos e origem

- **Prioridade/estado/trilha:** P0 · Parcial · Segurança + Desktop
- **Evidência atual:** origem de janela verificada no processo principal, protocolo empacotado `titi://app` limitado à raiz do renderer, acesso genérico a `file://` desligado, validadores para chat/configurações/áudio/IDs/estados e testes negativos de ferramentas e argumentos.
- **Resultado:** dados do renderer e do modelo não são confiados apenas pela tipagem TypeScript.
- **Aceite:**
  - [x] handlers IPC principais validam origem, formato, tamanho e enums em runtime;
  - [x] URLs bloqueiam credenciais embutidas, `file:`, scripts e protocolos desconhecidos em testes unitários;
  - [x] caminhos/executáveis vêm do catálogo aprovado, nunca de texto livre do modelo;
  - [x] CSP, sandbox, `contextIsolation` e bloqueio de navegação são testados na build;
  - [x] suíte unitária negativa cobre payloads malformados e chamadas desconhecidas.

### TITI-PRIV-001 — Controles de privacidade reais

- **Prioridade/estado/trilha:** P0 · Parcial · Produto + Storage
- **Evidência atual:** testes de conversa transitória, continuação privada, auditoria/memória/aprendizado desativados, exportação/limpeza e recuperação por backup. Falta comprovação no pacote.
- **Resultado:** a escolha da pessoa determina o que é persistido.
- **Aceite:**
  - [x] com histórico desligado, novas conversas ficam só em memória e não são gravadas;
  - [x] ao desligar, usuário escolhe manter ou apagar o histórico anterior;
  - [x] existem apagar conversa, apagar tudo e exportar cópia legível;
  - [x] escrita serializada/backup recuperam interrupção ou corrupção sem apagar tudo silenciosamente;
  - [x] configuração antiga `Space` e campos persistidos inseguros são migrados para padrões seguros em testes;
  - [ ] fixture real de `%APPDATA%` da `0.1.x` migra para `0.2.x` após instalação sem perder nome, preferências ou conversas.

### TITI-VOICE-001 — Fechar o fluxo de voz atual

- **Prioridade/estado/trilha:** P0 · Parcial · Voz + UX
- **Evidência atual:** o renderer separa início, silêncio, transcrição incremental Parakeet, envio, fala Supertonic e reinício; permite selecionar/testar a entrada e possui cancelamento unificado no código. Smokes controlados passam, mas não existe teste E2E com microfone/alto-falante reais nesta release.
- **Resultado:** voz funciona sem sobreposição, travamento ou dependência do botão mantido ativo.
- **Aceite:**
  - [ ] modo ao vivo inicia/termina no app e mascote sem manter **Aperte para falar**;
  - [ ] 20 turnos alternam ouvir → transcrever → responder → falar → ouvir sem capturas simultâneas;
  - [ ] negar/remover microfone mostra recuperação e encerra captura;
  - [x] usuário escolhe entrada e testa microfone/volume na interface; falta prova com hardware real;
  - [ ] fala do Titi não é recapturada como comando em condição normal;
  - [ ] desligar ao vivo em cada etapa (início, gravação, transcrição, modelo e fala) impede qualquer reinício atrasado;
  - [ ] aperte-para-falar atende os critérios de segurança e teclado de `TITI-VOICE-003`.

### TITI-VOICE-002 — Atalho global e interrupção

- **Prioridade/estado/trilha:** P0 · Parcial · Desktop + Voz
- **Evidência atual:** registro seguro de atalho, troca sem perder o anterior, conflito e liberação possuem testes unitários; a integração abre o app mesmo minimizado.
- **Resultado:** o campo de atalho deixa de ser apenas visual.
- **Aceite:**
  - [x] atalho registra/desregistra e preserva o atual quando o novo conflita;
  - [ ] funciona minimizado e pode ser restaurado ao padrão;
  - [x] comando **Parar/Esc** interrompe gravação, reinício do modo ao vivo, fala e resposta ainda não iniciada no código;
  - [x] cancelamento de geração em andamento chega ao provedor e impede resposta tardia em testes;
  - [x] desmontar o renderer cancela gravador e síntese; liberar isso no encerramento real ainda precisa de E2E;
  - [ ] texto da landing “Esc / para encerrar” só permanece após esse fluxo passar no pacote instalado.

### TITI-RUN-001 — Ciclo silencioso e controlado da IA local

- **Prioridade/estado/trilha:** P0 · Parcial · Runtime + Performance
- **Evidência atual:** testes confirmam `shell:false`, `windowsHide:true`, coalescência de inícios, preservação de serviço externo, descarregamento do modelo e respeito ao endpoint configurado.
- **Resultado:** instalar, iniciar, usar, descarregar e encerrar não cria terminais nem processos duplicados.
- **Aceite:**
  - [ ] instalação limpa, início, envios simultâneos e reinício geram zero janelas CMD/PowerShell/Terminal no executável;
  - [x] em teste automatizado, só há um início do mecanismo e pedidos concorrentes acompanham o mesmo;
  - [ ] download do instalador do Ollama pode ser cancelado e remove o parcial;
  - [ ] download do modelo pode ser cancelado/retomado com estado e espaço restante legíveis;
  - [x] processo iniciado pelo Titi é rastreado; serviço que já era externo não é encerrado;
  - [ ] queda de internet retorna erro recuperável e não deixa UI travada;
  - [ ] espaço insuficiente é detectado antes do download e não deixa temporários;
  - [ ] VM limpa comprova download, assinatura oficial, instalação consentida e primeira conversa.

### TITI-HARNESS-001 — Executor resiliente e verificável

- **Prioridade/estado/trilha:** P0 · Parcial · Harness
- **Evidência atual:** testes cobrem ferramenta inválida, JSON/argumentos, exceção, resultado de falha, chamada repetida, cinco rodadas e lote máximo de oito ações.
- **Resultado:** ferramentas têm timeout, cancelamento, idempotência e resultado estruturado comum.
- **Aceite:**
  - [x] cada ferramenta auditada possui ID, horário, duração, argumentos redigidos e resultado;
  - [ ] cadeia possui ID comum, número da rodada/tentativa e relação entre confirmação e efeito;
  - [x] repetição idêntica é bloqueada na mesma cadeia;
  - [ ] cada ferramenta possui timeout próprio e informa se o efeito pode ter ocorrido antes do timeout;
  - [x] modelo recebe o resultado real de sucesso/falha/recusa das ferramentas atuais;
  - [x] limites de cinco rodadas e oito ações terminam com explicação, sem executar o excesso.

### TITI-TRUTH-001 — Estado verificável de ações externas

- **Prioridade/estado/trilha:** P0 · Parcial · Harness + Desktop + Produto
- **Evidência atual:** executável Win32 direto só é aprendido após processo vivo; atalhos e AppIDs retornam `verified:false`. Nas capturas do pacote, os quatro AppIDs foram registrados simultaneamente como `ok:true` e `verified:false`, embora a mensagem textual não afirmasse abertura.
- **Resultado:** interface, modelo, auditoria e site nunca transformam “pedido enviado ao Windows” em “aplicativo aberto”.
- **Aceite:**
  - [ ] contrato diferencia `confirmado`, `despachado_sem_evidencia`, `falhou` e `cancelado` sem depender de texto livre;
  - [ ] `ok:true` só é usado quando a evidência definida para a ferramenta foi satisfeita;
  - [ ] AppID e atalho tentam correlacionar processo/janela alvo dentro de prazo curto sem adotar processo alheio;
  - [ ] estado sem evidência usa visual neutro, não classe de sucesso, e o modelo recebe instrução para não afirmar conclusão;
  - [ ] receita só é salva após evidência positiva e é invalidada quando a origem/processo não corresponde;
  - [ ] mockup e copy pública usam “aplicativo aberto” somente quando o mesmo critério existe no produto.

### TITI-CANCEL-001 — Cancelamento único de voz, modelo e ferramentas

- **Prioridade/estado/trilha:** P0 · Parcial · Harness + Voz + Desktop
- **Evidência atual:** `requestId` e `AbortSignal` percorrem IPC, fila, harness, Ollama e Whisper; botão Parar/`Esc` encerram gravador, timer, fala e confirmação. Testes cobrem cancelamento antes do efeito, geração pendente, ferramenta aguardando e Whisper antes de iniciar.
- **Resultado:** um único comando interrompe a cadeia atual sem reinício tardio nem efeito duplicado.
- **Aceite:**
  - [x] cada envio recebe `AbortSignal` propagado por IPC, harness, provedor e ferramenta compatível;
  - [x] botão visível e tecla `Esc` cancelam gravação, fala e geração com o mesmo estado final no código;
  - [x] confirmação pendente é negada ao cancelar e não executa depois;
  - [x] ferramenta já iniciada informa honestamente se foi interrompida ou se o efeito pode ter ocorrido;
  - [ ] testes cobrem cancelar em cada fase e ausência de mensagem/microfone tardios.

### TITI-OBS-001 — Linha do tempo local de ações

- **Prioridade/estado/trilha:** P0 · Parcial · Produto + Observabilidade
- **Evidência atual:** `ActionLogStore`, executor auditado e seção **Atividade** nas configurações, com testes de ordenação, limpeza, redação e falha de gravação.
- **Resultado:** usuário vê o que Titi tentou, confirmou, executou e recebeu.
- **Aceite:**
  - [x] painel mostra ferramenta, argumentos, confirmação, resultado e duração;
  - [x] segredos, tokens e parâmetros privados conhecidos são redigidos antes de gravar;
  - [x] modo sem histórico não persiste atividade;
  - [x] usuário pode apagar toda a atividade;
  - [x] usuário exporta diagnóstico redigido sem conteúdo de conversa, argumentos, identificadores de dispositivo ou caminhos pessoais;
  - [x] não há integração de telemetria remota no código atual;
  - [ ] se telemetria for criada, possui consentimento separado, revogação e documentação.

### TITI-QA-001 — Harness de QA do executável real

- **Prioridade/estado/trilha:** P0 · Parcial · QA
- **Evidência atual:** typecheck, build e 48 arquivos/423 testes passam na branch; CIs anteriores da `main` estão verdes; verificador, abertura real, instalação e smokes do pacote beta.8 local passam. A auditoria anterior encontrou um timeout isolado do `ConversationStore` sob contenção, registrado em `TITI-QA-FLAKE-001`.
- **Resultado:** testes cobrem o produto instalado, não apenas funções isoladas.
- **Aceite:**
  - [x] unitários cobrem política, storage, ferramentas, runtime Ollama e partes da voz;
  - [x] smoke isolado do `win-unpacked` cobre renderização, chat determinístico, configurações, confirmação e recusa;
  - [ ] E2E instalado cobre onboarding, chat com modelo, ao vivo, erro de microfone e reinício;
  - [ ] smoke do pacote conta janelas/processos para detectar terminal e duplicações;
  - [ ] matriz manual inclui microfone real, múltiplos monitores, suspensão e tela cheia;
  - [ ] cada release guarda relatório e evidências sem dados pessoais.

### TITI-DIST-001 — Build e release reproduzíveis

- **Prioridade/estado/trilha:** P0 · Pronto no código · Release
- **Evidência atual:** a pré-release beta.7 existente foi construída fora do CI. Para a próxima tag, o workflow `Release verificável` empacota em Windows limpo, aplica a política de assinatura, publica somente os ativos validados com manifesto/checksums e baixa tudo novamente para comparar hashes. O script possui testes de tag, manifesto e bloqueio de versão estável não assinada.
- **Resultado:** instalador público corresponde ao código versionado e atualiza com segurança.
- **Aceite:**
  - [x] tag pública válida referencia commit com typecheck, testes e build verdes;
  - [x] release contém instalador, `.blockmap`, `latest.yml`, hash/digest e notas revisadas;
  - [x] workflow de tag empacota o commit exato e anexa somente os artefatos verificados;
  - [ ] artefato possui assinatura Authenticode válida e editor esperado;
  - [x] download publicado é baixado novamente e seu hash é comparado automaticamente;
  - [x] site aponta para o ativo publicado, não rascunho ou arquivo ausente;
  - [x] rollback para a versão anterior utilizável está documentado em `docs/RELEASE_PROCESS.md`;
  - [ ] rollback é exercitado em Windows 10 e 11 limpos.

### TITI-INSTALL-001 — Instalação NSIS e preservação de dados

- **Prioridade/estado/trilha:** P0 · Parcial · Release + QA + Storage
- **Evidência atual:** `0.2.0-beta.7` está instalada nesta máquina, o ASAR declara a versão correta e seu SHA-256 coincide com o pacote auditado; a atualização preservou os hashes de `settings.json`, `conversations.json` e `actions.json`. O instalador continua sem Authenticode e falta a matriz limpa Windows 10/11.
- **Resultado:** instalar, reinstalar e remover o Titi produzem resultado previsível sem perder dados ou abrir consoles.
- **Aceite:**
  - [ ] usuário comum instala o ativo baixado sem CMD/PowerShell/Terminal visível;
  - [x] ASAR instalado declara `0.2.0-beta.7` e contém Parakeet, Supertonic e sprites obrigatórios;
  - [x] atualização beta.6 → beta.7 preserva configurações, conversas e atividade nesta máquina;
  - [ ] fixture real de `0.1.x` migra em Windows limpo sem repetir onboarding;
  - [ ] abrir/fechar três vezes não cria instâncias duplicadas, janela branca ou processo órfão;
  - [ ] reinstalar a mesma versão preserva dados e atalhos sem criar instalação paralela;
  - [ ] desinstalação explica se mantém/apaga dados e cumpre a escolha;
  - [ ] resultado e hashes dos arquivos esperados são anexados ao relatório de QA sem conteúdo pessoal.

**Saída do Marco 1:** todos os P0 acima aprovados no instalador sem regressão em `TITI-BASE-*`.

---

## Marco 2 — Controlar o PC de forma ampla e segura

Objetivo: sair da lista fixa de aplicativos e cumprir a proposta de usar o computador por voz sem expor execução arbitrária.

### TITI-APP-001 — Catálogo local de qualquer aplicativo

- **Prioridade/estado/trilha:** P1 · Parcial · Desktop
- **Evidência atual:** catálogo tipado procura Menu Iniciar, `Get-StartApps`, aliases do Windows e, sob demanda, executáveis em raízes confiáveis. Sete cenários automatizados cobrem aprendizado, reaproveitamento, ausência, corrupção e privacidade.
- **Resultado:** Titi encontra aplicativos instalados pelo Menu Iniciar, atalhos e registros do Windows.
- **Aceite:**
  - [ ] catálogo mostra nome, ícone, origem e executável resolvido sem aceitar caminho inventado;
  - [ ] usuário cria aliases como “meu editor” e escolhe quando houver ambiguidade;
  - [x] abrir, detectar ausência, reindexar e reaproveitar receita funcionam nos testes de atalhos/fontes confiáveis;
  - [x] app ainda não conhecido exige confirmação humana antes da descoberta/abertura;
  - [x] lista e receitas ficam locais e não são enviadas pelo catálogo.

### TITI-APP-002 — Focar, minimizar e fechar aplicativos

- **Prioridade/estado/trilha:** P1 · Parcial · Desktop + Segurança
- **Resultado:** controle básico de janelas com alvo inequívoco.
- **Aceite:**
  - [x] alvo usa identidade de processo/janela, não texto parcial inseguro;
  - [ ] fechar confirma quando houver risco de trabalho não salvo;
  - [x] múltiplas janelas geram escolha visível;
  - [x] resultado confirma a janela realmente afetada.

### TITI-AUTO-001 — Automação genérica via Windows UI Automation

- **Prioridade/estado/trilha:** P1 · Parcial · Automação + Segurança
- **Evidência atual:** a ferramenta observa controles acessíveis de todas as telas, retorna alvos tipados e consegue clicar no mesmo ciclo; o fallback visual do Spotify também está integrado. Falta fechar a classificação semântica de risco, digitação, seleção, verificação pós-ação e uma matriz de apps reais.
- **Resultado:** clicar, digitar, selecionar e ler controles acessíveis em diferentes apps por uma camada estruturada.
- **Aceite:**
  - [x] árvore de elementos vira alvos tipados; conteúdo do app é marcado como não confiável;
  - [ ] digitação mostra destino/texto antes de campos sensíveis ou envios;
  - [ ] fluxos passam em navegador, música, editor e um app escolhido pelo usuário;
  - [ ] senha, pagamento, publicação, exclusão e envio falham fechados conforme `TITI-SEC-003`;
  - [ ] resultado diferencia observar, despachar, confirmar efeito e falhar, com nova observação quando necessário;
  - [ ] falha oferece orientação/receita específica sem recorrer a shell irrestrito.

### TITI-WEB-001 — Operação segura do navegador

- **Prioridade/estado/trilha:** P1 · Parcial · Web + Segurança
- **Resultado:** além de abrir páginas, Titi navega, pesquisa, lê a página ativa e interage sob consentimento.
- **Aceite:**
  - [ ] usuário escolhe navegador/perfil e vê quando uma guia está sob controle;
  - [ ] conteúdo da página não altera política nem se passa por comando do usuário;
  - [ ] clicar, preencher e enviar respeitam classificação de risco;
  - [ ] download informa nome, origem, tamanho e destino antes de abrir;
  - [ ] sessão pode ser interrompida imediatamente.

### TITI-MEDIA-001 — Música e mídia sem depender de marca

- **Prioridade/estado/trilha:** P1 · Parcial · Desktop
- **Resultado:** abrir o app de música preferido e controlar a sessão correta do Windows.
- **Aceite:**
  - [ ] preferência é configurável pelo catálogo;
  - [ ] play/pause/próxima/anterior/volume mostram a sessão alvo;
  - [ ] busca usa receita suportada ou explica a limitação;
  - [ ] duas sessões ativas não fazem Titi controlar a errada.

### TITI-CODE-001 — Delegar tarefas a agentes de código

- **Prioridade/estado/trilha:** P1 · Não iniciado · Integrações + Harness
- **Resultado:** comando de voz cria tarefa no agente escolhido, acompanha e traz o resultado.
- **Aceite:**
  - [ ] usuário escolhe Codex, Antigravity ou outro agente disponível;
  - [ ] antes de enviar, Titi mostra instrução, projeto e contexto incluído;
  - [ ] usa canal oficial quando disponível e identifica automação de UI como fallback;
  - [ ] estados enviado/em execução/atenção/concluído/falhou aparecem na conversa;
  - [ ] alterações, comandos perigosos e publicação mantêm confirmações do agente e do Titi.

### TITI-GAME-001 — Standby automático durante jogos

- **Prioridade/estado/trilha:** P0 · Parcial/experimental · Runtime + Produto
- **Evidência atual:** monitor integrado exige amostras consecutivas, possui lista editável na interface, ignora navegadores/vídeo/apresentação conhecidos e testa entrada/saída. Ao entrar, o código desliga o modo ao vivo, oculta o mascote, descarrega o modelo e atualmente aborta a tarefa ativa — comportamento mais forte que a promessa de “pausar”.
- **Resultado:** jogos não disputam GPU/CPU com o modelo e o mascote não cobre a tela.
- **Aceite:**
  - [x] detectar executável em tela cheia ou lista editável na interface;
  - [ ] parar modo ao vivo, ocultar overlay e descarregar modelo já está integrado, mas falta medir até 30 segundos no pacote;
  - [ ] antes do standby, permitir concluir, cancelar ou adiar a tarefa; nunca abortar silenciosamente;
  - [ ] ao sair, restaura UI/modo ao vivo no código; falta E2E e política para tarefas em andamento;
  - [ ] três jogos/modos de tela cheia não geram falso positivo em vídeo/apresentação.

### TITI-MEM-001 — Contexto longo e memória controlável

- **Prioridade/estado/trilha:** P1 · Parcial · Harness + Privacidade
- **Evidência atual:** memória curada local aceita apenas pedidos explícitos de fatos/preferências, deduplica/limita/redige, injeta o contexto como dado não confiável e possui tela para listar, remover e limpar. Modo privado não lê nem grava memória ou receitas.
- **Resultado:** conversas longas não excedem o modelo nem reutilizam contexto indevido.
- **Aceite:**
  - [ ] orçamento de tokens é calculado por provedor e ferramenta;
  - [ ] resumo local preserva decisões e é visível/editável;
  - [x] usuário pode usar modo privado, remover/limpar memórias e impedir uso entre conversas;
  - [ ] testes longos não falham por contexto nem reintroduzem dados apagados.

**Saída do Marco 2:** abrir qualquer app selecionado, executar automação com confirmação, delegar tarefa de código e entrar/sair de standby no pacote.

---

## Marco 3 — Escolha de IA e onboarding para outras máquinas

Objetivo: transformar a decisão local do computador de desenvolvimento em escolha clara e segura para cada usuário.

### TITI-PROV-001 — Contrato real de múltiplos provedores

- **Prioridade/estado/trilha:** P1 · Não iniciado · Harness
- **Resultado:** conversa, streaming, ferramentas, cancelamento e status não dependem do Ollama.
- **Aceite:**
  - [ ] contrato declara capacidades e desabilita incompatibilidades com explicação;
  - [ ] troca não quebra conversas nem mistura credenciais;
  - [ ] timeout, erro, contexto e tool calling têm formato comum;
  - [ ] testes de contrato rodam para cada implementação.

### TITI-PROV-002 — Hardware e opções locais

- **Prioridade/estado/trilha:** P1 · Parcial · Runtime + Onboarding
- **Resultado:** recomendar runtime/modelo por RAM, VRAM, CPU, espaço e Windows, sem hardcode do PC de desenvolvimento.
- **Aceite:**
  - [ ] onboarding mostra download, espaço e desempenho esperado;
  - [ ] suporta Ollama primeiro e só anuncia outros runtimes quando implementados;
  - [ ] incompatibilidade é avisada, com escolha avançada possível;
  - [ ] Ryzen 5 5600/32 GB/RTX 2060 Super recebe a recomendação de desenvolvimento;
  - [ ] detecção funciona offline.

### TITI-PROV-003 — Provedores por chave de API

- **Prioridade/estado/trilha:** P1 · Não iniciado · Segurança + Onboarding
- **Resultado:** cadastrar, testar, trocar e remover chaves sem gravá-las em JSON/logs.
- **Aceite:**
  - [ ] segredo fica no Windows Credential Manager ou cofre equivalente;
  - [ ] UI explica preço, internet, privacidade e dados enviados;
  - [ ] chave é mascarada, removível e nunca aparece no diagnóstico;
  - [ ] teste não inicia cobrança significativa nem envia conversa;
  - [ ] modo local segue disponível sem conta.

### TITI-PROV-004 — OAuth oficial

- **Prioridade/estado/trilha:** P2 · Não iniciado · Produto + Segurança
- **Resultado:** oferecer OAuth somente quando houver fluxo oficial adequado a apps de terceiros.
- **Aceite:**
  - [ ] nenhuma senha é capturada pelo Titi;
  - [ ] navegador mostra domínio, escopos, conta e revogação oficiais;
  - [ ] tokens ficam no cofre e renovam/revogam corretamente;
  - [ ] sem fluxo oficial, opção fica oculta em vez de simular OAuth.

### TITI-ONB-001 — Onboarding comparativo e consentimentos

- **Prioridade/estado/trilha:** P1 · Parcial · Produto + Design
- **Resultado:** primeira execução permite escolher **local**, **API** ou **conectar conta** com expectativas corretas.
- **Aceite:**
  - [ ] opções comparam privacidade, custo, internet, qualidade e impacto no PC;
  - [ ] microfone, início com Windows e downloads são consentimentos separados e adiáveis;
  - [ ] progresso persiste e download grande não reinicia sem ação explícita;
  - [ ] configuração pode ser alterada sem repetir onboarding;
  - [ ] fluxo completo funciona por teclado/leitor de tela.

**Saída do Marco 3:** máquina nova escolhe opção compatível, conclui configuração, conversa e troca de provedor sem arquivo/terminal.

---

## Marco 4 — Acessibilidade e operação pública

### TITI-ACC-001 — Acessibilidade essencial

- **Prioridade/estado/trilha:** P0 · Parcial avançado · Design + QA
- **Evidência atual:** diálogo inicializa/prende/restaura foco e fecha por Esc; chat, voz e cancelamento têm teclado; status conciso e respostas usam regiões ao vivo; movimento reduzido e alvos essenciais de 44 px possuem teste, e a landing acessível está pública na Sites versão 21. Faltam contraste/Narrador e navegação integral no executável instalado.
- **Resultado:** fluxo principal funciona sem mouse e sem depender de animação, cor ou áudio.
- **Aceite:**
  - [x] diálogo inicializa foco, prende o Tab, fecha por Esc e restaura foco ao gatilho;
  - [x] chat, aperte-para-falar, modo ao vivo e ações principais funcionam com teclado no código;
  - [x] regiões `aria-live` anunciam gravação, progresso conciso e novas respostas sem narrar cada transcrição parcial;
  - [ ] contraste atende WCAG 2.2 AA e estado não depende apenas de cor;
  - [x] **Reduzir movimento** desativa animações não essenciais do app/mascote;
  - [x] transcrição e respostas visíveis permanecem alternativa integral à voz;
  - [x] alvos interativos essenciais do site e do app possuem no mínimo 44 × 44 CSS px no código, com teste estático; falta a matriz manual instalada.

### TITI-OBS-002 — Diagnóstico local e suporte

- **Prioridade/estado/trilha:** P1 · Pronto no código · Observabilidade + Suporte
- **Evidência atual:** Configurações → Atividade mostra o resumo local; a exportação manual possui testes contra conversas, URLs, tokens, caminhos, IDs e argumentos e declara ausência de upload automático. O autoteste guiado percorre microfone, transcrição, inferência, tool calling restrito a `current_datetime` e TTS com confirmação humana de áudio, sem criar conversa.
- **Resultado:** usuário entende e relata problemas sem expor conversas ou segredos.
- **Aceite:**
  - [x] tela mostra versão, hardware resumido, provedor/modelo, áudio, espaço e saúde;
  - [x] **Testar** verifica microfone, transcrição, modelo, fala e ferramenta inofensiva;
  - [x] exportação redige caminhos pessoais, chaves, conversa, argumentos, identificadores e tokens;
  - [x] não existe coleta remota; o relatório declara `automaticUpload: false` e qualquer coleta futura continua condicionada a opt-in separado e revogável.

### TITI-PERF-001 — Orçamento de desempenho e energia

- **Prioridade/estado/trilha:** P1 · Não iniciado · Performance + QA
- **Resultado:** consumo é previsível em idle, conversa, automação e jogo.
- **Aceite:**
  - [ ] medir abertura, RAM/CPU idle, transcrição/resposta e VRAM por perfil suportado;
  - [ ] definir orçamento de release a partir do baseline;
  - [ ] regressão acima do orçamento bloqueia release ou recebe justificativa explícita;
  - [ ] suspensão/retomada não deixa microfone, modelo ou processo preso.

### TITI-UPD-001 — Atualização dentro do aplicativo

- **Prioridade/estado/trilha:** P1 · Não iniciado · Release + Segurança
- **Resultado:** usuário atualiza sem procurar manualmente outro instalador.
- **Aceite:**
  - [ ] consulta release assinada no canal estável/beta escolhido;
  - [ ] informa versão, tamanho e notas antes do download;
  - [ ] valida assinatura/hash e permite adiar;
  - [ ] preserva dados e oferece recuperação se falhar.

### TITI-LAUNCH-001 — Site, documentação e feedback coerentes

- **Prioridade/estado/trilha:** P1 · Parcial · Produto + Marketing + Suporte
- **Evidência atual:** landing beta.7 está pública na Sites versão 22 com política beta coerente; a fonte candidata beta.8 compila e passa cinco testes renderizados, mas seu CTA permanece proibido em produção até a release existir. Licença, metadados, política, suporte e SEO já estão no repositório; faltam contraste manual e ampliação da prova real dos fluxos anunciados.
- **Resultado:** site promete o que o executável entrega e usuário sabe baixar, aprender e reportar.
- **Aceite:**
  - [x] landing aponta para release atual e evita marcas desnecessárias/termos internos;
  - [ ] README, FAQ e onboarding explicam requisitos, downloads, privacidade, atualização e limites;
  - [x] política de privacidade distingue processamento local, persistência e usos de internet;
  - [ ] issue/formulário coleta versão e diagnóstico redigido, nunca segredo;
  - [ ] checklist de lançamento cobre site, repositórios, release, pacote e rollback.

### TITI-I18N-001 — Textos consistentes e traduzíveis

- **Prioridade/estado/trilha:** P2 · Não iniciado · Produto + Frontend
- **Resultado:** UI, sistema e ferramentas usam catálogo único de mensagens.
- **Aceite:**
  - [ ] texto destinado ao usuário não fica espalhado pelas integrações;
  - [ ] português brasileiro e termos de risco são revisados;
  - [ ] estrutura permite novo idioma sem alterar regras de negócio.

**Saída do Marco 4:** beta instalável, atualizável, diagnosticável, acessível e com comunicação pública coerente.

---

## Marco 5 — Qualidade de voz neural local

O backend neural já foi integrado à beta.6. Este marco mede e aprimora a experiência real sem deixar segurança, acessibilidade ou confiabilidade em segundo plano.

### TITI-TTS-001 — Voz neural local opcional

- **Prioridade/estado/trilha:** P1 · Parcial · Voz + Performance
- **Evidência atual:** Supertonic 3 INT8 roda localmente com DirectML e fallback CPU, está incluído no pacote e passa em smokes controlados. Ainda faltam seleção/prévia, orçamento de latência, avaliação humana e E2E de interrupção/eco no instalado.
- **Resultado:** resposta menos robótica, preservando alternativa leve e compatível.
- **Aceite:**
  - [x] pacote atual funciona offline e não envia texto a terceiros;
  - [ ] tamanho, licença, espaço e opção de reparar/remover ficam visíveis;
  - [ ] usuário escolhe voz, ouve prévia e ajusta velocidade; emoção só aparece se suportada;
  - [ ] fala interrompe imediatamente e não é recapturada pelo modo ao vivo;
  - [ ] em jogos/pressão de recursos usa voz leve ou silêncio conforme preferência;
  - [ ] voz do Windows continua como fallback selecionável.

### TITI-TTS-002 — Qualidade e inclusão das vozes

- **Prioridade/estado/trilha:** P1 · Não iniciado · Produto + QA
- **Resultado:** vozes agradáveis para públicos diversos, sem personificação infantil obrigatória.
- **Aceite:**
  - [ ] falantes de pt-BR avaliam inteligibilidade, naturalidade e fadiga;
  - [ ] nomes/prévias não associam qualidade a gênero ou idade do usuário;
  - [ ] números, URLs, siglas, código e mensagens têm pronúncia previsível;
  - [ ] licença permite redistribuição ou download da fonte autorizada.

## Fora do escopo até existir política específica

- terminal ou PowerShell irrestrito exposto diretamente ao modelo;
- instalação silenciosa de software não aprovado/verificado;
- compras, mensagens, publicação ou exclusão em lote sem confirmação por ação;
- microfone escondido/palavra-chave sem indicador visível;
- upload de histórico, lista de apps, áudio ou diagnóstico por padrão;
- promessa de OAuth ou integração sem canal oficial.

## Ordem recomendada

1. **Beta.7 — confiança:** fechar `TITI-SEC-003`, cancelamento/standby honesto, voz E2E, aperte-para-falar por teclado, acessibilidade, privacidade pública e governança da evidência.
2. **Beta.8 — distribuição:** gerar NSIS no workflow de tag, assinar, provar atualização/rollback em Windows 10/11, integrar diagnóstico e definir o updater.
3. **Beta.9 — produto amplo:** completar observar → agir → verificar, catálogo/ambiguidades, mídia/navegador, avaliação contínua, componentes do runtime e orçamento de desempenho/voz.
4. Depois, expandir provedores, APIs/OAuth, agentes de código, i18n, sincronização opcional e receitas compartilháveis conforme demanda comprovada.
