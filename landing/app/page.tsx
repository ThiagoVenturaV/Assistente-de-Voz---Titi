import { CommandDeck, MotionRuntime } from "./motion-runtime";
import Image from "next/image";

const DOWNLOAD_URL = "https://github.com/ThiagoVenturaV/Assistente-de-Voz---Titi/releases/download/v0.2.0-beta.6/Titi-Setup-0.2.0-beta.6.exe";

export default function Home() {
  return (
    <main className="site-frame" id="inicio">
      <MotionRuntime />
      <div className="scroll-progress" aria-hidden="true" />

      <nav className="masthead shell" aria-label="Navegação principal">
        <a className="wordmark" href="#inicio" aria-label="Titi — início">
          <span className="wordmark-pet"><Image src="/titi-icon.png" alt="" width={30} height={30} /></span>
          <span>Titi</span>
        </a>
        <div className="masthead-links">
          <a href="#como-funciona">Como funciona</a>
          <a href="#privacidade">Privacidade</a>
          <a href="#perguntas">Perguntas</a>
        </div>
        <a className="masthead-cta" href={DOWNLOAD_URL}>Baixar beta <span>↘</span></a>
      </nav>

      <section className="hero shell" aria-labelledby="hero-title">
        <div className="hero-copy" data-reveal>
          <p className="eyebrow"><span>BETA 0.2</span><i /> IA local para Windows</p>
          <h1 id="hero-title">Fale do<br />seu jeito.<br /><em>O PC faz.</em></h1>
          <p className="hero-lead">O Titi entende pedidos em linguagem natural, acompanha o contexto da conversa e transforma sua voz em ações — no seu computador.</p>
          <div className="hero-actions">
            <a className="primary-button" href={DOWNLOAD_URL}><span className="windows-glyph">⊞</span><span><strong>Baixar para Windows</strong><small>Grátis durante o beta</small></span><b>↓</b></a>
            <a className="round-link" href="#como-funciona" aria-label="Ver como o Titi funciona"><span>↓</span> Ver em ação</a>
          </div>
          <div className="hero-facts" aria-label="Principais benefícios">
            <span><i /> Fala e voz locais</span><span><i /> Contexto entre mensagens</span><span><i /> Ações no Windows</span>
          </div>
        </div>

        <div className="hero-visual" data-parallax="0.08" aria-label="Demonstração visual do Titi">
          <div className="hero-backword" aria-hidden="true">ENTENDE</div>
          <div className="hero-orbit hero-orbit--one" /><div className="hero-orbit hero-orbit--two" />
          <div className="hero-panel">
            <div className="panel-top"><span><i /><i /><i /></span><strong>Titi</strong><small><i /> local conectado</small></div>
            <div className="panel-body">
              <aside><span>＋</span><small>CONVERSAS</small><i /><i /><i /></aside>
              <div className="panel-chat">
                <p className="panel-status"><i /> AO VIVO · ENTENDENDO ENQUANTO VOCÊ FALA</p>
                <p className="panel-user">Titi, abre meu aplicativo de música e coloca alguma coisa calma.</p>
                <div className="panel-answer"><Image src="/titi-icon.png" alt="" width={26} height={26} /><p><small>ENTENDI</small>Abrindo seu aplicativo de música e iniciando uma seleção tranquila.</p></div>
                <div className="panel-action"><span>♪</span><p><small>AÇÃO CONCLUÍDA</small><b>Aplicativo aberto · tocando</b></p><i>Pronto</i></div>
                <div className="panel-composer">Converse com o Titi… <span>⌁</span></div>
              </div>
            </div>
          </div>
          <div className="titi-sprite hero-titi" role="img" aria-label="Mascote Titi" />
          <div className="voice-badge" data-parallax="0.16"><span>⌁</span><p><small>OUVINDO</small>Sua fala aparece ao vivo</p></div>
          <span className="visual-note visual-note--a">01 / LINGUAGEM NATURAL</span><span className="visual-note visual-note--b">LOCAL · PRIVADO · SEU</span>
        </div>
      </section>

      <div className="signal-line" aria-hidden="true"><div className="signal-track">{[0, 1].map((group) => <div className="signal-group" key={group}><span>VOCÊ FALA</span><i>✦</i><span>ELE ENTENDE</span><i>✦</i><span>O PC RESPONDE</span><i>✦</i><span>TUDO LOCAL</span><i>✦</i></div>)}</div></div>

      <section className="manifesto shell" data-reveal>
        <p className="section-index"><span>01</span> A IDEIA</p>
        <div className="manifesto-copy"><h2>Você não deveria<br />aprender a falar<br /><em>com a máquina.</em></h2><div><p>É a máquina que precisa entender você.</p><p>Por isso o Titi acompanha correções, referências e intenção. Você pode hesitar, mudar de ideia e continuar a frase — como em qualquer conversa.</p></div></div>
      </section>

      <section className="journey-section" id="como-funciona">
        <div className="journey-glow" aria-hidden="true" />
        <div className="shell journey-shell">
          <header className="journey-heading" data-reveal><p className="section-index section-index--dark"><span>02</span> DO PEDIDO À AÇÃO</p><h2>Três passos.<br /><em>Nenhum ritual.</em></h2><p>Sem decorar palavras mágicas. Sem abrir cinco menus antes de começar.</p></header>
          <div className="journey-stack">
            <article className="journey-card journey-card--voice" data-reveal>
              <div className="journey-number">01 <span>VOCÊ FALA</span></div><div className="journey-content"><h3>Do jeito que vier.</h3><p>A transcrição incremental aparece enquanto você fala. O Titi ouve o pedido sem esperar você terminar um discurso perfeito.</p></div>
              <div className="transcript-visual"><span><i /> OUVINDO AGORA</span><p>“Abre meu aplicativo de música e coloca…</p><p><b>não, espera,</b> primeiro abaixa o volume.”</p><div className="micro-wave" aria-hidden="true">{Array.from({ length: 31 }).map((_, index) => <i key={index} />)}</div></div>
            </article>
            <article className="journey-card journey-card--context" data-reveal>
              <div className="journey-number">02 <span>ELE ENTENDE</span></div><div className="journey-content"><h3>Inclusive quando você muda de ideia.</h3><p>Correções e referências continuam ligadas à conversa. O Titi entende o que “ele”, “aquilo” e “na verdade” querem dizer no contexto.</p></div>
              <div className="context-map" aria-label="Exemplo de contexto entre mensagens"><p>abre o editor <span>pedido</span></p><i /><p>na verdade, o outro <span>correção</span></p><i /><p><b>Antigravity</b> <span>alvo entendido</span></p></div>
            </article>
            <article className="journey-card journey-card--action" data-reveal>
              <div className="journey-number">03 <span>O PC RESPONDE</span></div><div className="journey-content"><h3>O resultado aparece.</h3><p>O Titi abre aplicativos compatíveis, pesquisa, aciona controles acessíveis e mostra o que aconteceu. Você não fica tentando adivinhar.</p></div>
              <div className="action-receipt"><div><span>◎</span><p><small>NAVEGADOR</small><b>Pesquisa preparada</b></p><i>FEITO</i></div><div><span>♪</span><p><small>MÚSICA</small><b>Reprodução iniciada</b></p><i>FEITO</i></div><div><span>⌘</span><p><small>EDITOR</small><b>Projeto localizado</b></p><i>FEITO</i></div></div>
            </article>
          </div>
        </div>
      </section>

      <section className="demo-section shell" id="recursos">
        <header className="demo-heading" data-reveal><p className="section-index"><span>03</span> EXPERIMENTE A LÓGICA</p><div><h2>Um pedido.<br /><em>Várias camadas<br />de entendimento.</em></h2><p>Troque o exemplo e veja como o Titi separa linguagem, intenção e ação.</p></div></header>
        <CommandDeck />
      </section>

      <section className="local-section" id="privacidade">
        <div className="shell local-grid">
          <div className="local-copy" data-reveal><p className="section-index section-index--dark"><span>04</span> INTELIGÊNCIA QUE MORA AÍ</p><h2>Sua voz não precisa<br />viajar para ser<br /><em>compreendida.</em></h2><p>A transcrição, a conversa e a voz neural podem rodar no seu próprio computador. Quando sua placa de vídeo está disponível, o Titi usa a GPU para responder com mais fluidez.</p><div className="local-points"><span><i>01</i> Fala processada localmente</span><span><i>02</i> Histórico guardado com você</span><span><i>03</i> Voz neural acelerada pela GPU</span></div></div>
          <div className="local-core" data-parallax="0.08" data-reveal><div className="core-grid" /><span className="core-ring core-ring--one" /><span className="core-ring core-ring--two" /><span className="core-ring core-ring--three" /><div className="core-center"><span>⌁</span><small>PROCESSANDO</small><b>NO SEU PC</b></div><p className="core-note core-note--one"><i /> VOZ LOCAL</p><p className="core-note core-note--two"><i /> GPU ATIVA</p><p className="core-note core-note--three"><i /> DADOS COM VOCÊ</p></div>
        </div>
      </section>

      <section className="companion-section shell" data-reveal>
        <div className="companion-canvas"><div className="companion-grid" /><span className="companion-label companion-label--one">ESTADO / FALANDO</span><span className="companion-label companion-label--two">MASCOTE VIVO · PIXEL ART</span><div className="companion-halo" /><div className="titi-sprite companion-titi" role="img" aria-label="Titi falando" /><div className="companion-message"><i /><p>Pronto. Seu navegador está aberto.<br /><b>O que você quer pesquisar?</b></p></div></div>
        <div className="companion-copy"><p className="section-index"><span>05</span> PRESENÇA, NÃO BARULHO</p><h2>Você sempre sabe<br /><em>o que ele está fazendo.</em></h2><p>O mascote reage quando escuta, pensa e fala. É personalidade com função: um sinal visual simples para deixar a tecnologia legível.</p><div className="state-legend"><span><i className="state-listening" /> Escutando</span><span><i className="state-thinking" /> Pensando</span><span><i className="state-speaking" /> Falando</span></div></div>
      </section>

      <section className="download-section shell" id="download">
        <div className="download-poster" data-reveal><div className="download-copy"><p><span>BETA PÚBLICO</span> V0.2.0 BETA.6</p><h2>Seu PC<br />já pode<br /><em>entender.</em></h2><p className="download-lead">Instale o Titi, fale naturalmente e descubra uma maneira mais humana de usar o Windows.</p><a className="primary-button primary-button--mint" href={DOWNLOAD_URL}><span className="windows-glyph">⊞</span><span><strong>Baixar Titi Beta</strong><small>Windows 10 ou 11 · aproximadamente 850 MB</small></span><b>↓</b></a></div><div className="download-art" data-parallax="0.06"><span className="download-orbit download-orbit--one" /><span className="download-orbit download-orbit--two" /><div className="titi-sprite download-titi" role="img" aria-label="Mascote Titi" /><p>OLÁ,<br />HUMANO.</p></div></div>
        <div className="requirements"><article><span>01</span><p><b>Windows 10 ou 11</b>Em um computador recente</p></article><article><span>02</span><p><b>16 GB de memória</b>Recomendados para conversar bem</p></article><article><span>03</span><p><b>Cerca de 8 GB livres</b>Para o aplicativo e o modelo local</p></article><article><span>04</span><p><b>GPU recomendada</b>Para voz e respostas mais rápidas</p></article></div>
        <p className="setup-note">Na primeira configuração, o Titi explica tudo antes de baixar o modelo adicional de aproximadamente 6,6 GB.</p>
      </section>

      <section className="faq-section shell" id="perguntas">
        <header data-reveal><p className="section-index"><span>06</span> PERGUNTAS FREQUENTES</p><h2>Antes de<br /><em>começar.</em></h2></header>
        <div className="faq-list" data-reveal><details><summary><span>01</span>Preciso configurar modelos manualmente?<i /></summary><p>Não. Na primeira vez, o Titi orienta a configuração e só baixa o modelo adicional depois da sua confirmação.</p></details><details><summary><span>02</span>Tudo já vem no instalador?<i /></summary><p>A interface, o mascote, a transcrição incremental e a voz neural local já vêm. O modelo de conversa, com aproximadamente 6,6 GB, é baixado depois.</p></details><details><summary><span>03</span>O que o Titi já consegue fazer no Windows?<i /></summary><p>O beta abre aplicativos compatíveis, usa seu navegador, pesquisa, controla Play/Pause no aplicativo de música e aciona controles acessíveis. A cobertura cresce a cada versão.</p></details><details><summary><span>04</span>Ele pede permissão antes de cada comando?<i /></summary><p>Durante o beta, os comandos compatíveis executam direto. O Antigravity permanece como uma confirmação especial antes da ação.</p></details><details><summary><span>05</span>Como interrompo uma conversa ao vivo?<i /></summary><p>Diga “parar” ou pressione Esc. O Titi encerra a escuta e devolve o controle imediatamente.</p></details><details><summary><span>06</span>Meus dados saem do computador?<i /></summary><p>Sua voz, suas conversas e seu histórico podem ficar no seu computador. Se uma ação pedida precisar de internet, como uma pesquisa, o Titi usa a conexão para essa ação.</p></details></div>
      </section>

      <footer className="footer"><div className="shell footer-main"><a className="wordmark wordmark--footer" href="#inicio"><span className="wordmark-pet"><Image src="/titi-icon.png" alt="" width={30} height={30} /></span><span>Titi</span></a><p>Uma conversa mais natural<br />entre você e o seu computador.</p><div><a href="#como-funciona">Como funciona ↑</a><a href="#privacidade">Privacidade ↑</a><a href="#download">Download ↓</a></div></div><div className="shell footer-bottom"><span>© 2026 Titi</span><span>Feito no Brasil · Beta público</span><a href="#inicio">Voltar ao topo ↑</a></div></footer>
    </main>
  );
}
