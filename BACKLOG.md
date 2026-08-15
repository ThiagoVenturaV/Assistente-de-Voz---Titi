# Backlog executável do Titi

Este documento é a fonte de verdade do trabalho futuro do produto. O `README.md` resume o estado da branch e seus limites; este backlog registra o que está comprovadamente pronto, o que ainda é parcial e o que precisa ser entregue para um beta completo e confiável.

## Direção do produto

Titi será um assistente de voz para Windows que conversa localmente, abre e opera aplicativos com segurança, delega trabalhos a agentes especializados e reduz o próprio consumo durante jogos. A experiência deve ser gráfica e amigável: nenhum terminal visível, nenhum comando arbitrário escondido e nenhuma ação sensível sem confirmação compreensível.

Princípios obrigatórios:

1. **Local-first e transparente:** dados, logs, voz e modelos permanecem no computador por padrão; qualquer uso de nuvem informa custo, dados enviados e dependência de internet.
2. **A pessoa continua no controle:** Titi mostra o que pretende fazer, pede confirmação conforme o risco e informa o resultado real da ferramenta.
3. **Qualquer aplicativo, com limites seguros:** descoberta e automação não podem equivaler a entregar um terminal irrestrito ao modelo.
4. **Falhar de forma legível:** erros indicam o que ocorreu e como tentar novamente; Titi nunca afirma sucesso sem evidência.
5. **Voz neural é a última entrega:** a voz atual permanece como alternativa leve até todo o núcleo P0/P1 estar estável.

## Legenda

- **Pronto no código:** implementação integrada com evidência automatizada, ainda sem aprovação no novo instalador.
- **Pronto:** comportamento e critérios foram exercitados no executável empacotado; itens históricos aparecem como **Pronto (base)**.
- **Parcial:** há interface ou implementação inicial, mas o resultado prometido ainda não está completo ou suficientemente testado.
- **Não iniciado:** não há implementação funcional encontrada no baseline.
- **P0:** bloqueia um beta público confiável.
- **P1:** necessário para cumprir a proposta completa do Titi.
- **P2:** evolução após os fluxos essenciais estarem estáveis.
- **P3:** última prioridade deliberada.

## Auditoria da branch de desenvolvimento — candidato 0.2.0-beta.1

Auditoria atualizada em 15/08/2026 sobre `README.md`, contratos compartilhados, código em `src/` e scripts de QA. Nesta branch, `pnpm typecheck` passa e `pnpm test` passa com **22 arquivos e 181 testes**. Isso comprova apenas os comportamentos cobertos pela suíte: as mudanças desta sessão ainda precisam passar pelos testes no aplicativo empacotado antes de serem tratadas como versão entregue ao público.

