# Runtime local de voz (LFM3 Audio 2B)

O Titi usa `llama.cpp` (`b11998`) e o modelo multimodal `LiquidAI/LFM3-Audio-2B-GGUF` (`LFM3-Audio-2B-Q4_K_M.gguf` + `mmproj-LFM3-Audio-2B-Q8_0.gguf`) para ouvir (ASR/STT) e falar (TTS e Streaming TTS) localmente em 19 idiomas, com vozes feminina e masculina.

Os binários e os modelos não ficam no Git por causa do tamanho. Prepare-os com:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup-whisper.ps1
```

O empacotamento inclui automaticamente `runtime/lfm3/bin` e `runtime/lfm3/models` no instalador local.

Arquivos oficiais verificados por SHA-256:

- `llama-b11998-bin-win-cpu-x64.zip`: SHA-256 `2cdb7ff52769dff9bf19c4cf7d6b6e136e7b46249679d5d92ecd92631b8f7fb2`
- `LFM3-Audio-2B-Q4_K_M.gguf`: SHA-256 `9a773289bd321ed879cd3a76545f6aca506e403851a45fb315420aee45625be2`
- `mmproj-LFM3-Audio-2B-Q8_0.gguf`: SHA-256 `2b6648b1fd48af16aa0877b0592b144d15070783673e038a379fdbc51d40e365`
- `LICENSE`: SHA-256 `4d28ca14dedc0b3d0fcc2b3339f0e79931faa33874f3d24f522183a8fc70068c`
