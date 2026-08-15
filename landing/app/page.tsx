import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Titi — Seu PC, do seu jeito",
  description: "Um assistente local para Windows que conversa por texto e voz, com privacidade e personalidade.",
};

export default function Home() {
  return (
    <main>
      <nav className="nav shell" aria-label="Navegação principal">
        <a className="brand" href="#inicio" aria-label="Titi — início">
          <img src="/titi-icon.png" alt="" />
          <span>Titi</span>
          <small>Beta</small>
        </a>
        <div className="nav-links">
          <a href="#recursos">Recursos</a>
          <a href="#privacidade">Privacidade</a>
          <a className="nav-download" href="https://github.com/ThiagoVenturaV/Assistente-de-Voz---Titi/releases/download/v0.1.0-beta/Titi-Setup-0.1.0.exe">
            Baixar beta
          </a>
        </div>
      </nav>

      <section className="hero shell" id="inicio">
        <div className="hero-copy">
          <p className="eyebrow"><i /> Feito para Windows · IA local</p>
          <h1>Seu PC, do seu jeito.<br /><span>Só precisa pedir.</span></h1>
          <p className="hero-lead">
            Converse por texto ou voz com um assistente que vive no seu computador — rápido, privado e com a companhia do Titi.
          </p>
          <div className="hero-actions">
            <a className="primary-cta" href="https://github.com/ThiagoVenturaV/Assistente-de-Voz---Titi/releases/download/v0.1.0-beta/Titi-Setup-0.1.0.exe">
              <span className="download-mark">↓</span>
              <span><strong>Baixar para Windows</strong><small>Beta 0.1.0 · Windows 10/11</small></span>
            </a>
            <a className="secondary-cta" href="#recursos">Conhecer o Titi <span>↘</span></a>
          </div>
          <p className="download-note">Grátis durante o beta · Seus dados ficam no seu PC</p>
        </div>

        <div className="hero-product" aria-label="Prévia do aplicativo Titi">
          <div className="glow" />
          <div className="titi-sprite" role="img" aria-label="Mascote Titi acenando" />
          <div className="app-window">
            <div className="app-topbar"><span /><span /><span /><strong>Titi</strong><i>Local conectado</i></div>
            <div className="app-body">
              <aside><b>＋ Nova conversa</b><small>Conversas</small><p>Planejar meu dia</p><p>Ideias para o projeto</p></aside>
              <div className="mini-chat">
                <p className="user-bubble">Titi, me ajuda a organizar meu dia?</p>
                <div className="titi-message"><img src="/titi-icon.png" alt="" /><p><b>Claro! Vamos começar pelas suas prioridades.</b><br />Posso transformar tudo em um plano simples e acompanhar com você.</p></div>
                <div className="composer">Converse com o Titi… <span>⌁　➤</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="trust-strip" aria-label="Destaques do Titi">
        <div className="shell trust-grid">
          <p><strong>Local por padrão</strong><span>Conversas no seu computador</span></p>
          <p><strong>Texto + voz</strong><span>Use do jeito que for mais natural</span></p>
          <p><strong>Feito para Windows</strong><span>Um aplicativo, não um terminal</span></p>
        </div>
      </section>

      <section className="section shell" id="recursos">
        <header className="section-heading">
          <p className="eyebrow"><i /> Mais simples de usar</p>
          <h2>Um assistente que parece<br />parte do seu computador.</h2>
          <p>O Titi reúne conversa, voz e personalidade em uma interface discreta que não atrapalha seu fluxo.</p>
        </header>

        <div className="feature-grid">
          <article className="feature-card feature-card--voice">
            <div className="feature-icon">⌁</div>
            <p className="card-kicker">CONVERSE NATURALMENTE</p>
            <h3>Fale ou escreva.<br />O Titi acompanha.</h3>
            <p>Segure para falar, ative a conversa ao vivo ou simplesmente digite. A mesma conversa continua em qualquer modo.</p>
            <div className="voice-demo"><span className="mic-dot">●</span><div className="wave"><i /><i /><i /><i /><i /><i /><i /></div><b>Ouvindo…</b></div>
          </article>

          <article className="feature-card feature-card--mascot">
            <p className="card-kicker">SEU COMPANHEIRO DIGITAL</p>
            <h3>Um mascote com vida.</h3>
            <p>O Titi escuta, pensa, fala e reage ao que está acontecendo — sempre por perto, nunca no caminho.</p>
            <div className="mascot-stage"><span className="orbit orbit-one" /><span className="orbit orbit-two" /><div className="titi-sprite titi-sprite--feature" /></div>
          </article>

          <article className="feature-card feature-card--local" id="privacidade">
            <div className="feature-icon">◇</div>
            <p className="card-kicker">PRIVACIDADE DE VERDADE</p>
            <h3>Sua IA. No seu PC.</h3>
            <p>O modelo de conversa e a transcrição de voz podem rodar localmente. Seus dados não precisam sair da máquina.</p>
            <div className="local-flow"><span>Você</span><i>→</i><span className="local-core">Titi local</span><i>→</i><span>Resposta</span></div>
          </article>

          <article className="feature-card feature-card--control">
            <div className="feature-icon">⌘</div>
            <p className="card-kicker">FEITO PARA EVOLUIR</p>
            <h3>Uma central para o seu PC.</h3>
            <p>A base para controlar navegador, música, programação e outros aplicativos com permissões claras.</p>
            <div className="integration-list"><span>Chrome / Brave</span><span>Spotify</span><span>Codex</span><span>Antigravity</span></div>
            <small className="roadmap-label">Integrações em desenvolvimento</small>
          </article>
        </div>
      </section>

      <section className="privacy-section">
        <div className="shell privacy-layout">
          <div>
            <p className="eyebrow"><i /> Sob seu controle</p>
            <h2>Privacidade não é<br />um modo opcional.</h2>
            <p className="privacy-lead">O Titi foi pensado para começar localmente. Você sabe onde os dados ficam e decide quando conectar algo externo.</p>
            <a href="https://github.com/ThiagoVenturaV/Assistente-de-Voz---Titi" target="_blank" rel="noreferrer">Ver o projeto no GitHub <span>↗</span></a>
          </div>
          <ol className="privacy-list">
            <li><b>01</b><div><strong>Histórico local</strong><p>Conversas e preferências ficam armazenadas no perfil do aplicativo neste computador.</p></div></li>
            <li><b>02</b><div><strong>Downloads transparentes</strong><p>O modelo de 6,6 GB só é baixado depois da sua confirmação, com progresso visível.</p></div></li>
            <li><b>03</b><div><strong>Permissões explícitas</strong><p>Ações sensíveis e futuras integrações serão executadas somente com o seu controle.</p></div></li>
          </ol>
        </div>
      </section>

      <section className="section shell beta-section" id="download">
        <div className="beta-copy">
          <p className="eyebrow"><i /> Beta público · v0.1.0</p>
          <h2>Conheça o Titi<br />no seu próprio PC.</h2>
          <p>Esta é a primeira versão funcional. Você já pode conversar por texto e voz, testar o mascote flutuante e acompanhar o projeto evoluindo.</p>
          <a className="primary-cta primary-cta--large" href="https://github.com/ThiagoVenturaV/Assistente-de-Voz---Titi/releases/download/v0.1.0-beta/Titi-Setup-0.1.0.exe">
            <span className="download-mark">↓</span>
            <span><strong>Baixar Titi Beta</strong><small>Instalador para Windows x64 · aproximadamente 519 MB</small></span>
          </a>
          <p className="checksum">SHA-256: <code>85D20AEB…3117DD3</code></p>
        </div>
        <div className="requirements-card">
          <div className="windows-mark">⊞</div>
          <h3>Requisitos recomendados</h3>
          <dl>
            <div><dt>Sistema</dt><dd>Windows 10 ou 11 · 64 bits</dd></div>
            <div><dt>Memória</dt><dd>16 GB de RAM ou mais</dd></div>
            <div><dt>Espaço livre</dt><dd>8 GB para aplicativo e modelo</dd></div>
            <div><dt>GPU</dt><dd>NVIDIA com 8 GB de VRAM recomendada</dd></div>
          </dl>
          <p>O Titi ajuda a instalar o Ollama e o modelo local durante a primeira configuração.</p>
        </div>
      </section>

      <section className="faq shell">
        <header className="section-heading section-heading--compact"><p className="eyebrow"><i /> Antes de baixar</p><h2>Perguntas frequentes.</h2></header>
        <div className="faq-list">
          <details><summary>Preciso instalar o Ollama antes?</summary><p>Não. Se ele não estiver instalado, o Titi oferece uma preparação assistida usando o instalador oficial. Se o serviço estiver parado, tenta iniciá-lo automaticamente.</p></details>
          <details><summary>O modelo já vem dentro do instalador?</summary><p>Não. O modelo de conversa tem aproximadamente 6,6 GB e só é baixado após sua confirmação. A transcrição de voz local já acompanha o instalador.</p></details>
          <details><summary>O beta já controla todos os aplicativos?</summary><p>Ainda não. Chat, voz, configurações e mascote já funcionam. Controle de Chrome, Brave, Spotify, Codex e Antigravity está na próxima etapa.</p></details>
          <details><summary>Meus dados são enviados para a nuvem?</summary><p>No modo atual, conversa, histórico e reconhecimento de voz são locais. Provedores online serão opcionais no futuro e claramente identificados.</p></details>
        </div>
      </section>

      <footer>
        <div className="shell footer-grid">
          <a className="brand" href="#inicio"><img src="/titi-icon.png" alt="" /><span>Titi</span><small>Beta</small></a>
          <p>Um assistente local, feito para tornar o computador mais humano.</p>
          <div><a href="https://github.com/ThiagoVenturaV/Assistente-de-Voz---Titi" target="_blank" rel="noreferrer">GitHub ↗</a><a href="#download">Download</a></div>
        </div>
      </footer>
    </main>
  );
}