| Área | Estado | Evidência atual | Lacuna que permanece |
| --- | --- | --- | --- |
| Aplicativo e instalador Windows | Parcial | Electron/React, NSIS, CI de build e verificador do conteúdo do `app.asar` | Gerar o novo instalador, testar instalação limpa/sobre versão anterior, assinar e validar rollback |
| Chat local | Pronto no código | Harness, Ollama, histórico JSON e conversa privada em RAM | Cancelamento de geração, contexto longo e teste no pacote atualizado |
| Preparação da IA local | Parcial | Detecta, inicia oculto sem shell, reúne inícios concorrentes, respeita endpoint local e descarrega modelo | Cancelar/retomar download, recomendar por hardware e validar máquina limpa |
| Voz local | Parcial | Whisper, aperte-para-falar, atalho global, modo ao vivo e fala do Windows | Escolha de entrada, interrupção unificada, 20 turnos e teste real no pacote |
| Mascote | Pronto (base) | Nome personalizado, overlay, estados e botão Ao vivo | Acessibilidade, múltiplos monitores e jogos/tela cheia |
| Tool calling | Pronto no código | Resultado real volta ao modelo; argumentos, repetição, lote e ciclos são limitados; comandos explícitos comuns têm roteamento determinístico | Cancelamento/timeout por cadeia e QA do modelo no executável |
| Abrir aplicativos | Parcial | Catálogo procura Menu Iniciar, apps registrados e pastas confiáveis; receitas verificadas são reaproveitadas somente com histórico ativo | Resolver ambiguidades na UI, ícones, cobertura de mais formatos, focar/fechar e teste empacotado |
| Web e mídia | Parcial | Abre HTTP/HTTPS, pesquisa e envia teclas de mídia | Operar páginas com consentimento e identificar a sessão de mídia correta |
| Segurança de ações | Parcial | Confirmação central para web, buscas externas e apps novos; ferramentas desconhecidas/comandos/caminhos são bloqueados; IPC principal tem validação runtime | Classificação completa de riscos, credenciais em URL, testes contra prompt injection e E2E do modal |
| Privacidade | Pronto no código | Modo privado fica em RAM, atividade/memória/aprendizado não persistem, conversas podem ser removidas, limpas e exportadas; JSON usa backup | Provar no executável e documentar migração/recuperação para releases |
| Iniciar com Windows | Parcial | Configuração chama API do sistema ao salvar | Testar instalação, atualização, desativação e múltiplos perfis |
| Standby em jogos | Parcial/experimental | Detector conservador com amostras consecutivas; pausa ao vivo, oculta mascote, descarrega modelo e restaura estado | Lista editável, testes com jogos reais/tela cheia e medição do prazo de 30 segundos |
| Delegação a agentes de código | Não iniciado | Aplicativos apenas podem ser abertos | Enviar tarefa, acompanhar execução e trazer resultado |
| Provedores de IA | Não iniciado | Contrato aceita apenas `ollama` | Onboarding local/API/OAuth, cofre de segredos e troca de provedor |
| Memória local | Parcial | Comandos explícitos salvam fatos/preferências; UI lista/remove/limpa; contexto curado é isolado como dado não confiável | Resumo de conversas, orçamento de contexto, edição e união das receitas de aplicativos com a memória geral |
| Observabilidade local | Parcial | Painel de atividade mostra resultado, confirmação e duração; segredos são redigidos e o modo privado não grava | Exportação do diagnóstico, IDs/tentativas por cadeia e QA no pacote |
| Acessibilidade | Parcial | Alguns rótulos e alternativa por texto | Teclado, leitor de tela, contraste, movimento e legendas |
| Voz natural | Não iniciado | Fala padrão do Windows | Voz neural local opcional, seleção e controle de recursos |

### Bloqueios atuais para declarar o produto completo

1. **Não há novo instalador aprovado:** as mudanças estão na branch, não em uma release exercitada do começo ao fim.
2. **Voz ainda não fechou o P0:** faltam interrupção unificada, seleção de microfone, vinte turnos ao vivo e recuperação real de permissão/erro.
3. **Segurança ainda é parcial:** URLs com credenciais, classificação das futuras ações destrutivas, prompt injection e isolamento no pacote precisam de cobertura.
4. **Runtime e standby precisam de prova real:** cancelamento/retomada de download, falhas de espaço/rede, ausência de janelas e jogos em tela cheia ainda não passaram na matriz manual.
5. **QA e acessibilidade do executável estão abertos:** não há E2E de onboarding/chat/modal/voz nem validação completa por teclado e Narrador.
6. **A proposta ampla ainda não está entregue:** automação de interface, delegação a agentes de código, múltiplos provedores e atualização no app permanecem não iniciados.

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
- **Já entregue:** Whisper local, fala do Windows, aperte-para-falar e modo ao vivo pelo app/mascote.
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
- **Evidência atual:** `ConfirmationToolExecutor`, broker correlacionado ao modal e testes de aprovação, recusa, expiração, ferramenta desconhecida, navegação, busca de música e descoberta de app novo.
- **Resultado:** toda ferramenta declara risco (`leitura`, `reversível`, `sensível`, `destrutiva`) e passa por uma política única.
- **Aceite:**
  - [x] as ferramentas atuais que enviam dados/abrem destino externo mostram ação, alvo e consequências;
  - [ ] ações destrutivas, compras, mensagens, publicação e conta exigem confirmação por ação;
  - [x] negar/expirar cancela antes do executor real e devolve o motivo ao modelo;
  - [x] `confirmSensitiveActions` é mantido ativo pela configuração e não desliga a barreira;
  - [ ] testes provam que prompt injection ou chamada direta não contornam a política.

