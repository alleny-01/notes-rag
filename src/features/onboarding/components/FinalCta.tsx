import { ArrowUpRight } from "lucide-react";

type FinalCtaProps = { onOpenAuth: () => void };

export function FinalCta({ onOpenAuth }: FinalCtaProps) {
  return <section className="cta-section" id="start"><div className="cta-content reveal"><p className="eyebrow eyebrow-light">Make the most of what you already have</p><h2>Your notes are waiting to become a conversation.</h2><button className="button button-light button-large" type="button" onClick={onOpenAuth}>Get started <ArrowUpRight size={17} strokeWidth={1} /></button></div><div className="cta-orb" aria-hidden="true"><span /><span /><span /></div></section>;
}