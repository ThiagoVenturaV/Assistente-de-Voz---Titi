# Benchmark de modelos Ollama para o agente do Titi

Data: 16/08/2026

Máquina: Ryzen 5 5600, 32 GB de RAM, RTX 2060 Super 8 GB

Runtime: Ollama 0.32.13, Windows, contexto efetivo de 4.096 tokens

## Objetivo

Comparar o `qwen3.5:9b`, então padrão, com dois SLMs indicados para reduzir o tempo de resposta do agente:

- `qwen3:4b-instruct`;
- `nemotron-mini:4b`.

O Nemotron avaliado é o **Nemotron Mini 4B**, não o Nemotron Super. O download parcial do Super foi interrompido e removido após a correção do modelo.

## Método

1. Baixar pelo Ollama e verificar o digest de cada modelo.
2. Descarregar o modelo anterior antes de cada rodada.
3. Fazer uma requisição de aquecimento, excluída das métricas.
4. Executar os mesmos 19 cenários pt-BR de `pnpm qa:ollama-tools`, sem realizar qualquer efeito externo.
5. Medir chamadas HTTP reais, recuperação obrigatória, tempo de parede e tokens por segundo.
6. Executar quatro fluxos pelo `OllamaProvider` real com um executor gravador sem efeitos: conversa, Spotify, correção/web/hora e observar → agir.

Todos usaram temperatura zero. Os três modelos permaneceram integralmente na GPU quando carregados.

## Resultado

### Contrato de linguagem natural e tool calling — 19 cenários

| Modelo | Tamanho local | Acerto | Requisições | Média | p50 | p95 | Geração |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `qwen3.5:9b` | 6,6 GB | **19/19** | 22 | 2,20 s | 1,98 s | 2,68 s | 34,4 tok/s |
| `qwen3:4b-instruct` | 2,5 GB | **18/19** | 23 | **1,01 s** | **0,61 s** | 4,11 s | **72,5 tok/s** |
| `nemotron-mini:4b` | 2,7 GB | **2/19** | 39 | 0,66 s | 0,65 s | 0,98 s | 127,9 tok/s |

O Qwen 3 4B reduziu a média por chamada em aproximadamente **54%** e mais que dobrou a taxa de geração. A falha foi a correção contextual “Abra o Chrome” → “Na verdade, abre o Brave”; outra referência contextual precisou da recuperação obrigatória, mas terminou correta.

O Nemotron Mini foi o mais rápido, mas devolveu a maior parte dos argumentos como `{ type, arguments }` aninhado dentro de `function.arguments`, formato incompatível com o contrato nativo do Titi. Também falhou em hora, correção, referência curta e no fluxo em duas rodadas. Velocidade sem uma chamada válida não reduz o tempo percebido do produto.

### Integração pelo provedor real do Titi — quatro fluxos

| Modelo | Resultado | Tempo dos testes |
| --- | ---: | ---: |
| `qwen3.5:9b` | **4/4** | 30,04 s |
| `qwen3:4b-instruct` | **4/4** | **14,99 s** |
| `nemotron-mini:4b` | **1/4** | 11,37 s |

No caminho real do agente, o Qwen 3 4B manteve o resultado dos quatro fluxos e terminou em aproximadamente **metade do tempo** do modelo atual. O Nemotron Mini não executou Spotify nem automação visual e produziu resposta vazia durante o fluxo contextual.

### Aplicativo instalado — mesmos prompts pela interface

O teste final foi executado pela tela de configurações e pelo chat do Titi instalado, não por uma chamada isolada ao Ollama.

| Modelo | Resposta conceitual | Consulta de hora com ferramenta |
| --- | ---: | ---: |
| `qwen3:4b-instruct` | correta; ~25 s | correta; ~18 s |
| `qwen3.5:9b` | correta; ~64 s | **não concluiu em 93 s** |

Os tempos de interface incluem a orquestração completa do aplicativo e a observação externa, por isso não devem ser comparados diretamente às métricas HTTP. Eles servem como comparação A/B sob o mesmo caminho de produto. A consulta lenta de 9B foi interrompida pelo botão/atalho de cancelamento depois do limite.

## Decisão aplicada

O conjunto de três níveis de evidência — contrato, provedor real e aplicativo instalado — sustenta a promoção controlada:

1. `qwen3:4b-instruct` passa a ser o perfil **Rápido (padrão)** para novas configurações;
2. `qwen3.5:9b` permanece no seletor como perfil **Qualidade (mais lento)** e pode ser baixado pelo fluxo normal do runtime;
3. o perfil já salvo de uma pessoa não é migrado silenciosamente; a escolha explícita é preservada;
4. o caso de correção contextual que falhou no corpus permanece como regressão a corrigir e acompanhar;
5. o Nemotron Mini não será oferecido nesta versão. Um adaptador específico poderia normalizar os argumentos aninhados, mas ainda restariam falhas semânticas em pt-BR e contexto.

## Fontes dos modelos

- [Qwen 3 4B Instruct no Ollama](https://ollama.com/library/qwen3:4b-instruct)
- [Nemotron Mini 4B no Ollama](https://ollama.com/library/nemotron-mini)
- [Model card oficial do Nemotron Mini](https://huggingface.co/nvidia/Nemotron-Mini-4B-Instruct)
