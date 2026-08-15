import type { Metadata } from "next";

const DOWNLOAD_URL = "https://github.com/ThiagoVenturaV/Assistente-de-Voz---Titi/releases/download/v0.1.0-beta/Titi-Setup-0.1.0.exe";
const REPO_URL = "https://github.com/ThiagoVenturaV/Assistente-de-Voz---Titi";

export const metadata: Metadata = {
  title: "Titi — Seu PC agora escuta você",
  description: "Um assistente local para Windows que conversa por texto e voz, com privacidade e personalidade.",
};

export default function Home() {
  return (
    <main className="site-frame">
      <nav className="masthead shell" aria-label="Navegação principal">
        <a className="wordmark" href="#inicio" aria-label="Titi — início">
          <span className="wordmark-pet"><img src="/titi-icon.png" alt="" /></span>
          <span>Titi</span>
        </a>
        <div className="masthead-links">
          <a href="#recursos">O que ele faz</a>
          <a href="#privacidade">Privacidade</a>
          <a href="#perguntas">Perguntas</a>
        </div>
        <a className="masthead-cta" href={DOWNLOAD_URL}>Baixar beta <span>↘</span></a>
      </nav>

      <section className="hero-new shell" id="inicio">
        <div className="hero-status"><span>Beta 0.1.0</span><i /> IA local para Windows</div>
        <h1><span>O seu PC.</span><br />Agora ele <em>escuta.</em></h1>
        <div className="hero-intro">
          <p>O Titi conversa por texto e voz hoje — e está evoluindo para transformar pedidos em ações no seu computador.</p>
          <div className="hero-actions-new">
            <a className="download-button" href={DOWNLOAD_URL}>
              <span className="windows-glyph">⊞</span>
              <span><strong>Baixar para Windows</strong><small>Grátis durante o beta</small></span>
              <b>↓</b>
            </a>
            <a className="text-link" href="#experiencia">Ver como funciona <span>→</span></a>
          </div>
        </div>

        <div className="product-stage" id="experiencia" aria-label="Conceito da experiência do aplicativo Titi">
          <div className="stage-grid" />
          <div className="stage-label stage-label--top"><span>●</span> EXPERIÊNCIA DO PRODUTO</div>
          <div className="stage-label stage-label--bottom">LOCAL / PRIVADO / SEU</div>
          <div className="titi-sprite hero-pet" role="img" aria-label="Mascote Titi acenando" />
          <div className="app-window">
            <div className="app-topbar"><span /><span /><span /><strong>Titi</strong><i>Local conectado</i></div>
            <div className="app-body">
              <aside><b>＋ Nova conversa</b><small>Hoje</small><p>Planejar meu dia</p><p>Ideias para o projeto</p></aside>
              <div className="mini-chat">
                <div className="live-pill"><i /> AO VIVO</div>
                <p className="user-bubble">Titi, abre o Spotify e coloca minha playlist de foco.</p>
                <div className="titi-message"><img src="/titi-icon.png" alt="" /><p><b>Deixa comigo.</b><br />Abrindo o Spotify e preparando sua playlist.</p></div>
                <div className="action-chip"><span>♪</span><div><small>VISÃO · EM DESENVOLVIMENTO</small><strong>Playlist Foco</strong></div><i>Pronto</i></div>
                <div className="composer">Converse com o Titi… <span>⌁ · ➤</span></div>
              </div>
            </div>
          </div>
          <div className="voice-orb"><span className="orb-core">⌁</span><i /><i /><i /><i /><i /></div>
        </div>

        <div className="hero-proof" aria-label="Destaques do Titi">
          <p><b>01</b><span><strong>Fale naturalmente</strong>Texto, aperte para falar ou conversa ao vivo.</span></p>
          <p><b>02</b><span><strong>Roda localmente</strong>Conversa e voz podem ficar no seu PC.</span></p>
          <p><b>03</b><span><strong>Feito para agir</strong>Uma central para seus aplicativos.</span></p>
        </div>
      </section>

      <div className="signal-line" aria-hidden="true">
        <div><span>TEXTO</span><i>✦</i><span>VOZ</span><i>✦</i><span>MODELO LOCAL</span><i>✦</i><span>MASCOTE VIVO</span><i>✦</i><span>WINDOWS</span><i>✦</i><span>PRIVACIDADE</span></div>
      </div>

      <section className="story-section shell" id="recursos">
        <header className="editorial-heading">
          <p><span>01</span> A EXPERIÊNCIA</p>
          <div>
            <h2>Não parece um comando.<br /><em>Parece uma conversa.</em></h2>
            <p>O Titi foi desenhado para tirar a interface do caminho. Você fala, acompanha o que ele entendeu e continua no controle.</p>
          </div>
        </header>

        <div className="experience-grid">
          <article className="voice-lab">
            <div className="card-topline"><span>CONVERSA AO VIVO</span><i>PROTÓTIPO</i></div>
            <div className="voice-display">
              <div className="voice-rings"><span>⌁</span><i /><i /><i /></div>
              <div className="voice-wave" aria-hidden="true">
                {Array.from({ length: 29 }).map((_, index) => <i key={index} />)}
              </div>
              <p>“Titi, o que eu tenho para fazer hoje?”</p>
            </div>
            <footer><span><i /> OUVINDO</span><p>Esc / para encerrar</p></footer>
          </article>

          <div className="mode-list">
            <article><span className="mode-number">01</span><div><h3>Aperte para falar</h3><p>Um botão rápido quando você quer dar um pedido e voltar ao que estava fazendo.</p></div><b>↗</b></article>
            <article><span className="mode-number">02</span><div><h3>Conversa ao vivo</h3><p>Uma experiência contínua, como falar com alguém que está ao seu lado.</p></div><b>↗</b></article>
            <article><span className="mode-number">03</span><div><h3>Texto quando quiser</h3><p>A mesma conversa continua no teclado, com histórico salvo localmente.</p></div><b>↗</b></article>
          </div>
        </div>
      </section>

      <section className="mascot-section shell" aria-label="Mascote Titi">
        <div className="mascot-copy">
          <p className="section-index"><span>02</span> PERSONALIDADE</p>
          <h2>Uma IA com<br /><em>cara de companhia.</em></h2>
          <p>O mascote reage enquanto escuta, pensa e fala. É um sinal visual simples: você sempre sabe o que o assistente está fazendo.</p>
          <div className="state-legend"><span><i className="dot-listening" /> Escutando</span><span><i className="dot-thinking" /> Pensando</span><span><i className="dot-speaking" /> Falando</span></div>
        </div>
        <div className="mascot-canvas">
          <div className="pixel-grid" />
          <span className="mascot-note mascot-note--a">ESTADO / FALANDO</span>
          <span className="mascot-note mascot-note--b">SPRITE 2D · PIXEL ART</span>
          <div className="mascot-halo" />
          <div className="titi-sprite titi-sprite--large" role="img" aria-label="Titi falando" />
          <div className="speech-card"><i /><p>Seu projeto está aberto.<br /><b>Quer continuar de onde parou?</b></p></div>
        </div>
      </section>

      <section className="agent-section" id="aplicativos">
        <div className="shell">
          <header className="agent-heading">
            <div><p className="section-index"><span>03</span> A PRÓXIMA ETAPA</p><h2>Um agente.<br />Todo o seu PC.</h2></div>
            <p>A visão do Titi é conectar sua voz às ferramentas que você já usa, com ações visíveis e permissões claras.</p>
          </header>
          <div className="apps-rail" aria-label="Integrações planejadas"><span><b>◎</b> Chrome</span><span><b>◈</b> Brave</span><span><b>●</b> Spotify</span><span><b>⌘</b> Codex</span><span><b>✣</b> Antigravity</span><span><b>＋</b> Mais apps</span></div>
          <div className="agent-showcase">
            <div className="command-flow">
              <div className="command-query"><span className="mini-pet"><img src="/titi-icon.png" alt="" /></span><p><small>VOCÊ DISSE</small>“Abre o projeto do Titi no Codex.”</p><b>⌁</b></div>
              <div className="flow-line"><i /><span>Entendendo intenção</span><i /></div>
              <div className="permission-card"><span>⌘</span><div><small>AÇÃO SOLICITADA</small><strong>Abrir Codex</strong><p>Projeto: Assistente de Voz — Titi</p></div><button type="button">Permitir</button></div>
            </div>
            <div className="agent-points">
              <article><b>01</b><h3>Entende o pedido</h3><p>Você fala do seu jeito. O agente transforma intenção em uma ação estruturada.</p></article>
              <article><b>02</b><h3>Mostra o que fará</h3><p>Nada acontece escondido. A interface informa aplicativo, alvo e resultado esperado.</p></article>
              <article><b>03</b><h3>Pede permissão</h3><p>Ações sensíveis só avançam com a sua confirmação explícita.</p></article>
            </div>
          </div>
          <p className="roadmap-disclaimer">Controle de aplicativos está no roadmap e ainda não faz parte do beta 0.1.0.</p>
        </div>
      </section>

      <section className="privacy-new" id="privacidade">
        <div className="shell privacy-new-grid">
          <div className="privacy-copy">
            <p className="section-index section-index--dark"><span>04</span> SOB SEU CONTROLE</p>
            <h2>Local não é<br />um detalhe.<br /><em>É o começo.</em></h2>
            <p>O Titi nasce com uma arquitetura local. O modelo, a transcrição e o histórico podem permanecer no seu computador.</p>
            <a href={REPO_URL} target="_blank" rel="noreferrer">Ver o código no GitHub <span>↗</span></a>
          </div>
          <div className="privacy-terminal">
            <div className="terminal-top"><span>titi / status</span><i>LOCAL</i></div>
            <div className="terminal-body"><p><span>01</span><b>Modelo de conversa</b><i>Ollama · local</i></p><p><span>02</span><b>Reconhecimento de voz</b><i>Whisper · local</i></p><p><span>03</span><b>Histórico</b><i>Seu perfil · local</i></p><p><span>04</span><b>Acesso externo</b><i>Desativado por padrão</i></p></div>
            <footer><span><i /> SISTEMA PRONTO</span><b>Dados sob seu controle</b></footer>
          </div>
        </div>
      </section>

      <section className="download-section shell" id="download">
        <div className="download-poster">
          <div className="download-poster-copy">
            <p><span>BETA PÚBLICO</span> V0.1.0</p>
            <h2>Dê voz ao<br />seu computador.</h2>
            <p className="poster-lead">Converse por texto, teste os dois modos de voz e conheça o Titi no seu próprio PC.</p>
            <a className="download-button download-button--light" href={DOWNLOAD_URL}><span className="windows-glyph">⊞</span><span><strong>Baixar Titi Beta</strong><small>Windows 10/11 · x64 · aprox. 519 MB</small></span><b>↓</b></a>
            <small className="checksum">SHA-256: <code>85D20AEB29A58D45…ECC3117DD3</code></small>
          </div>
          <div className="download-visual"><div className="poster-orbit poster-orbit--one" /><div className="poster-orbit poster-orbit--two" /><div className="titi-sprite titi-sprite--poster" role="img" aria-label="Mascote Titi" /><span>HELLO,<br />HUMAN.</span></div>
        </div>
        <div className="requirements-row"><article><span>01</span><p><b>Windows 10 ou 11</b>Sistema de 64 bits</p></article><article><span>02</span><p><b>16 GB de RAM</b>Ou mais recomendado</p></article><article><span>03</span><p><b>8 GB livres</b>Aplicativo + modelo</p></article><article><span>04</span><p><b>GPU NVIDIA</b>8 GB de VRAM recomendada</p></article></div>
        <p className="setup-note">O Titi ajuda a instalar o Ollama e o modelo local durante a primeira configuração.</p>
      </section>

      <section className="faq-new shell" id="perguntas">
        <header><p className="section-index"><span>05</span> PERGUNTAS FREQUENTES</p><h2>Antes de<br /><em>começar.</em></h2></header>
        <div className="faq-list-new">
          <details><summary><span>01</span>Preciso instalar o Ollama antes?<i /></summary><p>Não. Se ele não estiver instalado, o Titi oferece uma preparação assistida usando o instalador oficial. Se o serviço estiver parado, tenta iniciá-lo automaticamente.</p></details>
          <details><summary><span>02</span>O modelo já vem no instalador?<i /></summary><p>Não. O modelo de conversa tem aproximadamente 6,6 GB e só é baixado após sua confirmação. A transcrição de voz local já acompanha o instalador.</p></details>
          <details><summary><span>03</span>O beta já controla todos os aplicativos?<i /></summary><p>Ainda não. Chat, voz, configurações e mascote já funcionam. Controle de Chrome, Brave, Spotify, Codex e Antigravity está na próxima etapa.</p></details>
          <details><summary><span>04</span>Meus dados são enviados para a nuvem?<i /></summary><p>No modo atual, conversa, histórico e reconhecimento de voz são locais. Provedores online serão opcionais no futuro e claramente identificados.</p></details>
        </div>
      </section>

      <footer className="footer-new">
        <div className="shell footer-main"><a className="wordmark wordmark--footer" href="#inicio"><span className="wordmark-pet"><img src="/titi-icon.png" alt="" /></span><span>Titi</span></a><p>Um assistente local feito para tornar<br />o computador um pouco mais humano.</p><div><a href={REPO_URL} target="_blank" rel="noreferrer">GitHub ↗</a><a href="#download">Download ↓</a></div></div>
        <div className="shell footer-bottom"><span>© 2026 Titi</span><span>Feito no Brasil · Beta 0.1.0</span><a href="#inicio">Voltar ao topo ↑</a></div>
      </footer>
    </main>
  );
}
