import { useEffect, useId, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowUpRight, Check, Mail, X } from "lucide-react";
import { sendMagicLink, signInWithGoogle } from "../api";
import { Spinner } from "../../../components/ui/spinner";

type AuthModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

type ModalView = "options" | "magic-link" | "sent";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.03H12v3.84h5.38a4.59 4.59 0 0 1-1.99 3.01v2.49h3.21c1.88-1.73 3-4.28 3-7.31Z" />
      <path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.63-2.46l-3.21-2.49c-.89.6-2.03.96-3.42.96-2.62 0-4.84-1.77-5.63-4.15H3.05v2.57A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.37 13.86a6 6 0 0 1 0-3.72V7.57H3.05a10 10 0 0 0 0 8.86l3.32-2.57Z" />
      <path fill="#EA4335" d="M12 5.99c1.51 0 2.87.52 3.94 1.54l2.95-2.95C16.96 2.78 14.7 2 12 2a10 10 0 0 0-8.95 5.57l3.32 2.57C7.16 7.76 9.38 5.99 12 5.99Z" />
    </svg>
  );
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const titleId = useId();
  const [view, setView] = useState<ModalView>("options");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) return;
    setView("options");
    setEmail("");
    setError("");
    setIsSubmitting(false);
  }, [isOpen]);

  if (!isOpen) return null;

  const beginGoogleSignIn = async () => {
    setError("");
    setIsSubmitting(true);
    const { error: authError } = await signInWithGoogle();
    if (authError) {
      setError(authError.message);
      setIsSubmitting(false);
    }
  };

  const submitMagicLink = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedEmail = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setError("Enter a valid email address.");
      return;
    }

    setError("");
    setIsSubmitting(true);
    const { error: authError } = await sendMagicLink(normalizedEmail);
    setIsSubmitting(false);
    if (authError) {
      setError(authError.message);
      return;
    }
    setView("sent");
  };

  return (
    <div className="auth-layer" role="presentation">
      <button className="auth-backdrop" type="button" aria-label="Close sign in dialog" onClick={onClose} />
      <section className="auth-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <button className="auth-close" type="button" aria-label="Close sign in dialog" onClick={onClose}><X size={18} strokeWidth={1} /></button>

        {view === "options" && (
          <div className="auth-content">
            <p className="auth-kicker">Welcome to NotesRAG</p>
            <h2 id={titleId}>Start with the notes you already have.</h2>
            <p className="auth-description">Sign in to create a private study space for your documents, questions, and source trails.</p>
            <div className="auth-actions">
              <button className="auth-provider-button" type="button" onClick={beginGoogleSignIn} disabled={isSubmitting}>
                <GoogleIcon />
                <span>{isSubmitting ? "Redirecting…" : "Continue with Google"}</span>{isSubmitting ? <Spinner className="size-4 animate-spin" /> : <ArrowUpRight size={16} strokeWidth={1} />}
                <ArrowUpRight size={16} strokeWidth={1} />
              </button>
              <div className="auth-divider"><span>or</span></div>
              <button className="auth-email-button" type="button" onClick={() => setView("magic-link")} disabled={isSubmitting}>
                <Mail size={17} strokeWidth={1} /> Continue with email
              </button>
            </div>
            {error && <p className="auth-error" role="alert">{error}</p>}
            <p className="auth-terms">By continuing, you agree to use NotesRAG responsibly with material you have permission to upload.</p>
          </div>
        )}

        {view === "magic-link" && (
          <div className="auth-content">
            <button className="auth-back" type="button" onClick={() => { setError(""); setView("options"); }}><ArrowLeft size={16} /> All sign-in options</button>
            <p className="auth-kicker">Magic link</p>
            <h2 id={titleId}>Your inbox is the key.</h2>
            <p className="auth-description">We’ll send a secure sign-in link. No password to create or remember.</p>
            <form className="auth-form" onSubmit={submitMagicLink}>
              <label htmlFor="auth-email">Email address</label>
              <input id="auth-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" autoFocus />
              {error && <p className="auth-error" role="alert">{error}</p>}
              <button className="auth-submit" type="submit" disabled={isSubmitting}>{isSubmitting ? "Sending link…" : "Send magic link"}{isSubmitting ? <Spinner className="size-4 animate-spin" /> : <ArrowUpRight size={16} strokeWidth={1} />}</button>
            </form>
          </div>
        )}

        {view === "sent" && (
          <div className="auth-content auth-sent">
            <div className="auth-success-icon"><Check size={24} strokeWidth={1} /></div>
            <p className="auth-kicker">Check your inbox</p>
            <h2 id={titleId}>Your link is on its way.</h2>
            <p className="auth-description">We sent a secure sign-in link to <strong>{email}</strong>. Open it in this browser to continue.</p>
            <button className="auth-submit" type="button" onClick={onClose}>Done<Check size={16} strokeWidth={1} /></button>
          </div>
        )}
      </section>
    </div>
  );
}