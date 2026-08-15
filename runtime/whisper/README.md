# Runtime local de voz

O Titi usa `whisper.cpp` v1.9.2 e o modelo multilíngue `ggml-small.bin` para transcrever voz localmente.

Os binários e o modelo não ficam no Git por causa do tamanho. Prepare-os com:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup-whisper.ps1
```

O empacotamento inclui automaticamente `runtime/whisper/bin` e `runtime/whisper/models` no instalador local.

Arquivos oficiais:

- `whisper-bin-x64.zip`: SHA-256 `49dcc16de826f20bd53d44f947a1ae49dfa81f86cad67a64d80820cb192d674a`
- `ggml-small.bin`: SHA-1 `55356645c2b361a969dfd0ef2c5a50d530afd8d5`
