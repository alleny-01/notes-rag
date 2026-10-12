import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { RefObject } from "react";

gsap.registerPlugin(ScrollTrigger);

export function useOnboardingMotion(root: RefObject<HTMLElement | null>) {
  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      gsap.from(".nav-reveal, .hero-eyebrow, .hero-copy > *", {
        y: 24,
        opacity: 0,
        duration: 0.85,
        stagger: 0.08,
        ease: "power3.out",
      });
      gsap.from(".hero-product", {
        y: 44,
        rotate: 1.5,
        opacity: 0,
        duration: 1.2,
        delay: 0.25,
        ease: "power4.out",
      });
      gsap.utils.toArray<HTMLElement>(".reveal").forEach((item) => {
        gsap.from(item, {
          y: 42,
          opacity: 0,
          duration: 0.8,
          ease: "power3.out",
          scrollTrigger: { trigger: item, start: "top 82%" },
        });
      });
      gsap.to(".signal-orbit", {
        rotate: 360,
        duration: 28,
        repeat: -1,
        ease: "none",
      });
      gsap.utils
        .toArray<HTMLElement>(".process-card")
        .forEach((card, index) => {
          gsap.fromTo(
            card,
            { y: index === 0 ? 0 : 72, opacity: index === 0 ? 1 : 0.35 },
            {
              y: 0,
              opacity: 1,
              ease: "none",
              scrollTrigger: {
                trigger: ".process-stage",
                start: `top+=${index * 170} center`,
                end: `top+=${(index + 1) * 210} center`,
                scrub: 0.6,
              },
            },
          );
        });
    },
    { scope: root },
  );
}
