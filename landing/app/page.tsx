import type { Metadata } from "next";

const DOWNLOAD_URL = "https://github.com/ThiagoVenturaV/Assistente-de-Voz---Titi/releases/download/v0.1.1-beta/Titi-Setup-0.1.1.exe";
const REPO_URL = "https://github.com/ThiagoVenturaV/Assistente-de-Voz---Titi";

export const metadata: Metadata = {
  title: "Titi — Seu PC agora escuta você",
  description: "Um assistente para Windows que conversa por texto e voz, ajuda nas tarefas e mantém você no controle.",
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
        <div className="hero-status"><span>Beta 0.1.1</span><i /> Feito para o seu computador</div>
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
          <div className="stage-label stage-label--bottom">SIMPLES / PRIVADO / SEU</div>
          <div className="titi-sprite hero-pet" role="img" aria-label="Mascote Titi acenando" />
          <div className="app-window">
            <div className="app-topbar"><span /><span /><span /><strong>Titi</strong><i>Tudo pronto</i></div>
            <div className="app-body">
              <aside><b>＋ Nova conversa</b><small>Hoje</small><p>Planejar meu dia</p><p>Ideias para o projeto</p></aside>
              <div className="mini-chat">
                <div className="live-pill"><i /> AO VIVO</div>
                <p className="user-bubble">Titi, abre meu aplicativo de música e coloca minha playlist de foco.</p>
                <div className="titi-message"><img src="/titi-icon.png" alt="" /><p><b>Deixa comigo.</b><br />Abrindo seu aplicativo de música e preparando a playlist.</p></div>
                <div className="action-chip"><span>♪</span><div><small>APLICATIVO DE MÚSICA</small><strong>Playlist Foco</strong></div><i>Pronto</i></div>
                <div className="composer">Converse com o Titi… <span>⌁ · ➤</span></div>
              </div>
            </div>
          </div>
          <div className="voice-orb"><span className="orb-core">⌁</span><i /><i /><i /><i /><i /></div>
        </div>

        <div className="hero-proof" aria-label="Destaques do Titi">
          <p><b>01</b><span><strong>Fale naturalmente</strong>Texto, aperte para falar ou conversa ao vivo.</span></p>
          <p><b>02</b><span><strong>Seus dados ficam com você</strong>Conversa e voz podem ficar no seu PC.</span></p>
          <p><b>03</b><span><strong>Feito para agir</strong>Uma central para seus aplicativos.</span></p>
        </div>
      </section>

      <div className="signal-line" aria-hidden="true">
        <div><span>TEXTO</span><i>✦</i><span>VOZ</span><i>✦</i><span>SEUS DADOS</span><i>✦</i><span>MASCOTE VIVO</span><i>✦</i><span>WINDOWS</span><i>✦</i><span>PRIVACIDADE</span></div>
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
            <div className="card-topline"><span>CONVERSA AO VIVO</span><i>EM TESTE</i></div>
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
            <article><span className="mode-number">03</span><div><h3>Texto quando quiser</h3><p>A mesma conversa continua no teclado, com o histórico guardado no seu computador.</p></div><b>↗</b></article>
          </div>
        </div>
      </section>

      <section className="mascot-section shell" aria-label="Mascote Titi">
        <div className="mascot-copy">
          <p className="section-index"><span>02</span> PERSONALIDADE</p>
          <h2>Um assistente com<br /><em>cara de companhia.</em></h2>
          <p>O mascote reage enquanto escuta, pensa e fala. É um sinal visual simples: você sempre sabe o que o assistente está fazendo.</p>
          <div className="state-legend"><span><i className="dot-listening" /> Escutando</span><span><i className="dot-thinking" /> Pensando</span><span><i className="dot-speaking" /> Falando</span></div>
        </div>
        <div className="mascot-canvas">
          <div className="pixel-grid" />
          <span className="mascot-note mascot-note--a">ESTADO / FALANDO</span>
          <span className="mascot-note mascot-note--b">MASCOTE · PIXEL ART</span>
          <div className="mascot-halo" />
          <div className="titi-sprite titi-sprite--large" role="img" aria-label="Titi falando" />
          <div className="speech-card"><i /><p>Seu projeto está aberto.<br /><b>Quer continuar de onde parou?</b></p></div>
        </div>
      </section>

      <section className="agent-section" id="aplicativos">
        <div className="shell">
          <header className="agent-heading">
            <div><p className="section-index"><span>03</span> A PRÓXIMA ETAPA</p><h2>Um agente.<br />Todo o seu PC.</h2></div>
            <p>A visão do Titi é conectar sua voz aos aplicativos que você já usa e mostrar cada passo antes de agir.</p>
          </header>
          <div className="apps-rail" aria-label="Aplicativos que o Titi pode ajudar a usar"><span><b>◎</b> Seu navegador</span><span><b>♪</b> Aplicativo de música</span><span><b>⌘</b> Editor de código</span><span><b>✣</b> Agente de código</span><span><b>◇</b> Seus jogos</span><span><b>＋</b> Outros aplicativos</span></div>
          <div className="agent-showcase">
            <div className="command-flow">
              <div className="command-query"><span className="mini-pet"><img src="/titi-icon.png" alt="" /></span><p><small>VOCÊ DISSE</small>“Abre o projeto do Titi no meu editor de código.”</p><b>⌁</b></div>
              <div className="flow-line"><i /><span>Entendendo seu pedido</span><i /></div>
              <div className="permission-card"><span>⌘</span><div><small>PRÓXIMO PASSO</small><strong>Abrir editor de código</strong><p>Projeto: Assistente de Voz — Titi</p></div><button type="button">Permitir</button></div>
            </div>
            <div className="agent-points">
              <article><b>01</b><h3>Entende o pedido</h3><p>Você fala do seu jeito. O Titi entende o que você quis fazer e prepara o próximo passo.</p></article>
              <article><b>02</b><h3>Mostra o que fará</h3><p>Nada acontece escondido. A interface informa aplicativo, alvo e resultado esperado.</p></article>
              <article><b>03</b><h3>Pede permissão</h3><p>Pedidos que precisam de mais cuidado só avançam depois da sua confirmação.</p></article>
            </div>
          </div>
          <p className="roadmap-disclaimer">Abrir aplicativos, navegar e controlar música já funciona; tarefas mais avançadas chegam nas próximas atualizações.</p>
        </div>
      </section>

      <section className="privacy-new" id="privacidade">
        <div className="shell privacy-new-grid">
          <div className="privacy-copy">
            <p className="section-index section-index--dark"><span>04</span> SOB SEU CONTROLE</p>
            <h2>Privacidade não é<br />um detalhe.<br /><em>É o começo.</em></h2>
            <p>O Titi foi pensado para manter suas conversas, sua voz e seu histórico no seu computador sempre que possível.</p>
            <a href={REPO_URL} target="_blank" rel="noreferrer">Ver o código no GitHub <span>↗</span></a>
          </div>
          <div className="privacy-terminal">
            <div className="terminal-top"><span>SEUS DADOS</span><i>PROTEGIDOS</i></div>
            <div className="terminal-body"><p><span>01</span><b>Conversas</b><i>No seu computador</i></p><p><span>02</span><b>Sua voz</b><i>Processada no seu computador</i></p><p><span>03</span><b>Histórico</b><i>Guardado com você</i></p><p><span>04</span><b>Conexões externas</b><i>Desligadas por padrão</i></p></div>
            <footer><span><i /> TUDO PRONTO</span><b>Você continua no controle</b></footer>
          </div>
        </div>
      </section>

      <section className="download-section shell" id="download">
        <div className="download-poster">
          <div className="download-poster-copy">
            <p><span>BETA PÚBLICO</span> V0.1.1</p>
            <h2>Dê voz ao<br />seu computador.</h2>
            <p className="poster-lead">Converse por texto, teste os dois modos de voz e conheça o Titi no seu próprio PC.</p>
            <a className="download-button download-button--light" href={DOWNLOAD_URL}><span className="windows-glyph">⊞</span><span><strong>Baixar Titi Beta</strong><small>Windows 10 ou 11 · aproximadamente 519 MB</small></span><b>↓</b></a>
          </div>
          <div className="download-visual"><div className="poster-orbit poster-orbit--one" /><div className="poster-orbit poster-orbit--two" /><div className="titi-sprite titi-sprite--poster" role="img" aria-label="Mascote Titi" /><span>HELLO,<br />HUMAN.</span></div>
        </div>
        <div className="requirements-row"><article><span>01</span><p><b>Windows 10 ou 11</b>Em um computador recente</p></article><article><span>02</span><p><b>Boa memória</b>16 GB recomendados</p></article><article><span>03</span><p><b>Espaço disponível</b>Cerca de 8 GB</p></article><article><span>04</span><p><b>Placa de vídeo</b>Recomendada para mais velocidade</p></article></div>
        <p className="setup-note">Na primeira configuração, o Titi orienta você e prepara tudo o que precisa.</p>
      </section>

      <section className="faq-new shell" id="perguntas">
        <header><p className="section-index"><span>05</span> PERGUNTAS FREQUENTES</p><h2>Antes de<br /><em>começar.</em></h2></header>
        <div className="faq-list-new">
          <details><summary><span>01</span>Preciso instalar algo antes?<i /></summary><p>Não. Na primeira vez, o Titi explica cada etapa e prepara o que estiver faltando.</p></details>
          <details><summary><span>02</span>Tudo já vem no instalador?<i /></summary><p>O essencial já vem. Uma parte da inteligência do Titi é baixada depois, apenas com a sua confirmação.</p></details>
          <details><summary><span>03</span>Que tipos de aplicativo o Titi pode abrir?<i /></summary><p>A proposta é funcionar com o que você já usa: navegador, aplicativo de música, editor, agente de código e outros programas. A compatibilidade cresce a cada atualização.</p></details>
          <details><summary><span>04</span>Meus dados saem do computador?<i /></summary><p>Suas conversas, sua voz e seu histórico podem ficar no seu computador. Se algum recurso precisar de internet, o Titi informa antes.</p></details>
        </div>
      </section>

      <footer className="footer-new">
        <div className="shell footer-main"><a className="wordmark wordmark--footer" href="#inicio"><span className="wordmark-pet"><img src="/titi-icon.png" alt="" /></span><span>Titi</span></a><p>Um assistente feito para tornar<br />o computador um pouco mais humano.</p><div><a href={REPO_URL} target="_blank" rel="noreferrer">GitHub ↗</a><a href="#download">Download ↓</a></div></div>
        <div className="shell footer-bottom"><span>© 2026 Titi</span><span>Feito no Brasil · Beta 0.1.1</span><a href="#inicio">Voltar ao topo ↑</a></div>
      </footer>
    </main>
  );
}
