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
  assert.match(html, /<title>Titi — Seu PC, do seu jeito<\/title>/i);
  assert.match(html, /Seu PC, do seu jeito/);
  assert.match(html, /Baixar Titi Beta/);
  assert.match(html, /v0\.1\.0-beta\/Titi-Setup-0\.1\.0\.exe/);
  assert.match(html, /Perguntas frequentes/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/);
});

test("keeps product metadata and accessible landmarks", async () => {
  const [css, page, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /<nav[^>]+aria-label="Navegação principal"/);
  assert.match(page, /<main>/);
  assert.match(page, /<details>/);
  assert.match(layout, /lang="pt-BR"/);
  assert.match(layout, /openGraph/);
  assert.match(css, /prefers-reduced-motion/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
});
