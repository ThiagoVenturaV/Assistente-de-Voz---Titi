# Plano de marketing e lançamento do Titi

Atualizado em 15/08/2026 para o estado público da `v0.2.0-beta.1`. Este documento governa aquisição, mensagem, feedback e promoção. O princípio central é: **nenhuma campanha pode avançar mais rápido que a evidência do produto instalado**.

## Decisão executiva

A `v0.2.0-beta.1` está publicada como pré-release, com código, instalador, hash e landing acessíveis. Ela comprovou em ambiente empacotado a interface, as confirmações e a abertura de alguns aplicativos. Depois da publicação, a auditoria encontrou P0 que exigem uma **beta corretiva** antes de qualquer promoção ampla:

- um recurso interno de QA permaneceu no pacote de produção e pode acionar aprovações quando uma variável de ambiente específica é usada;
- a versão publicada não bloqueia credenciais embutidas em URLs nem redige suficientemente URLs e pesquisas no histórico local de ações;
- o instalador continua sem assinatura pública;
- o instalador NSIS e o fluxo completo de voz ainda não foram validados do começo ao fim na máquina real com os dados preservados.

Não há evidência conhecida de exploração ou perda de dados. Ainda assim, esses itens contradizem pilares da marca — consentimento, transparência e confiança — e devem ser tratados publicamente como motivo de uma corretiva, não escondidos como “melhorias internas”.

### Estado de comunicação

- **Agora:** manutenção transparente; não iniciar campanha, anúncio patrocinado, Product Hunt, imprensa, influenciadores ou postagem de aquisição em comunidades.
- **Beta atual:** disponível como registro público de pré-release, mas não recomendada ativamente para novos usuários enquanto a corretiva é preparada.
- **Próxima beta corretiva:** distribuição primeiro para teste privado e depois para pequenos grupos, somente após os gates deste plano.
- **Promoção ampla:** bloqueada enquanto hook de QA, URL/redação, assinatura e voz permanecerem abertos.

Se surgir evidência de execução sem consentimento, exposição de credenciais ou perda de dados, retirar imediatamente o link principal de download e publicar orientação objetiva. Não minimizar o problema nem usar linguagem alarmista sem evidência.

## Estado real do produto

### O que a beta pública já comprovou

- aplicativo gráfico para Windows com onboarding, chat, configurações e mascote flutuante;
- conversa local por texto usando Ollama e modelo separado;
- pacote com Whisper local, mascote e interface;
- confirmação visual antes de abrir aplicativos;
- abertura empacotada de Brave, Spotify, ChatGPT/Codex e Antigravity na máquina de desenvolvimento;
- descoberta local de aplicativos em fontes confiáveis do Windows;
- histórico, memória explícita e painel local de atividade implementados e cobertos por testes automatizados;
- release público com hash, notas, manifesto e link correto na landing.

### O que ainda não pode ser prometido

- instalação real validada em diferentes PCs ou atualização por cima de uma versão anterior;
- voz ao vivo confiável em uso prolongado, diferentes microfones e interrupção em todas as etapas;
- ausência de qualquer janela de terminal em todos os fluxos do instalador e do Ollama;
- privacidade “total”, segurança absoluta ou conteúdo sempre protegido;
- abrir literalmente qualquer aplicativo ou resolver ambiguidades sem escolha da pessoa;
- clicar, digitar, editar ou operar a interface interna de aplicativos;
- delegar e acompanhar trabalhos completos no Codex ou Antigravity;
- controlar uma sessão de música específica em vez das teclas globais do Windows;
- standby de jogos comprovado em jogos reais, múltiplos monitores e diferentes modos de tela;
- atualização automática, rollback, múltiplos provedores ou OAuth;
- uso como tecnologia assistiva ou substituição de teclado e mouse.

## Auditoria da comunicação atual

### README

O README está tecnicamente detalhado e reconhece limites importantes, mas ainda descreve `0.2.0-beta.1` como “candidato interno” que não substituiu a beta pública. Isso ficou desatualizado depois da publicação. Na próxima corretiva, deve distinguir claramente:

1. versão pública atual sob correção;
2. versão corretiva recomendada;
3. recursos comprovados no instalador;
4. limites e riscos conhecidos;
5. como atualizar, voltar ou relatar um problema sem dados pessoais.

