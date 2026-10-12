const footerGroups = [
  {
    title: "Product",
    links: [
      ["How it works", "#how-it-works"],
      ["Why it’s grounded", "#trust"],
      ["For students", "#start"],
      ["Get started", "auth"],
    ],
  },
  {
    title: "Study guide",
    links: [
      ["Source citations", "#trust"],
      ["Text-based PDFs", "#start"],
      ["Plain-text notes", "#start"],
      ["When notes are silent", "#trust"],
    ],
  },
  {
    title: "Company",
    links: [
      ["About NotesRAG", "#top"],
      ["Contact", "mailto:hello@notesrag.app"],
      ["Changelog", "#process"],
      ["Study principles", "#how-it-works"],
    ],
  },
] as const;

type OnboardingFooterProps = { onOpenAuth: () => void };

export function OnboardingFooter({ onOpenAuth }: OnboardingFooterProps) {
  return (
    <footer className="site-footer">
      <div className="footer-main">
        <div className="footer-brand-block">
          <a className="brand brand-footer" href="#top">
            <img src="favicon.png" alt="NotesRAG" className="favicon" />
            <span>NotesRAG</span>
          </a>
          <p>
            A citation-first study space for the material that matters. Ask a
            question, then follow the answer back to the page.
          </p>
          <a className="footer-contact" href="mailto:hello@notesrag.app">
            hello@notesrag.app
          </a>
        </div>
        <div className="footer-link-groups">
          {footerGroups.map((group) => (
            <div className="footer-link-group" key={group.title}>
              <h2>{group.title}</h2>
              <ul>
                {group.links.map(([label, href]) => (
                  <li key={label}>
                    {href === "auth" ? (
                      <button
                        className="footer-auth-button"
                        type="button"
                        onClick={onOpenAuth}
                      >
                        {label}
                      </button>
                    ) : (
                      <a href={href}>{label}</a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div className="footer-link-group footer-legal">
            <h2>Legal</h2>
            <ul>
              <li>
                <span>Privacy policy — coming soon</span>
              </li>
              <li>
                <span>Terms of use — coming soon</span>
              </li>
              <li>
                <span>Accessibility — coming soon</span>
              </li>
              <li>
                <a href="#trust">Trust &amp; safeguards</a>
              </li>
            </ul>
          </div>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} NotesRAG</span>
        <span>Designed for focused, source-aware study.</span>
        <a href="#top">Back to top ↑</a>
      </div>
    </footer>
  );
}
