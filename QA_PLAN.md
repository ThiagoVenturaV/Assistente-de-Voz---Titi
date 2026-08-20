# Gate de QA — Titi `0.2.0-beta.9`

Auditoria atualizada em 20/08/2026. Este documento define o que precisa estar comprovado antes de orientar o usuário a instalar a nova versão ou publicar o download como beta público.

Esta rodada mantém escopo deliberado: **não inclui** `TITI-MEET-001` (modo reunião) nem `TITI-REMOTE-001` (cliente remoto). Eles seguem em `Later`, após aprovação dos alvos atuais.

## Veredito do candidato beta 9

**CÓDIGO, PACOTE E INSTALAÇÃO LOCAL APROVADOS; NO-GO PARA TAG E LANDING ATÉ A CI FINAL PASSAR.** A fonte e o aplicativo instalado declaram `0.2.0-beta.9`; typecheck e 431 testes em 48 arquivos passam. O Ollama real aprovou conversa, contexto e ações, o corpus de ferramentas passou 19/19 e os smokes empacotados passaram. A beta 8 permanece como release pública; a landing pública ainda não deve apontar para a beta 9 até a tag produzir e validar os ativos finais.

## Evidência já aprovada no código candidato

| Verificação | Estado | Evidência de 20/08/2026 |
|---|---|---|
| Versão e metadados | Aprovado na fonte | `package.json`, landing, notas, QA, backlog e marketing declaram `0.2.0-beta.9`; `qa:release-sync` passará após o NSIS gerar o novo `latest.yml` |
| Typecheck e testes | Aprovado | `pnpm typecheck`; 48 arquivos e 431 testes, incluindo rotas separadas de conversa/ação, português falado, protocolo interno, autoteste, segurança e voz |
| Modelo e ferramentas | Aprovado com Ollama real | conversa, contexto e ações passaram; corpus seguro de tool calling passou 19/19, sem executar ações externas |
| Build, pacote e NSIS | Aprovado localmente | `package:win` e `verify:package` aprovaram ASAR, fuses, módulos nativos e runtimes no candidato beta 9 |
| Landing candidata | Aprovada localmente | build e 5 testes renderizados passam; publicação segue bloqueada até o ativo público existir |
| Transcrição empacotada | Aprovada | 10 parciais em 15 s, frase final correta e processamento final em 7,043 s |
| Voz neural empacotada | Aprovada tecnicamente | DirectML, oito passos, 4,9 s de áudio, 1,19 s fria e 0,32 s aquecida; escuta humana permanece pendente |
| Integridade pública beta 8 | Aprovada e histórica | ativo público tem 892.693.188 bytes, SHA-256 `980775246752867BEB2142394D5C2386FF995E1024B6C02CB5E83CCE477CC544`; ASAR instalado `0CF70F3B0F1A8BDF09A0B5253C6B09805C1C644C1D53691EBD432C89ED6292F3` |
| Integridade e instalação beta 9 local | Aprovada | 892.695.614 bytes; SHA-256 `33F2A612F2FD124CBCF1F9EE9580F56B9082B3C53943C2718B81752F9C16871A`; ASAR instalado idêntico `92685FEB12B5DE059BA9488AC8C60809E41D5946FBBDE79B90D61ED2C010ECC9`; versão instalada correta; perfil preservado; Authenticode `NotSigned` |

## Gates específicos da beta 9

- [x] Separar conversa clara do caminho de ferramentas sem permitir falso positivo em pedidos mistos.
- [x] Aprovar conversa e ações com o Ollama real e passar 19/19 no corpus de tool calling.
- [x] Normalizar pt-BR sem perder números, negações ou valores e elevar Supertonic para oito passos.
- [x] Gerar `Titi-Setup-0.2.0-beta.9.exe`, blockmap e `latest.yml` sem reutilizar artefatos da beta 8.
- [x] Passar `verify:package`, `qa:release-sync`, auditorias e smokes empacotados de transcrição e TTS.
- [x] Instalar o NSIS beta 9 sobre o perfil preservado; confirmar código 0, versão, ASAR idêntico e dados preservados.
- [ ] Ouvir respostas em pt-BR no aplicativo instalado e registrar avaliação humana de naturalidade/pronúncia.
- [ ] Criar a tag `v0.2.0-beta.9` no SHA aprovado e aguardar o workflow `Release verificável`.
- [ ] Baixar e comparar todos os ativos públicos; validar acesso anônimo.
- [ ] Só então publicar a landing beta 9 e registrar checksums finais.