### Notas da `v0.2.0-beta.1`

As notas acertam ao informar que a versão é beta, que o instalador não é assinado e que automação interna, voz neural e jogos ainda têm limites. Porém, algumas frases são mais fortes que a evidência:

- “o instalador pode ser executado normalmente” ainda não foi comprovado pelo instalador real;
- “configurações e conversas são reutilizadas” é esperado pelo código, mas ainda precisa de smoke instalado;
- “toda abertura pede confirmação” precisa ser contextualizado porque o hook de QA encontrado no pacote viola esse princípio em uma condição específica;
- “histórico redigido” não deve sugerir que URLs, parâmetros e pesquisas já têm redação completa;
- “standby ao detectar um jogo” deve continuar identificado como experimental.

A corretiva deve ter uma seção explícita **Por que esta atualização é importante**, descrevendo consentimento, URLs e validação de voz em linguagem simples.

### Landing page

A landing está visualmente forte, aponta para o release correto e separa parte da visão futura. Entretanto, enquanto a corretiva não estiver aprovada, os seguintes trechos não devem ser usados em anúncios ou capturas promocionais:

- “Um agente. Todo o seu PC.”;
- “Nada acontece escondido.”;
- “Seus dados ficam com você”, quando usado como garantia absoluta;
- selos “PROTEGIDOS” e “TUDO PRONTO”;
- a demonstração que mostra “Aplicativo aberto” sem representar claramente a confirmação;
- a conversa ao vivo descrita como experiência contínua sem mencionar que está em teste;
- editor, agente de código, jogos e outros aplicativos apresentados de modo que pareçam automação já entregue.

Recomendação para a próxima revisão do site, sem alterar o site nesta tarefa:

- inserir aviso visível de beta para testadores e de instalador não assinado;
- durante a janela corretiva, informar que uma atualização está sendo preparada e evitar CTA de campanha;
- trocar absolutos por “processado localmente por padrão”, “algumas ações compatíveis” e “confirmação antes das ações suportadas”;
- deixar “todo o PC”, edição interna, jogos e delegação numa seção inequivocamente chamada **Visão futura**;
- mostrar o modal de confirmação antes do resultado de abertura;
- acrescentar limites conhecidos perto do primeiro botão de download, não apenas no GitHub.

## Posicionamento honesto

### Categoria

**Companheiro local em beta para conversar com o Windows e testar ações simples com confirmação.**

### Promessa apropriada para a corretiva

> Converse por texto ou voz com um mascote no Windows e teste ações compatíveis, acompanhando e confirmando o que acontece.

### Diferencial

O Titi não deve ser vendido como automação universal. Seu diferencial atual é combinar:

- presença visual por meio do mascote;
- conversa local;
- voz e texto na mesma experiência;
- ações pequenas e observáveis;
- desenvolvimento aberto, com limites documentados.

### Visão, sempre rotulada como futura

> A visão do Titi é conectar sua voz aos aplicativos do computador, aprender procedimentos seguros e delegar trabalhos, sem transformar o modelo em um terminal irrestrito.

### Linguagem permitida

- “beta para Windows”;
- “conversa local por texto”;
- “voz local em teste”;
- “abre alguns aplicativos compatíveis após confirmação”;
- “histórico e memória armazenados localmente quando ativados”;
- “modelo adicional de aproximadamente 6,6 GB”;
- “código e limites publicados no GitHub”;
- “uma corretiva está sendo preparada para reforçar consentimento e segurança”.

### Linguagem proibida até novos gates

- “controle todo o PC por voz”;
- “funciona com qualquer aplicativo”;
- “automatiza qualquer tarefa”;
- “trabalha sozinho no Codex/Antigravity”;
- “não acontece nada escondido”;
- “privacidade total”, “100% seguro” ou “dados protegidos” como absoluto;
- “modo ao vivo perfeito” ou “conversa sem interrupções”;
- “feito para jogos” ou promessa de FPS/VRAM;
- “atualização automática”;
- “instalador confiável/sem alertas” enquanto não houver assinatura.

## Mensagens prontas

### Comunicado durante a preparação da corretiva

> A beta `v0.2.0-beta.1` do Titi está pública para transparência, mas não estamos recomendando novos downloads enquanto preparamos uma beta corretiva. A revisão encontrou pontos de consentimento, tratamento de URLs e validação de voz que precisam ser corrigidos e testados no instalador real. Não há evidência conhecida de exploração. Publicaremos a nova versão, os testes realizados e um novo hash assim que ela passar pelos gates.

