# Titi Beta 0.2.0-beta.4

Esta pré-release substitui a `0.2.0-beta.3`. É uma prévia pública para testadores no Windows e continua sem assinatura Authenticode pública.

## O que mudou

- A voz Supertonic 3 INT8 agora usa a GPU por DirectML. O worker mantém a sessão neural carregada e informa qual backend executou cada síntese.
- Se o DirectML estiver indisponível, não inicializar ou cair durante o uso, o Titi troca automaticamente para o runtime CPU em vez de perder a resposta falada.
- O runtime GPU é autossuficiente no instalador: Sherpa ONNX 1.13.5, ONNX Runtime DirectML 1.24.4 e Microsoft DirectML 1.15.4 são empacotados com licenças, proveniência e hashes verificados.
- O worker de voz é preparado em segundo plano durante a inicialização do aplicativo, evitando carregar o motor inteiro somente depois da primeira resposta.
- A transcrição NVIDIA Parakeet TDT 0.6B v3 Q8 continua incremental e na CPU. Esse caminho foi mantido porque, no áudio longo de QA desta RTX 2060 Super, CPU levou 9,9 s e CUDA 40,2 s; o uso da GPU é aplicado onde houve ganho real: a síntese de voz.
- Permanecem as correções da beta.3 para linguagem natural, referências entre turnos, chamadas de ferramenta, Spotify, observação de interface, cancelamento, modo ao vivo e política de confirmação exclusiva do Antigravity.

## Evidência automatizada

- `pnpm typecheck`: aprovado.
- `pnpm test`: 31 arquivos e 308 testes aprovados, incluindo fallback DirectML→CPU e descarte seguro do worker durante a inicialização.
- `pnpm build`: main, preload e renderer aprovados.
- `pnpm package:win` e `pnpm verify:package`: aprovados para a versão beta.4, incluindo os hashes dos seis binários DirectML.
- Smoke do worker compilado: 4,9 s de áudio; primeira síntese de 4,42 s e síntese aquecida de 0,27 s, backend `directml`.
- Smoke do NSIS final executado pelo Electron: 4,9 s de áudio; primeira síntese de 4,27 s e síntese aquecida de 0,24 s, backend `directml`, WAV de 431.888 bytes.
- Instalação sobre a beta.3: código 0, versão interna beta.4, ASAR idêntico ao `win-unpacked` e hashes de configurações, conversas e atividade preservados exatamente. O smoke nos arquivos instalados também usou `directml` e sintetizou a fala aquecida em 0,24 s.
- Com o `qwen3.5:9b` residente no Ollama, a síntese DirectML aquecida ficou em aproximadamente 0,49–0,52 s e o pico observado acrescentou cerca de 249 MiB de VRAM sem descarregar o modelo de conversa.
- CPU e DirectML produziram áudio de 44.100 Hz com a mesma duração e quantidade de amostras; a retranscrição local preservou o conteúdo nos dois backends.

## Instalação e dados

O instalador pode ser aplicado sobre o perfil preservado em `%APPDATA%\titi-desktop`. Configurações e conversas existentes não fazem parte do instalador e devem manter seus hashes durante a atualização. O modelo de conversa continua sendo um download separado de aproximadamente 6,6 GB.

## Integridade do instalador

SHA-256 de `Titi-Setup-0.2.0-beta.4.exe` (892.363.026 bytes; 851,02 MiB):

`5356FA72B40C2008D2548EA2941E6225945C14DD9A96751F846E278DCF3C4614`

O instalador e o executável principal continuam sem assinatura Authenticode. O hash deve ser recalculado se o instalador for assinado ou reconstruído; hashes das betas anteriores nunca devem ser reutilizados.

## Limites conhecidos

- O primeiro uso da voz ainda inclui a inicialização do DirectML; as falas seguintes reutilizam o worker aquecido.
- DirectML depende de uma GPU e de um driver Windows compatíveis. Em máquinas sem suporte, o fallback CPU preserva a funcionalidade com menor velocidade.
- A automação genérica depende da árvore de acessibilidade. O caminho visual está limitado a Play/Pause no Spotify; captura visual genérica, digitação livre e gestos não estão implementados.
- O standby precisa de validação manual com jogos reais, múltiplos monitores e tarefas em andamento.
- O instalador beta ainda não possui assinatura Authenticode pública, então o Windows pode exibir um aviso de reputação.
