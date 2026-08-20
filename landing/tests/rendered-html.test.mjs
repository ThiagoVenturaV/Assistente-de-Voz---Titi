import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }),
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
  assert.match(html, /V0\.2\.0 BETA\.7/);
  assert.match(html, /v0\.2\.0-beta\.7\/Titi-Setup-0\.2\.0-beta\.7\.exe/);
  assert.match(html, /Perguntas frequentes/i);
  assert.match(html, /Seu navegador/);
  assert.match(html, /aplicativo de música/i);
  assert.match(html, /Antigravity/);
  assert.match(html, /851,32 MiB/);
  assert.match(html, /Sem assinatura · o SmartScreen pode avisar/);
  assert.match(html, /Política de privacidade/);
  assert.match(html, /Diga “parar” ou pressione Esc/);
  assert.match(html, /acompanha correções, referências e intenção/);
  assert.match(html, /transcrição incremental aparece enquanto você fala/);
  assert.match(html, /Voz neural acelerada pela GPU/);
  assert.match(html, /rel="canonical"[^>]+titi-assistente\.thiago2013ventura\.chatgpt\.site/i);
  assert.match(html, /property="og:url"/i);
  assert.match(html, /property="og:site_name"[^>]+content="Titi"/i);
  assert.match(html, /application\/ld\+json/);
  assert.match(html, /SoftwareApplication/);
  assert.match(html, /href="\/suporte"/);
  assert.doesNotMatch(html, /TUDO LOCAL/);
  assert.doesNotMatch(html, /SHA-256|Ollama|Whisper|Spotify|Chrome|Brave|Codex/);
  assert.doesNotMatch(html, />\s*GitHub\b|Ver o código no GitHub|issues\/new\/choose/i);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/);
});

test("publishes a complete local-first privacy policy", async () => {
  const response = await render("/privacidade");
  assert.equal(response.status, 200);
  const html = await response.text();

  assert.match(html, /Privacidade — Titi/);
  assert.match(html, /Áudio e transcrição/);
  assert.match(html, /Conversa/);
  assert.match(html, /Voz de resposta/);
  assert.match(html, /Telas/);
  assert.match(html, /Quando a internet é usada/);
  assert.match(html, /Sem telemetria/);
  assert.match(html, /Como controlar e apagar/);
  assert.match(html, /Configurações → Privacidade/);
  assert.match(html, /19 de agosto de 2026/);
  assert.match(html, /rel="canonical"[^>]+\/privacidade/i);
});

test("publishes privacy-safe support guidance", async () => {
  const response = await render("/suporte");
  assert.equal(response.status, 200);
  const html = await response.text();

  assert.match(html, /Suporte — Titi/);
  assert.match(html, /Configurações → Atividade/);
  assert.match(html, /Exportar diagnóstico/);
  assert.match(html, /Nada é enviado automaticamente/);
  assert.match(html, /não contém conversas/i);
  assert.match(html, /rel="canonical"[^>]+\/suporte/i);
});

test("publishes robots and sitemap discovery routes", async () => {
  const [robotsResponse, sitemapResponse] = await Promise.all([
    render("/robots.txt"),
    render("/sitemap.xml"),
  ]);
  assert.equal(robotsResponse.status, 200);
  assert.equal(sitemapResponse.status, 200);

  const robots = await robotsResponse.text();
  const sitemap = await sitemapResponse.text();
  assert.match(robots, /User-Agent:\s*\*/i);
  assert.match(robots, /Allow:\s*\//i);
  assert.match(robots, /Sitemap:.*\/sitemap\.xml/i);
  assert.match(sitemap, /titi-assistente\.thiago2013ventura\.chatgpt\.site\//i);
  assert.match(sitemap, /\/privacidade/);
  assert.match(sitemap, /\/suporte/);
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
  assert.match(layout, /og-brand\.png/);
  assert.match(layout, /favicon\.ico/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /\.footer-main > div a \{ min-height: 44px/);
  assert.match(css, /\.hero-disclosure \{[^}]*font-size: 10px/);
  assert.match(css, /\.download-trust \{[^}]*font-size: 11px/);
  assert.match(css, /\.masthead a,[^}]*min-height: 44px/);
  assert.match(css, /@keyframes signal-scroll/);
  assert.match(css, /\.signal-line \.signal-track\{animation:none\}/);
  assert.match(motion, /IntersectionObserver/);
  assert.match(motion, /prefers-reduced-motion/);
  assert.match(motion, /passive: true/);
  assert.match(motion, /aria-selected/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
});