### Descrição curta depois da corretiva aprovada

> Titi é um companheiro local em beta para Windows. Converse por texto ou voz, acompanhe o mascote e confirme ações compatíveis no seu computador. Ainda é uma versão para testadores, com limites publicados abertamente.

### Texto de anúncio da corretiva

> A nova beta corretiva do Titi reforça o consentimento das ações, bloqueia URLs com credenciais, melhora a proteção dos registros locais e remove recursos internos de QA do aplicativo distribuído. Também foi instalada e testada com microfone real antes da publicação. Confira os limites conhecidos e o hash no GitHub.

### Resposta a “ele controla qualquer aplicativo?”

> Ainda não. O Titi encontra e abre alguns aplicativos pelas fontes seguras do Windows. Operar botões, editar conteúdo e delegar tarefas completas continuam no roadmap.

### Resposta a “é totalmente privado?”

> A conversa, a transcrição, a memória e o histórico foram projetados para funcionar localmente. Downloads, páginas e pesquisas usam internet quando solicitados. Como é beta, publicamos os limites e só faremos uma promessa mais ampla depois dos testes de privacidade no aplicativo instalado.

## Estratégia de aquisição e feedback

### Fase 0 — contenção e transparência

Enquanto os P0 estiverem abertos:

- pausar divulgação e vídeos de aquisição;
- não comprar mídia nem contatar imprensa ou creators;
- manter issue tracker e notas públicas;
- publicar aviso corretivo se houver tráfego ou downloads novos;
- convidar apenas pessoas necessárias para validar a correção, com mensagem individual e risco explicado;
- responder relatos críticos em até 24 horas.

### Fase 1 — validação privada da corretiva

Público: 3 a 5 pessoas próximas, em PCs Windows diferentes.

Objetivo: provar instalação, voz, privacidade e consentimento, não gerar alcance.

Roteiro mínimo:

1. baixar o mesmo arquivo que será publicado;
2. instalar e reiniciar;
3. conversar por texto;
4. fazer aperte-para-falar e três turnos ao vivo;
5. negar e aprovar uma abertura de aplicativo;
6. desligar histórico e verificar a sessão após reiniciar;
7. relatar qualquer terminal, aviso, travamento ou ação inesperada.

Saída: zero P0 e todos os problemas reproduzíveis registrados sem conteúdo pessoal.

### Fase 2 — beta convidada

Público: até 10 testadores de IA local, Windows e software independente.

Canais:

- contatos pessoais;
- seguidores do GitHub;
- pequenos grupos brasileiros de IA local e Windows;
- formulário de interesse com requisitos claros.

Mensagem: “Ajude a validar uma beta local; não é automação completa.”

Avançar somente se pelo menos oito instalações forem concluídas, seis testes de voz passarem e não houver ação sem consentimento, perda de dados ou terminal visível.

### Fase 3 — comunidades pequenas

Público: 25 a 50 testadores voluntários.

Conteúdo permitido:

- mascote e conversa por texto;
- demonstração real do modal e de uma abertura compatível;
- bastidores da corretiva e o que foi aprendido;
- explicação local versus internet;
- convite para feedback estruturado.

Ainda não usar Product Hunt, campanha paga ou narrativa de “controle do PC”.

### Fase 4 — promoção ampla

Somente depois dos critérios de promoção deste documento. Canais possíveis:

- YouTube Shorts, TikTok e Reels com gravação sem cortes enganosos;
- comunidades brasileiras de tecnologia e produtividade;
- Product Hunt;
- imprensa e creators de IA local;
- página de casos de uso reais.

Cada vídeo informa a versão demonstrada e diferencia recurso atual de visão futura.

## Feedback seguro

### Perguntas prioritárias

1. Você conseguiu instalar e abrir? Em qual etapa parou?
2. Algum terminal ou aviso inesperado apareceu?
3. Texto, aperte-para-falar e modo ao vivo funcionaram separadamente?
4. Ao desligar a voz, ela parou imediatamente?
5. A confirmação mostrou claramente qual aplicativo ou site seria aberto?
6. O resultado dito pelo Titi correspondeu ao que aconteceu?
7. Você encontrou algum dado que esperava não estar salvo?
8. Qual ação simples você gostaria de testar depois?

