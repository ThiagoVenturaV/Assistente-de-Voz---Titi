"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

const DEMOS = [
  {
    label: "Música",
    command: "Titi, abre meu aplicativo de música e dá play.",
    thought: "Abrindo o aplicativo e procurando o controle de reprodução",
    result: "Aplicativo aberto · reprodução iniciada",
    icon: "♪",
  },
  {
    label: "Navegador",
    command: "Pesquisa um restaurante tranquilo perto de mim para hoje à noite.",
    thought: "Abrindo o navegador e preparando a pesquisa",
    result: "Navegador aberto · pesquisa pronta",
    icon: "◎",
  },
  {
    label: "Projeto",
    command: "Abre o projeto do Titi no meu editor. Não, no Antigravity.",
    thought: "Entendi a correção e mantive o contexto do pedido",
    result: "Antigravity identificado · aguardando sua permissão",
    icon: "⌘",
  },
] as const;

export function MotionRuntime() {
  useEffect(() => {
    const root = document.documentElement;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const revealItems = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    const parallaxItems = Array.from(document.querySelectorAll<HTMLElement>("[data-parallax]"));

    root.dataset.motion = "ready";

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -10%", threshold: 0.12 },
    );

    revealItems.forEach((item) => observer.observe(item));

    let frame = 0;
    const updateScroll = () => {
      frame = 0;
      const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      root.style.setProperty("--scroll-progress", `${Math.min(1, window.scrollY / maxScroll)}`);

      if (!reduceMotion) {
        parallaxItems.forEach((item) => {
          const rect = item.getBoundingClientRect();
          const centerDelta = rect.top + rect.height / 2 - window.innerHeight / 2;
          const speed = Number(item.dataset.parallax ?? 0.1);
          const offset = Math.max(-90, Math.min(90, centerDelta * speed * -1));
          item.style.setProperty("--parallax-y", `${offset.toFixed(2)}px`);
        });
      }
    };

    const requestScrollUpdate = () => {
      if (!frame) frame = window.requestAnimationFrame(updateScroll);
    };

    const updatePointer = (event: PointerEvent) => {
      root.style.setProperty("--pointer-x", `${event.clientX}px`);
      root.style.setProperty("--pointer-y", `${event.clientY}px`);
    };

    updateScroll();
    window.addEventListener("scroll", requestScrollUpdate, { passive: true });
    window.addEventListener("resize", requestScrollUpdate, { passive: true });
    if (!reduceMotion && window.matchMedia("(pointer: fine)").matches) {
      window.addEventListener("pointermove", updatePointer, { passive: true });
    }

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", requestScrollUpdate);
      window.removeEventListener("resize", requestScrollUpdate);
      window.removeEventListener("pointermove", updatePointer);
      delete root.dataset.motion;
    };
  }, []);

  return <div className="cursor-glow" aria-hidden="true" />;
}

export function CommandDeck() {
  const [active, setActive] = useState(0);
  const demo = DEMOS[active];

  return (
    <div className="command-deck" data-reveal>
      <div className="command-tabs" role="tablist" aria-label="Exemplos do Titi em ação">
        {DEMOS.map((item, index) => (
          <button
            key={item.label}
            type="button"
            role="tab"
            aria-selected={active === index}
            className={active === index ? "is-active" : ""}
            onClick={() => setActive(index)}
          >
            <span>{String(index + 1).padStart(2, "0")}</span>
            {item.label}
          </button>
        ))}
      </div>

      <div className="command-screen" key={demo.label} role="tabpanel" aria-live="polite">
        <div className="screen-topline">
          <span><i /> CONVERSA AO VIVO</span>
          <span>LOCAL · AGORA</span>
        </div>
        <div className="screen-dialogue">
          <p className="screen-you"><small>VOCÊ DISSE</small>{demo.command}</p>
          <div className="screen-thinking"><span className="mini-titi"><Image src="/titi-icon.png" alt="" width={39} height={39} /></span><p><small>TITI ENTENDEU</small>{demo.thought}</p></div>
          <div className="screen-result"><span>{demo.icon}</span><p><small>AÇÃO NO WINDOWS</small><strong>{demo.result}</strong></p><i>Pronto</i></div>
        </div>
        <div className="screen-wave" aria-hidden="true">
          {Array.from({ length: 37 }).map((_, index) => <i key={index} />)}
        </div>
      </div>
    </div>
  );
}
