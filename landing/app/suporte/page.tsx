import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

const ISSUES_URL = "https://github.com/ThiagoVenturaV/Assistente-de-Voz---Titi/issues/new/choose";

export const metadata: Metadata = {
  title: "Suporte — Titi",
  description: "Saiba como diagnosticar e relatar um problema no beta do Titi sem compartilhar conversas ou dados pessoais.",
  alternates: { canonical: "/suporte" },
  openGraph: { url: "/suporte", siteName: "Titi" },
};

export default function SupportPage() {
  return (
    <main className="privacy-page">
      <nav className="masthead shell privacy-masthead" aria-label="Navegação do suporte">
        <Link className="wordmark" href="/" aria-label="Titi — início">
          <span className="wordmark-pet"><Image src="/titi-icon.png" alt="" width={30} height={30} /></span>
          <span>Titi</span>
        </Link>
        <Link className="masthead-cta" href="/#download">Baixar beta <span>↘</span></Link>
      </nav>

      <header className="privacy-hero shell">
        <p className="eyebrow"><span>SUPORTE DO BETA</span><i /> diagnóstico sob seu controle</p>
        <h1>Conte o problema.<br /><em>Não os seus dados.</em></h1>
        <p>O Titi ainda é uma pré-release. Um bom relato informa a versão e a etapa que falhou, sem anexar conversas, áudio, tokens, caminhos pessoais ou capturas sensíveis.</p>
      </header>

      <article className="privacy-content shell">
        <section>
          <p className="privacy-index">01</p>
          <div><h2>Antes de relatar</h2><p>Abra <strong>Configurações → Atividade</strong> e confira a versão, a saúde da IA local, o áudio, o espaço livre e as ações recentes. Tente novamente apenas se a ação for segura e reversível.</p></div>
        </section>
        <section>
          <p className="privacy-index">02</p>
          <div><h2>Diagnóstico seguro</h2><p>Use <strong>Exportar diagnóstico</strong> somente se precisar. O arquivo é criado manualmente no local escolhido e não contém conversas, argumentos das ferramentas, URLs, caminhos, tokens ou identificadores de dispositivos. Nada é enviado automaticamente.</p></div>
        </section>
        <section>
          <p className="privacy-index">03</p>
          <div><h2>O que informar</h2><p>Inclua a versão do Titi, Windows 10 ou 11, o que você esperava, o que ocorreu e uma sequência curta de reprodução. Remova qualquer dado pessoal antes de anexar um arquivo.</p></div>
        </section>
        <section>
          <p className="privacy-index">04</p>
          <div><h2>Abrir um relato</h2><p>O canal atual é público. Revise todo o texto e os anexos antes de enviar. <a href={ISSUES_URL} target="_blank" rel="noreferrer">Abrir o suporte público →</a></p></div>
        </section>
      </article>

      <footer className="privacy-footer shell">
        <Link href="/">← Voltar ao site</Link>
        <Link href="/privacidade">Política de privacidade</Link>
      </footer>
    </main>
  );
}