### TITI-SEC-002 — Validar IPC, argumentos e origem

- **Prioridade/estado/trilha:** P0 · Parcial · Segurança + Desktop
- **Evidência atual:** origem de janela verificada no processo principal, validadores para chat/configurações/áudio/IDs/estados e testes negativos de ferramentas e argumentos.
- **Resultado:** dados do renderer e do modelo não são confiados apenas pela tipagem TypeScript.
- **Aceite:**
  - [x] handlers IPC principais validam origem, formato, tamanho e enums em runtime;
  - [ ] URLs bloqueiam credenciais embutidas, `file:`, scripts e protocolos desconhecidos;
  - [x] caminhos/executáveis vêm do catálogo aprovado, nunca de texto livre do modelo;
  - [ ] CSP, sandbox, `contextIsolation` e bloqueio de navegação são testados na build;
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
  - [ ] testes cobrem migração de configurações entre versões.

### TITI-VOICE-001 — Fechar o fluxo de voz atual

- **Prioridade/estado/trilha:** P0 · Parcial · Voz + UX
- **Resultado:** voz funciona sem sobreposição, travamento ou dependência do botão mantido ativo.
- **Aceite:**
  - [ ] modo ao vivo inicia/termina no app e mascote sem manter **Aperte para falar**;
  - [ ] 20 turnos alternam ouvir → transcrever → responder → falar → ouvir sem capturas simultâneas;
  - [ ] negar/remover microfone mostra recuperação e encerra captura;
  - [ ] usuário escolhe entrada e testa microfone/volume;
  - [ ] fala do Titi não é recapturada como comando em condição normal.

### TITI-VOICE-002 — Atalho global e interrupção

- **Prioridade/estado/trilha:** P0 · Parcial · Desktop + Voz
- **Evidência atual:** registro seguro de atalho, troca sem perder o anterior, conflito e liberação possuem testes unitários; a integração abre o app mesmo minimizado.
- **Resultado:** o campo de atalho deixa de ser apenas visual.
- **Aceite:**
  - [x] atalho registra/desregistra e preserva o atual quando o novo conflita;
  - [ ] funciona minimizado e pode ser restaurado ao padrão;
  - [ ] comando **Parar/Esc** interrompe gravação, fala e geração;
  - [x] sair libera o atalho global; a liberação de todos os recursos de áudio ainda precisa de E2E.

### TITI-RUN-001 — Ciclo silencioso e controlado da IA local

- **Prioridade/estado/trilha:** P0 · Parcial · Runtime + Performance
- **Evidência atual:** testes confirmam `shell:false`, `windowsHide:true`, coalescência de inícios, preservação de serviço externo, descarregamento do modelo e respeito ao endpoint configurado.
- **Resultado:** instalar, iniciar, usar, descarregar e encerrar não cria terminais nem processos duplicados.
- **Aceite:**
  - [ ] instalação limpa, início, envios simultâneos e reinício geram zero janelas CMD/PowerShell/Terminal no executável;
  - [x] em teste automatizado, só há um início do mecanismo e pedidos concorrentes acompanham o mesmo;
  - [ ] download pode ser cancelado/retomado com estado legível;
  - [x] processo iniciado pelo Titi é rastreado; serviço que já era externo não é encerrado;
  - [ ] falha, pouco espaço ou queda de internet não deixam temporários nem UI travada.

### TITI-HARNESS-001 — Executor resiliente e verificável

- **Prioridade/estado/trilha:** P0 · Parcial · Harness
- **Evidência atual:** testes cobrem ferramenta inválida, JSON/argumentos, exceção, resultado de falha, chamada repetida, cinco rodadas e lote máximo de oito ações.
- **Resultado:** ferramentas têm timeout, cancelamento, idempotência e resultado estruturado comum.
- **Aceite:**
  - [ ] execução possui ID, horário, estado, duração, tentativa e evidência;
  - [ ] timeout não duplica efeito externo; repetição idêntica já é bloqueada na mesma cadeia;
  - [ ] cadeia em andamento pode ser cancelada;
  - [x] modelo recebe o resultado real de sucesso/falha/recusa das ferramentas atuais;
  - [x] limites de cinco rodadas e oito ações terminam com explicação, sem executar o excesso.

