# Titi Beta 0.2.0-beta.9

Esta pré-release substitui a `0.2.0-beta.8`. É uma prévia pública para testadores no Windows e continua sem assinatura Authenticode pública.

## Por que esta atualização é importante

A beta 9 melhora dois pontos que afetam diretamente a sensação de conversar com o Titi: a qualidade das respostas em português brasileiro e a forma como o texto é preparado para a voz local. A mudança foi isolada para preservar o comportamento das ferramentas e as proteções já aprovadas.

## O que mudou

- Perguntas, explicações, saudações e conversa comum usam uma rota própria, sem carregar o prompt operacional nem os schemas de automação.
- O caminho de conversa acompanha o grau de formalidade do usuário, responde de forma direta e evita aberturas repetitivas como “Claro” e “Com certeza”.
- Pedidos mistos, como “me explica e depois abre o Spotify”, continuam no fluxo de ferramentas; respostas após ações continuam baseadas no resultado real da execução.
- Casos ambíguos classificados como conversa são gerados novamente na rota limpa, em vez de reutilizar um rascunho contaminado pelo modo de ferramentas.
- A projeção falada agora trata português brasileiro de forma determinística: horas, datas, reais, percentuais, decimais, unidades, versões, siglas e nomes frequentes de aplicativos e tecnologias.
- Números de emojis de tecla, como `1️⃣`, deixam de desaparecer da fala.
- O Supertonic passa de cinco para oito passos de qualidade, mantendo DirectML na GPU e fallback automático para CPU.
- Uma falha de síntese não transforma uma resposta de chat já recebida em falha da conversa.
- O estado “falando” só começa quando o áudio realmente inicia no dispositivo.

## Evidência da release

- `pnpm typecheck`: aprovado.
- `pnpm test`: 48 arquivos e 431 testes aprovados.
- Ollama real com `qwen3:4b-instruct`: conversa, contexto e ações aprovados.
- Corpus seguro de tool calling: 19 de 19 verificações aprovadas, sem executar as ações.
- O corpus de voz cobre números, negação, datas, horas, moeda, percentuais, unidades, versões, siglas, marcas, Markdown, links, código e idempotência.
- Landing: build e 5 testes renderizados aprovados.
- Pacote Windows e verificador: aprovados; ASAR, fuses, módulos nativos e runtimes conferidos.
- Transcrição empacotada: 10 revisões incrementais em 15 s, frase final correta e processamento final em 7,043 s.
- Voz empacotada: backend `directml`, 4,9 s de áudio; primeira síntese em 1,19 s e síntese aquecida em 0,32 s usando oito passos.
- Auditorias de dependências: zero vulnerabilidades conhecidas no nível alto; scanner de segredos aprovado.
- Instalação do ativo público: código 0, versão `0.2.0-beta.9`, ASAR esperado e hashes de configurações, conversas e atividade preservados.
- Release pública: cinco ativos publicados, baixados novamente e comparados pelo workflow verificável.
- Download anônimo e landing Sites v23: HTTP 200, versão e link beta 9 confirmados.
- A escuta humana comparativa continua pendente e declarada como limite do beta.

## Integridade do instalador

O instalador público `Titi-Setup-0.2.0-beta.9.exe` tem 892.695.659 bytes, SHA-256 `806F1857C0B850361FFD54F8CAAFD52CA07067D2352271A45162EE787482AF40` e estado Authenticode `NotSigned`. O manifesto referencia o commit `19307732a780c018613bfc76986d272ad9058f4a`; o ASAR instalado tem SHA-256 `92685FEB12B5DE059BA9488AC8C60809E41D5946FBBDE79B90D61ED2C010ECC9`. Os cinco ativos públicos foram baixados anonimamente e os checksums publicados conferiram. Nenhum hash nem artefato da beta 8 foi reutilizado.

## Instalação e dados

O instalador reutiliza o perfil em `%APPDATA%\titi-desktop`; configurações, conversas e atividade não fazem parte do pacote. A atualização beta 8 → beta 9 com o ativo público preservou exatamente os três arquivos e instalou o ASAR esperado.

## Limites conhecidos

- A naturalidade e o sotaque percebido da voz ainda exigem avaliação humana; testes automáticos comprovam retenção de conteúdo, não preferência auditiva.
- A visão multimonitor é somente leitura e sua latência depende do modelo multimodal local e das telas.
- A automação genérica depende da árvore de acessibilidade. Digitação livre, arrastar e menus de contexto não estão liberados.
- DirectML depende de GPU e driver Windows compatíveis; o fallback CPU preserva a função com menor velocidade.
- A matriz completa de áudio, eco, uso prolongado, jogos e Windows 10/11 limpos continua manual.
- O instalador beta não possui assinatura Authenticode pública, então o Windows pode exibir um aviso de reputação.
- Cliente remoto e modo reunião do Perssua não fazem parte desta versão.
