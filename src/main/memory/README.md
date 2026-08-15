# Memória local do Titi

Esta pasta contém a memória persistente e **curada** do agente. Ela não é uma
cópia das conversas.

- **Histórico** guarda mensagens completas para o usuário reler uma conversa.
- **Memória** guarda somente fatos, preferências e receitas verificadas que
  serão úteis em conversas futuras.
- **Sessão privada** (`keepHistory: false`) continua existindo em RAM enquanto
  está aberta, mas não pode ensinar nada à memória persistente.

`LocalMemoryStore` exige um `MemoryWriteContext` em toda operação de
aprendizado. Assim, não há uma variante de escrita que possa esquecer de
aplicar a regra de privacidade. Apagar e limpar são sempre permitidos porque
são ações explícitas de controle do usuário.

O `AssistantHarness` consulta essa memória somente quando `keepHistory` está
ativo. Com ele desligado, o conteúdo persistente não é lido nem injetado no
modelo. A tela **Configurações → Memória** continua disponível como controle
explícito do dono do computador para revisar ou apagar seus dados.

Receitas representam sequências de ferramentas que já funcionaram. Uma
receita não verificada é recusada, duplicatas atualizam o registro existente e
limites removem os registros menos recentes. Campos de argumentos com nomes de
segredo, senha, cookie, autorização, token ou chave de API nunca são gravados.
`buildPromptContext()` produz um bloco pequeno e determinístico para integração
futura com o prompt do modelo.

Exemplo da regra usada pela integração:

```ts
const memory = new LocalMemoryStore(app.getPath('userData'))
const context = settings.keepHistory
  ? await memory.buildPromptContext()
  : ''

await memory.rememberPreference(
  { key: 'navegador padrão', value: 'Brave' },
  {
    keepHistory: settings.keepHistory,
    source: { kind: 'user-statement', conversationId }
  }
)
```

O aprendizado de perfil pelo chat também é conservador: somente comandos
inequívocos, como “lembre que meu navegador preferido é o Brave”, são
interpretados por `parseExplicitMemoryCommand`. Uma afirmação comum ou uma
pergunta nunca vira memória automaticamente.
