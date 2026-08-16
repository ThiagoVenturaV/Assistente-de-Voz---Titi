# Benchmark Supertonic 3 INT8 — CPU, CUDA e DirectML

Medição executada em 16/08/2026 para escolher um backend de GPU real para a voz local do Titi. Todos os caminhos usam os mesmos modelos Supertonic 3 INT8, sem confundir suporte declarado com aceleração efetiva.

## Ambiente

- Windows, Ryzen 5 5600, 32 GB de RAM e NVIDIA RTX 2060 SUPER de 8 GB;
- driver NVIDIA `610.74`, compute capability `7.5`;
- Sherpa ONNX 1.13.5;
- ONNX Runtime DirectML 1.24.4 e Microsoft DirectML 1.15.4 no caminho selecionado;
- mesmos `tts.json`, `unicode_indexer.bin`, `voice.bin` e quatro modelos ONNX INT8 usados pelo pacote;
- voz `sid=5`, idioma `pt`, velocidade `1.02`, cinco passos e quatro threads;
- workers persistentes, com execução fria e aquecida separadas.

O benchmark CUDA reproduzível está em `scripts/benchmark-supertonic-cpu-gpu.py`. A validação DirectML usa o mesmo módulo Node que o aplicativo e também é executada por `scripts/check-packaged-supertonic.cjs` dentro do pacote final.

## Ensaio CUDA

Com a GPU livre, CUDA foi de 4,09x a 6,29x mais rápido que CPU depois do aquecimento:

| Resposta | Áudio gerado | CPU mediana | CUDA mediana | Ganho CUDA |
|---|---:|---:|---:|---:|
| Curta, 63 caracteres | 5,451 s | 1.070,65 ms | 238,96 ms | 4,48x |
| Média, 157 caracteres | 11,994 s | 2.269,28 ms | 360,62 ms | 6,29x |
| Longa, 318 caracteres | 24,530 s | 3.638,41 ms | 889,55 ms | 4,09x |

Entretanto, esse ambiente acrescentou 611 MiB de VRAM com o Qwen 9B residente, deixou aproximadamente 364 MiB de margem e exigiu 2.851.547.929 bytes (2.719,45 MiB) de runtime descompactado. As wheels baixadas somaram mais de 1,8 GB. Por isso, CUDA não foi escolhido para distribuição.

## Ensaio DirectML no caminho real do produto

DirectML preservou a aceleração sem carregar o runtime CUDA:

| Cenário | Áudio | Inicialização + primeira síntese | Síntese aquecida |
|---|---:|---:|---:|
| Worker compilado | 4,9 s | 4,42 s | 0,27 s |
| `win-unpacked`, executado pelo Electron | 4,9 s | 4,53 s | 0,27 s |
| Qwen 3.5 9B residente | 13,55 s | medida separadamente | 0,49–0,52 s |

No texto de 13,55 s, a CPU persistente levou aproximadamente 2,17 s. Depois do aquecimento, DirectML ficou perto de sete vezes mais rápido com a GPU livre. Sob carga gráfica externa de 98–99%, a variação aumentou, mas a síntese aquecida continuou mais rápida que tempo real e normalmente mais rápida que CPU.

Com o `qwen3.5:9b` residente, o pico observado do TTS acrescentou aproximadamente 249 MiB de VRAM e o Ollama não descarregou o modelo. Isso oferece margem consideravelmente maior que a alternativa CUDA medida.

## Fidelidade do áudio

CPU, CUDA e DirectML produziram 44.100 Hz, a mesma quantidade de amostras e a mesma duração para o mesmo texto. Os WAVs não são idênticos bit a bit por diferenças numéricas entre providers. A retranscrição local pelo Parakeet preservou o conteúdo nos dois caminhos selecionados, com pequenas diferenças de pontuação e forma ortográfica, sem perda observada da mensagem.

## Custo de distribuição

O runtime DirectML incluído em `runtime/supertonic/directml` ocupa aproximadamente 42 MB descompactados. O pacote contém avisos de licença, proveniência e hashes SHA-256 dos binários, e `scripts/verify-package.mjs` rejeita ausência ou alteração desses arquivos.

Esse custo é muito menor que os 2,7 GiB do ambiente CUDA ensaiado e mantém o instalador dentro do limite de 1 GB estabelecido para a beta.

## Decisão

**DirectML é o backend principal da voz Supertonic a partir da beta.4.** O runtime CPU continua empacotado como fallback automático para máquinas sem provider ou driver compatível.

A transcrição Parakeet permanece na CPU porque, nessa mesma máquina, ela foi mais rápida que seu caminho CUDA. O produto usa a GPU de maneira seletiva: DirectML para síntese, onde o ganho foi comprovado, e Ollama para o modelo de conversa.

## Fontes dos runtimes

- [Sherpa ONNX — instalação GPU](https://k2-fsa.github.io/sherpa/onnx/python/install.html)
- [ONNX Runtime DirectML](https://www.nuget.org/packages/Microsoft.ML.OnnxRuntime.DirectML)
- [Microsoft DirectML](https://www.nuget.org/packages/Microsoft.AI.DirectML/)
- [Supertonic](https://github.com/supertone-inc/supertonic)
