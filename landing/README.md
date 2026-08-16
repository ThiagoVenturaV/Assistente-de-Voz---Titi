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

O botão principal aponta ao instalador público `Titi-Setup-0.2.0-beta.4.exe` da versão `v0.2.0-beta.4`. A landing só deve mudar de versão depois que o release e o hash final existirem.