## Histórico congelado da beta 8

**A PRÉ-RELEASE PÚBLICA `0.2.0-beta.8` FOI PUBLICADA E INSTALADA NESTA MÁQUINA.** O ativo público tem 892.693.188 bytes e SHA-256 `980775246752867BEB2142394D5C2386FF995E1024B6C02CB5E83CCE477CC544`; o ASAR instalado tem SHA-256 `0CF70F3B0F1A8BDF09A0B5253C6B09805C1C644C1D53691EBD432C89ED6292F3`. O perfil foi preservado. A landing pública permaneceu temporariamente na beta 7 e deve saltar diretamente para a beta 9 somente após os novos ativos serem validados.

## Histórico congelado da beta 7

**A PRÉ-RELEASE PÚBLICA `0.2.0-beta.7` FOI PUBLICADA, INSTALADA E SINCRONIZADA ENTRE GITHUB, LANDING E ESTA MÁQUINA.** No candidato publicado passaram 331 testes, typecheck, build, NSIS, verificação do pacote, smokes de Parakeet e Supertonic DirectML, instalação sobre o perfil preservado e o teste real do botão de fechar do mascote. A tag aponta para `b48fb76`, a CI da `main` terminou verde, os três ativos foram publicados e o download anônimo respondeu HTTP 200 com 892.673.907 bytes. A landing Sites versão 21 respondeu HTTP 200 com a beta.7. Este bloco é histórico e nenhuma evidência de artefato abaixo deve ser reutilizada para a beta 8.

Antes do teste, o usuário havia desinstalado a versão anterior: a pasta de instalação foi removida, enquanto configurações e conversas permaneceram em `%APPDATA%\titi-desktop`. A instalação foi executada sobre esse perfil e reabriu os dados existentes.

## Evidências desta auditoria

