import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacidade — Titi",
  description: "Entenda quais dados o Titi processa localmente, quando usa a internet e como exportar ou apagar suas informações.",
  alternates: { canonical: "/privacidade" },
  openGraph: { url: "/privacidade", siteName: "Titi" },
};

const REPOSITORY_ISSUES = "https://github.com/ThiagoVenturaV/Assistente-de-Voz---Titi/issues";

export default function PrivacyPage() {
  return (
    <main className="privacy-page">
      <nav className="masthead shell privacy-masthead" aria-label="Navegação da política de privacidade">
        <Link className="wordmark" href="/" aria-label="Titi — início">
          <span className="wordmark-pet"><Image src="/titi-icon.png" alt="" width={30} height={30} /></span>
          <span>Titi</span>
        </Link>
        <Link className="masthead-cta" href="/#download">Baixar beta <span>↘</span></Link>
      </nav>

      <article className="privacy-document shell">
        <header>
          <p className="eyebrow"><span>TRANSPARÊNCIA</span><i /> Política de privacidade</p>
          <h1>Seus dados.<br /><em>Suas escolhas.</em></h1>
          <p>O Titi foi criado para processar voz, conversa e automação no seu computador por padrão. Esta política explica com precisão o que fica local, o que usa internet e como você controla o que é guardado.</p>
          <div className="privacy-summary" aria-label="Resumo da política">
            <span><b>Sem conta</b>O beta não exige cadastro.</span>
            <span><b>Sem telemetria</b>O aplicativo não envia analytics.</span>
            <span><b>Controle local</b>Você pode exportar ou apagar dados.</span>
          </div>
          <small>Versão da política: 19 de agosto de 2026.</small>
        </header>

        <section>
          <p className="privacy-index">01</p>
          <div><h2>O que é processado</h2><p><strong>Áudio e transcrição.</strong> Enquanto o microfone está ativo, o áudio é processado pelo Parakeet no próprio computador. No fluxo não incremental, um arquivo temporário pode existir durante a transcrição e é removido ao terminar. O Titi não mantém uma biblioteca de gravações.</p><p><strong>Conversa.</strong> O pedido transcrito, as mensagens e o contexto recente são enviados ao modelo Ollama configurado no endereço local do computador. Se o histórico estiver ligado, as mensagens são guardadas no perfil local do aplicativo.</p><p><strong>Voz de resposta.</strong> O texto da resposta é convertido em áudio localmente pelo Supertonic. Em hardware compatível, o DirectML usa a GPU; caso contrário, o processamento recua para a CPU.</p><p><strong>Telas.</strong> Quando você pede uma observação visual ou usa o fallback visual de Play/Pause, capturas dos monitores ou da janela ficam em memória e são analisadas pelo modelo visual local. O Titi não as grava no histórico nem as envia a um serviço de visão na nuvem.</p></div>
        </section>

        <section>
          <p className="privacy-index">02</p>
          <div><h2>O que pode ser guardado no PC</h2><p>O perfil privado do aplicativo no Windows pode conter configurações; conversas, se o histórico estiver ligado; atividade resumida e redigida; memórias que você pediu explicitamente para guardar; e receitas estruturadas de aplicativos já verificadas.</p><p>Logs de ferramentas ocultam URLs, buscas, credenciais e campos sensíveis. Memória e receitas não devem armazenar senhas, tokens ou cabeçalhos de autenticação.</p><p>Desligar o histórico torna as próximas conversas privadas e também impede novas atividades, memórias e receitas nessa sessão. As conversas antigas permanecem até você escolher apagá-las.</p></div>
        </section>

        <section>
          <p className="privacy-index">03</p>
          <div><h2>Quando a internet é usada</h2><p>O núcleo de conversa, transcrição e voz funciona localmente. A internet é necessária para baixar o instalador, o Ollama e modelos escolhidos; abrir páginas e pesquisas que você pediu; e usar serviços externos, como navegador ou aplicativo de música. Esses serviços possuem políticas próprias.</p><p>O aplicativo beta não contém telemetria, publicidade, fingerprint de dispositivo nem upload automático de diagnóstico. Uma futura integração em nuvem deverá pedir consentimento separado e explicar quais dados serão enviados antes de ser habilitada.</p><p>A landing page não inclui código de analytics ou publicidade. O provedor de hospedagem pode processar registros técnicos comuns de acesso e segurança conforme sua própria infraestrutura.</p></div>
        </section>

        <section>
          <p className="privacy-index">04</p>
          <div><h2>Como controlar e apagar</h2><p>Em <strong>Configurações → Privacidade</strong>, você pode desligar o histórico, exportar conversas e apagar conversas locais. Em <strong>Memória</strong>, pode revisar, remover ou limpar fatos e receitas. Em <strong>Atividade</strong>, pode limpar o registro resumido de ações.</p><p>Desinstalar o aplicativo não deve ser tratado como pedido automático para apagar o perfil. Essa separação evita perda acidental durante atualizações. A opção explícita de apagar dados na desinstalação ainda está em desenvolvimento e será informada antes de uma versão estável.</p></div>
        </section>

        <section>
          <p className="privacy-index">05</p>
          <div><h2>Segurança e limites</h2><p>O Titi restringe o renderer, valida mensagens internas e bloqueia comandos arbitrários, credenciais embutidas e ações externas protegidas. Mesmo assim, este é um beta: não use a automação para pagamentos, credenciais, publicação, exclusões externas ou decisões críticas.</p><p>Se você encontrar um problema de privacidade, descreva somente o comportamento e a versão, sem anexar conversa, token, senha ou captura pessoal. Abra um relato no <a href={REPOSITORY_ISSUES} target="_blank" rel="noreferrer">canal público de suporte</a>.</p></div>
        </section>
      </article>

      <footer className="footer privacy-footer"><div className="shell footer-bottom"><span>© 2026 Titi</span><span>Política local-first · Beta público</span><Link href="/">Voltar ao site ↑</Link></div></footer>
    </main>
  );
}