### TITI-OBS-001 — Linha do tempo local de ações

- **Prioridade/estado/trilha:** P0 · Parcial · Produto + Observabilidade
- **Evidência atual:** `ActionLogStore`, executor auditado e seção **Atividade** nas configurações, com testes de ordenação, limpeza, redação e falha de gravação.
- **Resultado:** usuário vê o que Titi tentou, confirmou, executou e recebeu.
- **Aceite:**
  - [x] painel mostra ferramenta, argumentos, confirmação, resultado e duração;
  - [x] segredos, tokens e parâmetros privados conhecidos são redigidos antes de gravar;
  - [ ] respeita modo sem histórico e pode ser apagado; falta exportação do diagnóstico;
  - [ ] não há telemetria remota sem consentimento separado e revogável.

### TITI-QA-001 — Harness de QA do executável real

- **Prioridade/estado/trilha:** P0 · Parcial · QA
- **Evidência atual:** typecheck e 181 testes passam; CI Windows executa tipos, testes e build; existem verificadores separados para tool calling do Ollama e conteúdo interno do pacote.
- **Resultado:** testes cobrem o produto instalado, não apenas funções isoladas.
- **Aceite:**
  - [x] unitários cobrem política, storage, ferramentas, runtime Ollama e partes da voz;
  - [ ] E2E cobre onboarding, chat, configurações, ao vivo, confirmação e erro;
  - [ ] smoke do pacote conta janelas/processos para detectar terminal e duplicações;
  - [ ] matriz manual inclui microfone real, múltiplos monitores, suspensão e tela cheia;
  - [ ] cada release guarda relatório e evidências sem dados pessoais.

### TITI-DIST-001 — Build e release reproduzíveis

- **Prioridade/estado/trilha:** P0 · Parcial · Release
- **Evidência atual:** workflow Windows para tipos/testes/build e verificador que compara nome/versão internos e marcadores críticos do `app.asar`. Ainda não há novo artefato desta branch.
- **Resultado:** instalador público corresponde ao código versionado e atualiza com segurança.
- **Aceite:**
  - [ ] CI Windows executa typecheck, testes e build; falta empacotar/publicar a partir de tag válida;
  - [ ] artefato é assinado, tem hash publicado e notas revisadas;
  - [ ] instalação limpa, reinstalação e atualização preservam dados compatíveis;
  - [ ] falha mantém versão anterior utilizável e há rollback documentado;
  - [ ] site aponta só para release publicada, nunca rascunho/arquivo ausente.

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

- **Prioridade/estado/trilha:** P1 · Não iniciado · Desktop + Segurança
- **Resultado:** controle básico de janelas com alvo inequívoco.
- **Aceite:**
  - [ ] alvo usa identidade de processo/janela, não texto parcial inseguro;
  - [ ] fechar confirma quando houver risco de trabalho não salvo;
  - [ ] múltiplas janelas geram escolha visível;
  - [ ] resultado confirma a janela realmente afetada.

### TITI-AUTO-001 — Automação genérica via Windows UI Automation

- **Prioridade/estado/trilha:** P1 · Não iniciado · Automação + Segurança
- **Resultado:** clicar, digitar, selecionar e ler controles acessíveis em diferentes apps por uma camada estruturada.
- **Aceite:**
  - [ ] árvore de elementos vira alvos tipados; conteúdo do app é marcado como não confiável;
  - [ ] digitação mostra destino/texto antes de campos sensíveis ou envios;
  - [ ] fluxos passam em navegador, música, editor e um app escolhido pelo usuário;
  - [ ] senha, pagamento, publicação, exclusão e envio passam por `TITI-SEC-001`;
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
- **Evidência atual:** monitor integrado exige amostras consecutivas, ignora navegadores/vídeo/apresentação conhecidos e possui testes para entrada, saída e jogo configurado sem tela cheia. Ao entrar, o código desliga o modo ao vivo, oculta o mascote e descarrega o modelo.
- **Resultado:** jogos não disputam GPU/CPU com o modelo e o mascote não cobre a tela.
- **Aceite:**
  - [ ] detectar executável em tela cheia ou lista editável; falta UI de lista, contagem e cancelamento;
  - [ ] parar modo ao vivo, ocultar overlay e descarregar modelo já está integrado, mas falta medir até 30 segundos no pacote;
  - [ ] não encerrar download/conversa/tarefa sem avisar e permitir concluir/cancelar;
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

