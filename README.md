# Assistente de Voz — Titi

Titi é o mascote de um futuro assistente de voz para Windows capaz de conversar, abrir e controlar aplicativos e encaminhar tarefas especializadas para ferramentas como o Codex.

## Estado atual

O primeiro ativo concluído é o mascote animado Titi:

- visual 2D semi-pixel, inclusivo e apropriado para públicos variados;
- pacote Codex v2 em atlas 8×11, com células de 192×208;
- 9 estados padrão de animação;
- 16 direções de olhar;
- validação estrutural, revisão visual e revisão cega de direções aprovadas.

Arquivos principais:

- `mascotes/titi/package/titi/pet.json`
- `mascotes/titi/package/titi/spritesheet.webp`
- `mascotes/titi/qa/contact-sheet-extended.png`
- `BACKLOG.md`

## Perfil de desenvolvimento

O protótipo será local-first no computador de teste: Ryzen 5 5600, 32 GB de RAM e RTX 2060 Super com 8 GB de VRAM. A configuração planejada usa um modelo quantizado de 7–8B, voz local, modos aperte-para-falar e conversa ao vivo e standby do modelo durante jogos.

Integrações prioritárias: Chrome ou Brave, Spotify, Codex App e Antigravity.

## Próximos passos

1. Criar o shell flutuante do Windows e renderizar as animações do Titi.
2. Implementar captura de voz local e síntese de fala.
3. Adicionar orquestração segura de aplicativos e confirmações para ações sensíveis.
4. Acrescentar estados do produto como ouvindo, pensando, falando e standby.
5. Implementar no futuro a escolha do provedor de IA no onboarding, conforme o backlog.
