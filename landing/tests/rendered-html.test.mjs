import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the Titi landing page", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Titi — Fale do seu jeito\. O PC entende e faz\.<\/title>/i);
  assert.match(html, /Fale do/);
  assert.match(html, /O PC faz/);
  assert.match(html, /Baixar Titi Beta/);
  assert.match(html, /v0\.2\.0-beta\.4\/Titi-Setup-0\.2\.0-beta\.4\.exe/);
  assert.match(html, /Perguntas frequentes/i);
  assert.match(html, /Seu navegador/);
  assert.match(html, /aplicativo de música/i);
  assert.match(html, /Antigravity/);
  assert.match(html, /aproximadamente 850 MB/);
  assert.match(html, /Diga “parar” ou pressione Esc/);
  assert.match(html, /acompanha correções, referências e intenção/);
  assert.match(html, /transcrição incremental aparece enquanto você fala/);
  assert.match(html, /Voz neural acelerada pela GPU/);
  assert.doesNotMatch(html, /SHA-256|Ollama|Whisper|Spotify|Chrome|Brave|Codex/);
  assert.doesNotMatch(html, />\s*GitHub\b|Ver o código no GitHub|issues\/new\/choose/i);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/);
});

test("keeps product metadata, motion fallbacks and accessible landmarks", async () => {
  const [css, page, layout, motion, packageJson] = await Promise.all([
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/motion-runtime.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /<nav[^>]+aria-label="Navegação principal"/);
  assert.match(page, /<main[^>]*>/);
  assert.match(page, /<details>/);
  assert.match(page, /className="signal-track"/);
  assert.doesNotMatch(page, /REPO_URL|FEEDBACK_URL|Ver o código no GitHub|>GitHub/);
  assert.match(page, /\[0, 1\]\.map/);
  assert.match(page, /<CommandDeck \/>/);
  assert.match(layout, /lang="pt-BR"/);
  assert.match(layout, /openGraph/);
  assert.match(layout, /og-v5\.png/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /@keyframes signal-scroll/);
  assert.match(css, /\.signal-line \.signal-track\{animation:none\}/);
  assert.match(motion, /IntersectionObserver/);
  assert.match(motion, /prefers-reduced-motion/);
  assert.match(motion, /passive: true/);
  assert.match(motion, /aria-selected/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
});
