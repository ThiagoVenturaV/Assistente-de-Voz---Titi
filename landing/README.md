# Landing page do Titi

Página pública da versão beta do assistente local Titi.

## Desenvolvimento

```bash
npm install
npm run dev
```

Validação:

```bash
npm run build
node --test tests/rendered-html.test.mjs
```

O botão principal está preparado para apontar ao instalador `Titi-Setup-0.2.0-beta.2.exe` da versão `v0.2.0-beta.2`. Não publique a landing antes de o release e o hash final existirem.
