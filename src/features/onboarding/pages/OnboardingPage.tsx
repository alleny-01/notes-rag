import { useRef, useState } from "react";
import { AuthModal } from "../../auth/components/AuthModal";
import { OnboardingNav } from "../components/OnboardingNav";
import { HeroSection } from "../components/HeroSection";
import { ValuesMarquee } from "../components/ValuesMarquee";
import { FeatureSection } from "../components/FeatureSection";
import { CitationProof } from "../components/CitationProof";
import { ProcessSection } from "../components/ProcessSection";
import { FinalCta } from "../components/FinalCta";
import { OnboardingFooter } from "../components/OnboardingFooter";
import { useOnboardingMotion } from "../hooks/useOnboardingMotion";
import { citations } from "../ui/content";

export function OnboardingPage() {
  const root = useRef<HTMLElement>(null);
  const [activeCitationId, setActiveCitationId] = useState(1);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const activeSource =
    citations.find((citation) => citation.id === activeCitationId) ??
    citations[0];
  const openAuth = () => setIsAuthOpen(true);

  useOnboardingMotion(root);

  return (
    <main className="site-shell" ref={root}>
      <OnboardingNav onOpenAuth={openAuth} />
      <HeroSection onOpenCitation={setActiveCitationId} onOpenAuth={openAuth} />
      <ValuesMarquee />
      <FeatureSection />
      <CitationProof
        activeCitationId={activeCitationId}
        activeSource={activeSource}
        onSelectCitation={setActiveCitationId}
      />
      <ProcessSection />
      <FinalCta onOpenAuth={openAuth} />
      <OnboardingFooter onOpenAuth={openAuth} />
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
    </main>
  );
}
