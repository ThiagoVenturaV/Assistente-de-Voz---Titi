# Titi Beta 0.2.0-beta.1

Este candidato corrige o núcleo de ações no computador e adiciona memória local controlável. É uma prévia beta para teste, ainda sem assinatura digital de um certificado público.

## O que mudou

- Pedidos diretos para abrir Spotify, Brave, ChatGPT/Codex e Antigravity funcionam mesmo quando o Ollama está offline.
- O `qwen3.5:9b` foi validado localmente com quatro de quatro chamadas corretas de ferramenta.
- Aplicativos novos podem ser encontrados pelo Menu Iniciar, Windows Apps e pastas confiáveis. Caminhos, comandos e scripts vindos do modelo continuam bloqueados.
- Toda abertura de aplicativo pede confirmação. Quando um processo real é confirmado, o Titi pode guardar uma receita estruturada local para reutilizar.
- Ferramentas agora possuem validação de argumentos, limite de rodadas, proteção contra repetição, confirmação central e histórico local redigido.
- Memória e histórico são separados: frases explícitas como “lembre que meu navegador preferido é o Brave” criam uma memória que pode ser vista ou apagada nas configurações.
- Com histórico desligado, a conversa, a memória nova, as receitas novas e os registros de ferramentas não são persistidos.
- Escritas locais usam arquivo temporário e backup para reduzir perda por interrupção ou corrupção.
- O atalho global `Ctrl+Shift+Espaço` inicia e termina uma captura de voz fora da janela.
- Ao detectar um jogo em tela cheia, o Titi pausa a escuta, oculta o mascote e descarrega o modelo; ao sair, restaura a experiência sem iniciar o modelo até ele ser necessário.
- Ollama e verificações auxiliares iniciam ocultos, sem shell, e o Titi encerra apenas o processo que ele próprio iniciou.

## Instalação e dados

O instalador pode ser executado normalmente após remover uma versão anterior. Configurações e conversas preservadas em `%APPDATA%\titi-desktop` são reutilizadas. O modelo de conversa continua sendo um download separado de aproximadamente 6,6 GB.

## Limites conhecidos

- Delegar uma tarefa completa para Codex/Antigravity e operar botões internos de qualquer aplicativo ainda não está implementado; nesta versão o Titi encontra e abre esses aplicativos.
- O detector de jogos é conservador e ainda precisa de validação manual com jogos reais, tela cheia e múltiplos monitores.
- A voz usa as vozes instaladas no Windows; voz neural permanece como última etapa do backlog.
- O instalador beta ainda não possui assinatura Authenticode pública, então o Windows pode exibir um aviso de reputação.
