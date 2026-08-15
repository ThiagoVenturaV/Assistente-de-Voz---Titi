# Assistente de Voz — Titi

Titi é um assistente local para Windows com interface gráfica, conversa por texto e voz, mascote 2D animado e ferramentas controladas para agir no computador. O objetivo é permitir que a pessoa use seus aplicativos por voz sem entregar um terminal irrestrito ao modelo.

> **Estado atual:** candidato interno `0.2.0-beta.1`, em desenvolvimento. As mudanças descritas abaixo ainda precisam passar pela instalação e pelo smoke test do novo pacote antes de substituir o beta público anterior.

## O que está implementado no código atual

- aplicativo Electron/React com onboarding, chat, configurações e mascote flutuante;
- chat local com Ollama e `qwen3.5:9b`;
- transcrição local por `whisper.cpp`, aperte-para-falar, atalho global e modo ao vivo;
- resposta falada com uma voz instalada no Windows;
- botão **Ao vivo** diretamente no mascote;
- execução de ferramentas com validação de nome, argumentos, repetição, quantidade e número de rodadas;
- roteamento direto de comandos explícitos comuns, como abrir um aplicativo, inclusive enquanto o modelo está indisponível;
- catálogo local que procura aplicativos no Menu Iniciar, nos aplicativos registrados pelo Windows e em pastas de instalação confiáveis;
- aprendizado de uma receita estruturada somente depois que um processo correspondente é confirmado; quando isso não é possível, o Titi informa apenas que enviou o pedido ao Windows;
- abertura de páginas HTTP/HTTPS, pesquisa na web, pesquisa no aplicativo de música e teclas de mídia;
- confirmação antes de navegar, enviar uma busca externa ou tentar abrir um aplicativo ainda não conhecido;
- histórico local, modo privado em memória, exportação e exclusão de conversas;
- memória curada de fatos e preferências que o usuário pediu explicitamente para guardar;
- painel local de atividade com resultado, duração e confirmação das ferramentas;
- inicialização oculta do Ollama, sem shell e com proteção contra partidas duplicadas;
- standby experimental ao detectar um provável jogo em primeiro plano.

O código passa por `pnpm typecheck` e por **181 testes em 22 arquivos**. Essa evidência é unitária/de integração; ainda não substitui a validação do instalador em uma máquina limpa.

## Limites desta versão

- o catálogo aumenta a cobertura, mas ainda não garante abrir literalmente qualquer aplicativo; ambiguidades ainda não têm uma tela de escolha;
- abrir Codex, ChatGPT ou Antigravity não significa delegar uma tarefa: envio, acompanhamento e retorno de trabalhos continuam no backlog;
- não existe automação genérica de interface para clicar, digitar ou editar dentro de qualquer aplicativo;
- o standby de jogos ainda precisa ser testado com jogos reais, tela cheia, downloads e tarefas em andamento;
- somente Ollama está implementado; API e OAuth ainda não fazem parte do produto;
- interrupção completa de geração/fala, escolha do dispositivo de entrada e testes longos do modo ao vivo ainda estão pendentes;
- ainda não há atualização dentro do aplicativo, assinatura do instalador ou rollback automático;
- a voz neural mais natural permanece como última prioridade.

Consulte [BACKLOG.md](./BACKLOG.md) para os critérios de aceite e os bloqueios do beta completo.

## Segurança das ferramentas

O modelo informa apenas o nome comum do aplicativo. Caminhos, executáveis e identificadores são resolvidos pelo catálogo local em fontes confiáveis do Windows. Nomes de terminal, caminhos livres, scripts, protocolos perigosos e ferramentas desconhecidas são bloqueados.

Ações implementadas que saem do computador — como abrir um site ou enviar uma pesquisa — pedem confirmação com destino e consequências. Recusar ou deixar a confirmação expirar impede o efeito. Compras, mensagens, publicação, exclusões externas e comandos arbitrários não estão disponíveis.

## Histórico privado, memória e aprendizado

São três recursos diferentes:

- **Histórico:** guarda as mensagens para reabrir conversas depois.
- **Modo privado:** mantém as novas mensagens somente na memória do aplicativo durante a sessão. Conversas antigas continuam salvas até a pessoa optar por apagá-las.
- **Memória curada:** guarda somente fatos ou preferências após um pedido explícito, por exemplo: “lembre que meu navegador preferido é o Brave”. Ela pode ser vista, removida ou limpa em **Configurações → Memória**.

Quando o histórico está desligado, Titi não grava a conversa, a atividade, novas memórias nem receitas aprendidas de aplicativos. A memória já existente também não é enviada ao modelo durante essa conversa privada.