- **Prioridade/estado/trilha:** P0 · Parcial · Design + QA
- **Resultado:** fluxo principal funciona sem mouse e sem depender de animação, cor ou áudio.
- **Aceite:**
  - [ ] ordem/foco visível, atalhos e modais não prendem teclado;
  - [ ] Narrador anuncia gravação, progresso e novas respostas sem repetição excessiva;
  - [ ] contraste atende WCAG 2.2 AA e estado não depende apenas de cor;
  - [ ] **Reduzir movimento** desativa animações não essenciais do app/mascote;
  - [ ] transcrição e respostas visíveis permanecem alternativa integral à voz.

### TITI-OBS-002 — Diagnóstico local e suporte

- **Prioridade/estado/trilha:** P1 · Não iniciado · Observabilidade + Suporte
- **Resultado:** usuário entende e relata problemas sem expor conversas ou segredos.
- **Aceite:**
  - [ ] tela mostra versão, hardware resumido, provedor/modelo, áudio, espaço e saúde;
  - [ ] **Testar** verifica microfone, transcrição, modelo, fala e ferramenta inofensiva;
  - [ ] exportação redige caminhos pessoais, chaves, conversa e tokens;
  - [ ] coleta remota, se existir, é opt-in, revogável e separada do diagnóstico local.

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
- **Resultado:** site promete o que o executável entrega e usuário sabe baixar, aprender e reportar.
- **Aceite:**
  - [ ] landing aponta para release atual e evita marcas desnecessárias/termos internos;
  - [ ] README, FAQ e onboarding explicam requisitos, downloads, privacidade, atualização e limites;
  - [ ] política de privacidade distingue dados locais e nuvem;
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

## Marco 5 — Voz neural natural (última prioridade)

Este marco só começa quando todos os P0 e P1 anteriores estiverem prontos e aprovados. Não deve atrasar segurança, automação, standby, acessibilidade ou distribuição.

### TITI-TTS-001 — Voz neural local opcional

- **Prioridade/estado/trilha:** P3 · Não iniciado · Voz + Performance
- **Resultado:** resposta menos robótica, preservando alternativa leve e compatível.
- **Aceite:**
  - [ ] pacote de voz é baixado sob ação explícita, com tamanho, licença e espaço informados;
  - [ ] funciona offline depois do download e não envia texto a terceiros;
  - [ ] usuário escolhe voz, ouve prévia e ajusta velocidade; emoção só aparece se suportada;
  - [ ] fala interrompe imediatamente e não é recapturada pelo modo ao vivo;
  - [ ] em jogos/pressão de recursos usa voz leve ou silêncio conforme preferência;
  - [ ] voz do Windows continua como fallback selecionável.

### TITI-TTS-002 — Qualidade e inclusão das vozes

- **Prioridade/estado/trilha:** P3 · Não iniciado · Produto + QA
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

1. Fechar `TITI-SEC-*`, `TITI-PRIV-001`, `TITI-VOICE-*`, `TITI-RUN-001` e `TITI-HARNESS-001`.
2. Em paralelo, construir `TITI-QA-001`, `TITI-ACC-001`, `TITI-OBS-001` e `TITI-DIST-001` para que as próximas entregas já tenham portões reais.
3. Entregar catálogo/automação de apps e standby; depois navegador, mídia e agentes de código.
4. Generalizar provedores e refazer onboarding sobre o harness estável.
5. Fechar diagnóstico, desempenho, atualização e lançamento público.
6. Somente então iniciar a voz neural natural.
