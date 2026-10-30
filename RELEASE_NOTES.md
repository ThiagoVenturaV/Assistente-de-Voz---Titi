# Titi Beta 0.2.0-beta.10

Esta pré-release substitui a `0.2.0-beta.9`. É uma prévia pública para testadores no Windows e continua sem assinatura Authenticode pública.

## Por que esta atualização é importante

A beta 10 substitui os motores antigos de audição (Parakeet/Whisper) e fala (Supertonic) pelo novo modelo multimodal local **LFM3 Audio 2B** (`LiquidAI/LFM3-Audio-2B-GGUF` + `llama.cpp b11998`) e adiciona controles diretos na interface para escolher entre **Streaming** ou **TTS**, voz **Feminina** ou **Masculina**, e o **Idioma** da interação.

## O que mudou

- **Motor unificado LFM3 Audio 2B (`LFM3-Audio-2B-Q4_K_M.gguf` + `mmproj-LFM3-Audio-2B-Q8_0.gguf`)**: substitui tanto a transcrição (ASR/STT em lote e incremental) quanto a síntese de voz (TTS e Streaming TTS), rodando localmente em CPU SIMD sem disputar VRAM da placa de vídeo com o Ollama.
- **Escolha entre modo Streaming e modo TTS**:
  - **Streaming**: reproduz os blocos de áudio PCM em tempo real via WebAudio assim que começam a ser gerados (~360 ms para o primeiro bloco).
  - **TTS**: gera o áudio WAV completo de 24 kHz mono 16 bits antes de iniciar a reprodução.
- **Escolha entre voz Feminina e Masculina**: seleção de timbre (`female` ou `male`) diretamente na barra principal do chat e em `Configurações → Voz`.
- **Escolha de idioma (19 idiomas)**: suporte completo aos idiomas do LFM3 (`pt`, `en`, `en-gb`, `es`, `fr`, `de`, `it`, `ja`, `ko`, `zh`, `ar`, `da`, `el`, `fi`, `he`, `nl`, `pl`, `sv`, `tr`), com padrão em Português (`pt`), aplicado tanto para ouvir quanto para falar.
- **Controles rápidos na interface principal e nas configurações**: seletores acessíveis de Modo (`Streaming`/`TTS`), Voz (`Feminina`/`Masculina`) e Idioma na barra do compositor e na aba `Configurações → Voz`, persistidos automaticamente no perfil local.

## Evidência da release

- `pnpm typecheck`: aprovado.
- `pnpm test`: 49 arquivos e 437 testes aprovados.
- Landing: build e 5 testes renderizados aprovados.
- Pacote Windows e verificador (`verify:package`): ASAR íntegro, fuses restritivos do Electron e todos os binários e modelos do runtime `runtime/lfm3` conferidos por SHA-256.
- Smokes empacotados de transcrição incremental e síntese LFM3 (`tts` feminino em `pt` e `streaming` masculino em `en`) aprovados.

## Instalação e dados

O instalador reutiliza o perfil em `%APPDATA%\titi-desktop`; configurações, conversas e atividade não fazem parte do pacote e são preservadas na atualização.

## Limites conhecidos

- A naturalidade e o sotaque percebido da voz em cada idioma ainda exigem avaliação humana contínua.
- A visão multimonitor é somente leitura e sua latência depende do modelo multimodal local e das telas.
- O instalador beta não possui assinatura Authenticode pública, então o Windows SmartScreen pode exibir um aviso de reputação.
