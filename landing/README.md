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

Em produção, configure `NEXT_PUBLIC_SITE_URL` com a origem HTTPS canônica do site. Metadados absolutos não usam cabeçalhos `Host` enviados pelo cliente.

O botão principal aponta ao instalador público `Titi-Setup-0.2.0-beta.9.exe` da versão `v0.2.0-beta.9`. A release, os checksums finais e a landing pública Sites v23 foram validados em 20/08/2026.
