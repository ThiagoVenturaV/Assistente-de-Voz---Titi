# Assistente de Voz — Titi

Titi é um aplicativo desktop para Windows que reúne conversa por texto, voz local e um mascote 2D animado. A arquitetura usa um harness de provedores e ferramentas para crescer até controlar aplicativos do computador com confirmações de segurança.

> **Versão atual:** `0.1.0` — primeira versão funcional do aplicativo desktop.

## O que já funciona

- aplicativo gráfico instalável, sem depender de uma janela de terminal;
- interface minimalista com histórico local de conversas e configurações;
- mascote Titi flutuante com estados de ouvindo, pensando, falando, sucesso, erro e standby;
- chat local com Ollama e `qwen3.5:9b`;
- aperte-para-falar e conversa ao vivo;
- transcrição local com `whisper.cpp` e Whisper Small multilíngue;
- resposta falada com as vozes instaladas no Windows;
- onboarding com nome personalizado para o mascote;
- detecção e preparação assistida da IA local.

## Como usar

1. Execute `Titi-Setup-0.1.0.exe` e conclua a instalação gráfica.
2. Abra o Titi e escolha o nome do seu mascote.
3. Na etapa **IA local**, selecione **Preparar IA local** caso o computador ainda não esteja configurado.
4. Converse digitando no campo de mensagem, segurando **Aperte para falar** ou ativando o modo de conversa ao vivo.
5. Use **Configurações** para trocar o modelo, ajustar a voz, iniciar com o Windows ou ocultar o mascote flutuante.

O aplicativo pode ser aberto e configurado mesmo sem o Ollama. A conversa com o modelo ficará disponível depois que o mecanismo e o modelo local estiverem prontos.

## Primeira execução e Ollama

O instalador do Titi já contém a interface, o mascote e o runtime de transcrição. O modelo de conversa não é embutido porque tem aproximadamente 6,6 GB.

Na primeira execução, o aplicativo verifica quatro estados:

1. se o Ollama não existir, oferece **Instalar** e usa o instalador oficial após validar sua assinatura digital;
2. se o Ollama existir mas o serviço estiver parado, o Titi tenta iniciá-lo em segundo plano;
3. se o serviço estiver ativo mas `qwen3.5:9b` não existir, oferece **Baixar modelo** com progresso;
4. se tudo estiver disponível, mostra **IA local pronta**.

Nenhum download grande é iniciado sem uma ação explícita do usuário. Um modelo já instalado, mas fora da memória, é carregado automaticamente pelo Ollama na primeira mensagem.

Dependências oficiais utilizadas:

- [Ollama para Windows](https://docs.ollama.com/windows)
- [Qwen 3.5 no Ollama](https://ollama.com/library/qwen3.5)
- [whisper.cpp](https://github.com/ggml-org/whisper.cpp)

## Estado do projeto

| Recurso | Situação |
| --- | --- |
| Interface desktop e instalador | Implementado |
| Chat por texto com modelo local | Implementado |
| Aperte-para-falar e conversa ao vivo | Implementado |
| Mascote animado e flutuante | Implementado |
| Histórico e configurações locais | Implementado |
| Preparação assistida de Ollama e modelo | Implementado |
| Controle de Chrome/Brave e Spotify | Próxima etapa |
| Integração com Codex App e Antigravity | Próxima etapa |
| Standby automático durante jogos | Próxima etapa |
| Escolha entre IA local, OAuth e APIs | Backlog do produto |

As ferramentas que controlam outros aplicativos ainda não estão habilitadas nesta versão. Elas serão adicionadas com permissões explícitas, confirmação para ações sensíveis e registro local das execuções.

## Desenvolvimento

Requisitos: Node.js, pnpm e Windows 10/11.

```powershell
pnpm install
powershell -ExecutionPolicy Bypass -File .\scripts\setup-whisper.ps1
pnpm dev
```

Validação e empacotamento:

```powershell
pnpm typecheck
pnpm test
pnpm package:win
```

O instalador é gerado em `release/Titi-Setup-0.1.0.exe`. Os binários e o modelo do Whisper ficam fora do Git e são incorporados ao instalador durante o empacotamento.

O diretório `release/` também não é versionado devido ao tamanho do instalador. Builds destinadas a outras pessoas devem ser distribuídas como ativos de uma versão em **GitHub Releases**.

## Arquitetura

- `src/main`: processo principal do Electron, armazenamento, harness, provedor local e voz;
- `src/preload`: ponte IPC restrita entre interface e recursos nativos;
- `src/renderer`: interface React, chat, onboarding, configurações e animações;
- `src/shared`: contratos compartilhados;
- `mascotes/titi/package/titi`: pacote de animação Codex v2 do Titi;
- `runtime/whisper`: documentação e arquivos locais de reconhecimento de voz;
- `BACKLOG.md`: próximas integrações e opções de provedores.

## Hardware de desenvolvimento

O perfil atual usa Ryzen 5 5600, 32 GB de RAM e RTX 2060 Super com 8 GB de VRAM. O `qwen3.5:9b` roda pelo Ollama na GPU; o Whisper usa a CPU para não disputar VRAM com o modelo de conversa.

Integrações prioritárias da próxima etapa: Chrome ou Brave, Spotify, Codex App e Antigravity, além do standby automático do modelo durante jogos.