| Verificação | Estado | Evidência até 19/08/2026 |
|---|---|---|
| Versão declarada na fonte | Aprovado | `package.json` declara `0.2.0-beta.7` |
| Sincronização de metadados de versão | Aprovado | `pnpm qa:release-sync` confirmou coerência entre `package.json`, `landing`, `latest.yml` e nota de versão |
| Typecheck | Aprovado | `pnpm typecheck`, código 0 |
| Testes automatizados | Aprovado na beta.7 | `pnpm test`: 34 arquivos e 331 testes aprovados na fonte publicada daquela versão |
| Build de produção | Aprovado | `pnpm build`: main, preload e renderer compilados |
| Linguagem natural e seleção de ferramentas | Parcial documentado | `qwen3:4b-instruct`: 18/19, média de 1,05 s nesta rodada; `qwen3.5:9b`: 19/19; o caso 4B “Chrome → Brave” permanece conhecido e nenhum efeito externo é executado pelo script |
| Conversa real do provider | Aprovado sem efeitos externos | 4/4 fluxos sequenciais no `OllamaProvider` real com Qwen 4B e 4/4 com Qwen 3.5 9B, definições reais das ferramentas e executor gravador; detalhes em `docs/OLLAMA_AGENT_MODEL_BENCHMARK.md` |
| Dados da versão anterior | Preservados após o NSIS | A instalação reabriu o nome, as configurações e a conversa anterior; `settings.json` e `conversations.json` continuam presentes em `%APPDATA%\titi-desktop` |
| Instalador beta.7 publicado | Aprovado | EXE de 892.673.907 bytes e SHA-256 `D39A3F53…A540BA`; instalador, blockmap e `latest.yml` estão na pré-release pública e o download anônimo respondeu HTTP 200 com o tamanho exato |
| Pacote beta.7 | Aprovado | `pnpm package:win` e `verify:package` confirmaram beta.7, ferramentas, CSP de mídia local, workers, Parakeet, Supertonic, DirectML e hashes |
| Runtime local de voz empacotado | Aprovado | `ggml-parakeet-tdt-0.6b-v3-q8_0.bin` com 668.757.119 bytes e runtime mínimo de 9.104.960 bytes em `win-unpacked/resources/runtime/whisper`; executáveis de teste e modelos Whisper/VAD não entram no pacote |
| Ensaio local de transcrição pt-BR | Aprovado sem microfone real | voz Microsoft Maria curta transcrita exatamente em 1,21 s; áudio controlado de 55,4 s transcrito por inteiro em 7,81 s, enquanto o Whisper anterior cortou o meio e repetiu o final três vezes; microfone do usuário continua no smoke manual |
| Transcrição incremental | Aprovado no pacote beta.7 | 10 revisões em 15 s, frase final correta e processamento final em 6,834 s |
| Voz neural DirectML empacotada | Aprovado no pacote beta.7 | 4,9 s de áudio; primeira síntese em 0,73 s, aquecida em 0,23 s, backend `directml`, WAV PCM mono de 44.100 Hz e 431.888 bytes |
| Supertonic CPU x CUDA x DirectML | Aprovado no hardware-alvo | CUDA foi rejeitado pelo runtime de 2,7 GiB e acréscimo de 611 MiB de VRAM; DirectML usa aproximadamente 42 MB de runtime, acrescentou cerca de 249 MiB com Qwen residente e ficou próximo de 7x mais rápido que CPU depois do aquecimento; DirectML é o padrão e CPU o fallback, conforme `docs/SUPERTONIC_GPU_BENCHMARK.md` |
| Automação de interface empacotada | Aprovado estruturalmente | `windows-ui-automation.ps1` com 9.242 bytes em `win-unpacked/resources/runtime`, incluindo UI Automation, captura em memória, recorte ampliado e clique relativo; o verificador exige o recurso e `focusImageBase64` no ASAR |
| Visão local multimonitor | Aprovado no pacote | pedido natural roteado para `computer_look`; 2 monitores observados, YouTube confirmado com 95% e duração de 29,4 s |
| Navegação e janelas | Aprovado no pacote | YouTube abriu pela URL direta no Brave, e a janela foi confirmada em qualquer monitor sem falha com coordenada infinita |
| Mensagem imediata e cronômetro | Aprovado | testes cobrem inserção otimista sem duplicação, rótulo temporal e encerramento do timer; suíte renderer aprovada |
| Identidade visual | Aprovado | o master da cabeça do mascote gera ICO/PNG, ícone do executável, avatares do desktop, favicons e Open Graph da landing |
| Mascote flutuante | Aprovado no instalado | X sempre visível, área de 36 × 36 px e nome acessível “Ocultar mascote”; o clique deixou somente a janela principal do Titi aberta |
| Manifesto de release beta.7 | Aprovado localmente | `latest.yml` declara beta.7 e 892.673.907 bytes, com SHA-512 correspondente ao NSIS final |
| Assinatura do instalador | Risco explícito | `Get-AuthenticodeSignature` retorna `NotSigned` para o instalador beta.7 e `win-unpacked/Titi.exe` |
| Ensaio visual real do Spotify | Aprovado na fonte | com árvore acessível vazia, o Ollama local identificou Play com 95%, o clique relativo iniciou a reprodução e a inspeção independente mostrou Pause; o recorte ampliado corrigiu a classificação pós-clique para `playing` com 95% |
| Política de confirmação na branch | Aprovado automaticamente | ações genéricas de UI exigem confirmação, identidade exata da janela/controle e nova validação antes do efeito; alvos protegidos continuam bloqueados |
| Catálogo real do Windows | Aprovado para as fontes requeridas | `Get-StartApps` retornou Brave (`Brave`), Spotify (`SpotifyAB.SpotifyMusic_zpdnekdrzrea0!Spotify`), ChatGPT/Codex (`OpenAI.Codex_2p2nqsd0c76g0!App`), Antigravity e Antigravity IDE |
| Instalação do NSIS beta.7 | Aprovado estruturalmente e visualmente | código 0 e ASAR instalado idêntico ao `win-unpacked` (`A9070C81…26ECF`); `actions.json`, `conversations.json` e `settings.json` mantiveram seus SHA-256; botão de fechar aprovado no mascote real |

