# Backlog do Titi

## Onboarding: escolha do provedor de IA

Permitir que cada usuário escolha como a inteligência do assistente será executada durante o primeiro acesso:

- **OpenAI conectada:** oferecer autenticação/autorização oficial quando houver um fluxo compatível com aplicativos de terceiros.
- **API:** permitir cadastrar uma chave de API da OpenAI ou de outros provedores suportados, com armazenamento seguro no sistema operacional.
- **Modelos locais:** detectar runtimes como Ollama, llama.cpp ou LM Studio e recomendar modelos compatíveis com o hardware.

O onboarding deve explicar privacidade, custo, necessidade de internet, velocidade e qualidade de cada opção. A escolha poderá ser alterada depois nas configurações e poderá combinar um modelo local com serviços de nuvem usados apenas sob confirmação.

## Perfil de desenvolvimento atual

Para o computador de teste de Thiago, manter a decisão local-first:

- Ryzen 5 5600, 32 GB de RAM e RTX 2060 Super com 8 GB de VRAM.
- Modelo local `qwen3.5:9b` para orquestração e conversa.
- Reconhecimento e síntese de voz locais sempre que possível.
- Modos aperte-para-falar e conversa ao vivo.
- Colocar o modelo em standby ao abrir jogos.
- Integrações prioritárias: Chrome/Brave, Spotify, Codex App e Antigravity.

## Ferramentas do computador

Camada segura inicial implementada no harness do Ollama:

- abrir Chrome, Brave, Spotify, Codex App e Antigravity;
- navegar ou pesquisar na web usando apenas HTTP/HTTPS;
- pesquisar no Spotify e acionar controles de mídia do Windows;
- devolver cada resultado da ferramenta ao modelo antes da resposta final;
- limitar aplicativos, protocolos e comandos a uma lista permitida.

Próximos incrementos:

- focar e fechar aplicativos conhecidos com confirmação;
- encaminhar tarefas de programação para o Codex App;
- abrir e operar fluxos do Antigravity;
- reconhecer processos de jogos e colocar o modelo local em standby;
- pedir confirmação antes de ações destrutivas, compras, envios ou alterações sensíveis;
- manter registro local das ações solicitadas e executadas.

## Personalização do mascote

No primeiro acesso, perguntar: **“Como você quer chamar seu mascote?”**

- Salvar o nome no perfil local do usuário.
- Reproduzir uma apresentação por voz, por exemplo: “Oi, eu sou Titi.”
- Usar **Titi** como nome e mascote do perfil de desenvolvimento atual.

## Última prioridade: voz de resposta mais natural

Somente depois de todas as funções principais estarem estáveis e publicadas:

- substituir a voz padrão do Windows por uma voz neural mais humana;
- manter o processamento local sempre que o computador suportar;
- permitir escolher entre algumas vozes e ajustar velocidade, emoção e entonação;
- evitar que a geração de voz prejudique jogos ou tarefas mais pesadas;
- manter a voz atual como alternativa leve e compatível com qualquer computador.
