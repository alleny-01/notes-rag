import { ArrowUpRight, FileText, Search, ShieldCheck } from "lucide-react";
import { featurePanels } from "../ui/content";

const icons = [FileText, Search, ShieldCheck];

export function FeatureSection() {
  return <section className="intro-section reveal" id="how-it-works"><p className="eyebrow">A quieter kind of intelligence</p><div className="intro-heading"><h2>The answer is only useful when you can <em>find it again.</em></h2><p>NotesRAG treats retrieval as the source of truth. The model’s job is to help you understand the material, not fill gaps with confident guesswork.</p></div><div className="feature-grid">{featurePanels.map((panel, index) => { const Icon = icons[index]; return <article className={`feature-panel ${panel.tone}`} key={panel.number}><div className="panel-top"><Icon size={22} strokeWidth={1} /><span>{panel.number}</span></div><div><h3>{panel.title}</h3><p>{panel.text}</p></div><span className="panel-arrow"><ArrowUpRight size={20} strokeWidth={1} /></span></article>; })}</div></section>;
}