## Gates específicos da beta.7

- [x] DirectML ser o backend primário e CPU o fallback automático.
- [x] Verificar hashes e licenças do runtime GPU no pacote.
- [x] Passar typecheck, 331 testes, build, `package:win`, `verify:package`, Parakeet e Supertonic.
- [x] Registrar 18/19 do Qwen 4B sem ocultar a regressão contextual e manter o 9B aprovado como opção de qualidade.
- [x] Gerar `Titi-Setup-0.2.0-beta.7.exe`, `.blockmap` e `latest.yml` a partir da árvore final.
- [x] Conferir tamanho, SHA-256 e Authenticode do NSIS beta.7.
- [x] Instalar beta.7 sobre `%APPDATA%\titi-desktop` e provar que configurações, conversas e ações mantiveram seus hashes.
- [x] Aprovar no aplicativo instalado que o X do mascote permanece visível e o oculta ao clicar.
- [x] Provar visão local de 2 monitores e abertura direta do YouTube no Brave.
- [x] Executar novamente os smokes DirectML e Parakeet no pacote final.
- [x] Publicar tag e release beta.7, validar download anônimo e só então trocar a landing page pública.
- [x] Rodar `qa:release-sync` para travar que `package.json`, `landing/app/page.tsx`, `landing/package.json`, `latest.yml` e `README` continuam no mesmo número de versão.

## Relatórios históricos

- [0.2.0-beta.3](./docs/release-history/0.2.0-beta.3.md) — artefato, hashes, instalação e pendências manuais preservadas fora do gate atual.

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

1. existe um instalador final `Titi-Setup-0.2.0-beta.7.exe`, com estado de assinatura e hash publicados;
2. a versão interna, `latest.yml`, tag, notas e link de download são `0.2.0-beta.7`;
3. typecheck, 331 testes, build, QA do modelo, empacotamento e verificação do pacote passam no mesmo candidato;
4. a instalação real sobre os dados preservados passa sem perda de nome, configurações ou conversas;
5. Spotify, Brave e Codex/ChatGPT abrem direto; Antigravity pede confirmação; a UI do Spotify passa no ciclo observar → agir → verificar;
6. modo ao vivo, aperte-para-falar, microfone e mascote passam no Windows real;
7. Ollama e verificações auxiliares nunca exibem consoles e respeitam ownership;
8. histórico privado e memória local passam na inspeção de disco;
9. standby de jogo passa sem retomar microfone/modelo indevidamente;
10. não há P0 aberto nem P1 que contradiga uma função anunciada na landing page.

Sem assinatura, a mensagem permitida é “pré-release de teste não assinada”, acompanhada do hash e do aviso de SmartScreen. Isso pode atender ao beta público para testadores, mas nunca ao gate de versão estável recomendada.

### Estado contra esse critério

- **Artefato e integridade beta.7:** aprovado e publicado no GitHub; os três ativos coincidem com os hashes locais e o instalador continua não assinado.
- **Execução isolada do `win-unpacked` beta.7:** Parakeet e Supertonic DirectML aprovados no pacote; visão de 2 monitores e navegação direta permanecem cobertas pela beta.5 e pelo código inalterado.
- **Instalação NSIS beta.7 sobre dados preservados:** aprovada para integridade, igualdade do ASAR, preservação exata do perfil e fechamento do mascote; áudio audível e matriz manual completa permanecem pendentes.
- **Smoke funcional real de voz, abertura aprovada dos quatro aplicativos, memória e jogo:** pendente.
- **Verificação do download publicado:** aprovada; tag, três ativos e acesso anônimo da beta.7 existem, e o instalador retornou HTTP 200 com 892.673.907 bytes; assinatura continua ausente.

Portanto, a beta.7 está publicada como pré-release de teste, com hash e aviso explícito de que não é assinada. Os smokes manuais restantes continuam impedindo tratá-la como versão estável.