Aviso obrigatório antes do envio:

> Não envie áudio, transcrição, conversa, senha, token, chave, URL privada, nome de usuário, caminho pessoal ou lista completa de aplicativos.

### Classificação de feedback

- `P0`: ação sem consentimento, credencial exposta, perda de dados, microfone que não encerra, binário adulterado ou execução invisível inesperada;
- `P1`: instalação/voz falha sem perda, aplicativo errado, loop, standby incorreto, acessibilidade bloqueada;
- `P2`: confusão de texto, melhoria visual, pedido de integração ou conveniência.

P0 interrompe aquisição imediatamente. P1 entra no próximo ciclo antes de aumentar o grupo. P2 não deve deslocar correções de segurança e voz.

## Métricas locais sem conteúdo

O marketing não autoriza telemetria escondida. Até existir consentimento específico, usar fontes públicas agregadas e diagnóstico local exportado voluntariamente.

### Métricas públicas agregadas

| Métrica | Fonte | Limite de interpretação |
|---|---|---|
| Visitas e cliques de download | hospedagem, apenas agregado | clique não significa instalação |
| Downloads por versão | GitHub Releases | download não significa uso |
| Issues por categoria | GitHub | representa somente quem decidiu relatar |
| Tempo de primeira resposta | GitHub | mede suporte, não satisfação |
| Correções por versão | release notes | mede estabilidade do processo |

### Diagnóstico local permitido, sempre opcional

Pode ser armazenado localmente e exportado manualmente pela pessoa:

- versão do Titi;
- versão principal do Windows e arquitetura;
- resultado por etapa: instalar, abrir, runtime, texto, transcrição, fala e ferramenta;
- códigos de erro estáveis, sem mensagens livres;
- latência em faixas, não conteúdo;
- contagem de confirmações aprovadas, negadas e expiradas;
- quantidade de reinícios/crashes observados;
- indicadores booleanos: terminal visível, microfone encerrado, dados preservados;
- uso agregado de CPU/RAM/VRAM em faixas.

Nunca coletar ou exportar automaticamente:

- áudio, transcrição, prompts ou respostas;
- nome do aplicativo solicitado;
- histórico, memória ou receita aprendida;
- URLs, pesquisas, títulos de página ou query strings;
- nomes de arquivos, projetos, usuário ou caminhos;
- tokens, cookies, chaves ou credenciais;
- lista de programas instalados;
- identificador persistente de pessoa ou máquina.

### Metas de qualidade da corretiva

- zero P0 conhecido;
- 100% dos pacotes de QA sem hook interno de aprovação;
- 100% das URLs com credenciais rejeitadas nos testes;
- 100% dos registros de QA sem segredo ou conteúdo;
- 5/5 instalações privadas concluídas;
- pelo menos 4/5 pessoas completando aperte-para-falar;
- pelo menos 4/5 completando três turnos ao vivo;
- zero terminal inesperado;
- zero ação executada depois de negação/expiração;
- zero perda de configurações ou conversas preservadas.

Essas metas são gates de qualidade, não slogans publicitários.

## Checklist de lançamento da próxima beta corretiva

### Produto e segurança

- [ ] hook e rotinas de captura de QA não existem no ASAR de produção;
- [ ] build falha automaticamente se marcadores internos de QA aparecerem no pacote;
- [ ] URLs com usuário/senha são rejeitadas na política e no executor;
- [ ] URL, parâmetros e pesquisas sensíveis são redigidos antes do log local;
- [ ] prompt injection e chamada direta não contornam confirmação;
- [ ] negar ou expirar nunca produz efeito lateral;
- [ ] instalador e `Titi.exe` possuem assinatura válida do editor esperado;
- [ ] Defender e verificação independente não encontram detecção;
- [ ] hash final é calculado depois da assinatura e publicado.

### Instalação e runtime

- [ ] instalar o arquivo final como usuário comum no Windows 10 e 11;
- [ ] instalar com dados preservados da beta anterior e confirmar nome, configurações e conversas;
- [ ] abrir e reiniciar três vezes sem janela branca ou instância duplicada;
- [ ] nenhum CMD, PowerShell ou Terminal aparece na instalação, Ollama, mídia, catálogo ou saída;
- [ ] Ollama externo permanece ao sair; Ollama iniciado pelo Titi encerra corretamente;
- [ ] máquina sem Ollama passa por download consentido e assinatura do instalador oficial;
- [ ] falha de rede e espaço insuficiente deixam mensagem recuperável.