As receitas de aplicativos guardam uma ação estruturada validada, nunca um comando de terminal fornecido pelo modelo. Se a origem deixar de ser confiável ou o aplicativo desaparecer, a receita não é executada.

## Primeira execução e IA local

O instalador contém a interface, o mascote e o runtime de transcrição. O modelo de conversa não é embutido porque ocupa aproximadamente 6,6 GB.

Na primeira execução, Titi verifica quatro estados:

1. se o Ollama não existir, oferece a instalação oficial após validar a assinatura do instalador;
2. se o Ollama existir, mas estiver parado, tenta iniciá-lo silenciosamente;
3. se o serviço estiver ativo, mas o modelo não existir, oferece o download com progresso;
4. quando mecanismo e modelo estão disponíveis, informa que a IA local está pronta.

Nenhum download grande começa sem uma ação explícita. Um modelo instalado, mas fora da memória, é carregado pelo Ollama quando necessário.

Dependências oficiais:

- [Ollama para Windows](https://docs.ollama.com/windows)
- [Qwen 3.5 no Ollama](https://ollama.com/library/qwen3.5)
- [whisper.cpp](https://github.com/ggml-org/whisper.cpp)

## Estado por área

| Área | Estado na branch | O que falta para considerar entregue |
| --- | --- | --- |
| Interface, chat e mascote | Base pronta | Smoke test do novo pacote |
| Ferramentas e resultado real | Pronto no código | QA com Ollama e executável empacotado |
| Descoberta e aprendizado de apps | Parcial | UI para ambiguidades e cobertura real de mais aplicativos |
| Confirmações e auditoria | Parcial | E2E do modal e política para futuras ações destrutivas |
| Histórico privado e memória | Pronto no código | Migração e teste no pacote |
| Voz e modo ao vivo | Parcial | 20 turnos, interrupção e seleção de microfone |
| Ollama silencioso | Pronto no código | Teste de janelas/processos no instalador |
| Standby durante jogos | Experimental | Jogos reais, lista editável e tarefas em andamento |
| Delegação para agentes | Não implementado | Enviar, acompanhar e devolver resultados |
| API/OAuth e outros runtimes | Não implementado | Contratos, cofre de segredos e onboarding |
| Atualização automática | Não implementado | Canal assinado, validação e rollback |

## Desenvolvimento

Requisitos: Node.js, pnpm e Windows 10/11.

```powershell
pnpm install
powershell -ExecutionPolicy Bypass -File .\scripts\setup-whisper.ps1
pnpm dev
```

Validações:

```powershell
pnpm typecheck
pnpm test
pnpm build
pnpm qa:ollama-tools
```

`qa:ollama-tools` consulta o modelo local e verifica se ele escolhe a ferramenta certa para Brave, Spotify, Codex e Antigravity, sem executar nenhuma dessas ferramentas.

Empacotamento:

```powershell
pnpm package:win
```

O pacote é gerado em `release/`. Depois da build, o verificador confere se o `app.asar` contém o nome e a versão esperados e os marcadores essenciais de ferramentas e processos ocultos. Um arquivo local correto ainda precisa passar pela matriz de instalação descrita em [QA_PLAN.md](./QA_PLAN.md) antes de ser publicado em GitHub Releases.

## Arquitetura

- `src/main/apps`: descoberta local e receitas seguras de aplicativos;
- `src/main/games`: detector conservador e standby experimental;
- `src/main/harness`: orquestração do modelo, ferramentas e comandos determinísticos;
- `src/main/memory`: fatos, preferências e receitas curadas;
- `src/main/storage`: conversas, configurações, atividade e escrita recuperável;
- `src/main/tools`: catálogo de ferramentas, confirmação e auditoria;
- `src/main/voice`: transcrição e atalho global;
- `src/preload`: ponte IPC restrita;
- `src/renderer`: interface, onboarding, configurações, modais e mascote;
- `src/shared`: contratos compartilhados;
- `mascotes/titi/package/titi`: animação Codex v2 do Titi;
- `runtime/whisper`: arquivos locais do reconhecimento de voz.

## Hardware de desenvolvimento

O perfil atual usa Ryzen 5 5600, 32 GB de RAM e RTX 2060 Super com 8 GB de VRAM. O `qwen3.5:9b` roda pelo Ollama; o Whisper usa a CPU para não disputar a VRAM do modelo de conversa. Essa configuração é o perfil de desenvolvimento, não um requisito mínimo já homologado.