### Voz

- [ ] microfone real passa no instalador final;
- [ ] aperte-para-falar funciona fora da janela;
- [ ] botão ao vivo do mascote inicia sem depender do outro botão;
- [ ] vinte turnos não criam captura simultânea nem eco;
- [ ] desligar durante gravação, transcrição, modelo e fala interrompe a cadeia;
- [ ] negar/remover microfone encerra a captura e orienta recuperação;
- [ ] fechar o Titi libera tracks, síntese e atalho global.

### Privacidade e dados

- [ ] modo privado não altera conversas, atividade, memória ou receitas no disco;
- [ ] apagar, exportar e memória são verificados no aplicativo instalado;
- [ ] migração da versão anterior preserva os dados compatíveis;
- [ ] relatório de QA contém somente métricas sem conteúdo;
- [ ] política e notas explicam claramente o que é local e o que usa internet.

### Comunicação

- [ ] README identifica corretamente a versão pública e a corretiva;
- [ ] notas explicam por que a corretiva existe, sem eufemismo;
- [ ] landing mostra versão, tamanho, assinatura, download adicional e limites perto do CTA;
- [ ] nenhuma área visual faz automação futura parecer entregue;
- [ ] modal aparece antes do resultado nas demonstrações;
- [ ] texto não usa “todo o PC”, “qualquer aplicativo”, “protegido” ou “tudo pronto” como promessa atual;
- [ ] GitHub, landing e instalador apontam para a mesma tag e o mesmo hash;
- [ ] existe instrução de atualização, reinstalação e retorno;
- [ ] formulário de feedback traz aviso contra dados pessoais.

### Publicação e suporte

- [ ] pipeline da tag empacota, verifica e guarda o artefato exato;
- [ ] release é pré-release pública, não rascunho, com limites conhecidos;
- [ ] baixar pelo link público reproduz tamanho e hash esperados;
- [ ] testador instala o arquivo baixado, não uma cópia local;
- [ ] responsável acompanha P0 nas primeiras 24 e 72 horas;
- [ ] existe decisão preparada para retirar o download ou publicar hotfix;
- [ ] resultados manuais ficam registrados sem dados pessoais.

## Critérios para voltar a promover

É proibido iniciar promoção enquanto qualquer item abaixo estiver aberto:

1. **Hook de QA:** nenhuma rotina de captura ou aprovação automática pode existir no pacote público.
2. **URLs e registros:** credenciais embutidas precisam ser bloqueadas e logs não podem guardar segredo/conteúdo sensível.
3. **Assinatura:** instalador e executável precisam de Authenticode válida; hash deve ser recalculado depois.
4. **Voz:** microfone real, interrupção completa e vinte turnos precisam passar no instalador final.
5. **Instalação:** o NSIS final precisa passar com dados preservados, reinício e zero console inesperado.
6. **Consentimento:** nenhuma ferramenta pode executar após negar, expirar ou sem confirmação exigida.
7. **Privacidade:** modo privado precisa ser comprovado por inspeção do disco.

Depois desses gates:

- promoção para grupo convidado exige zero P0 e no máximo P1 documentado sem contradizer a mensagem;
- promoção para comunidades exige duas rodadas consecutivas sem P0;
- promoção ampla exige assinatura, Windows 10/11, acessibilidade básica, caminho de atualização/rollback e métricas de qualidade suficientes.

## Governança da mensagem

Antes de qualquer publicação, Produto, Engenharia e QA respondem conjuntamente:

1. A frase demonstra algo visto no instalador final?
2. A pessoa entende que é beta e o que ainda não funciona?
3. Há um risco ou uso de internet omitido?
4. A captura mostra confirmação e resultado reais?
5. O CTA aponta ao mesmo arquivo testado e assinado?
6. O canal de feedback protege conteúdo pessoal?

Se qualquer resposta for “não” ou “não sabemos”, a peça não é publicada.

O mascote pode tornar a experiência calorosa; a honestidade é o que transforma essa simpatia em confiança.
