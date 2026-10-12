import { useEffect, useState } from "react";
import { Download, LogOut, RotateCcw, Trash2 } from "lucide-react";
import { navigate } from "../../../app/navigation";
import { supabase } from "../../../lib/supabaseClient";
import { signOut } from "../../auth/api";
import { useToast } from "../../../components/ui/ToastProvider";
import { getUsage } from "../api";
import {
  localResetTime,
  nextUtcMidnight,
  type AnswerStyle,
  type MotionPreference,
  type TextSize,
  type ThemePreference,
} from "../settings";
import { useSettings } from "../hooks/useSettings";

function Choice<T extends string>({
  label,
  value,
  selected,
  onChange,
}: {
  label: string;
  value: T;
  selected: T;
  onChange: (value: T) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(value)}
      aria-pressed={selected === value}
      className={`h-8 rounded-md px-3 text-[11px] transition focus:outline-none focus:ring-2 focus:ring-[var(--purple)] focus:ring-offset-2 ${selected === value ? "bg-[var(--purple)] text-white" : "bg-white text-[var(--body)] shadow-[inset_0_0_0_1px_var(--line)] hover:text-[var(--purple)]"}`}
    >
      {label}
    </button>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-[var(--cream)] p-5 shadow-[0_10px_26px_rgba(66,47,39,0.05)] sm:p-6">
      <h2 className="text-[12px] font-medium text-[var(--ink)]">{title}</h2>
      <div className="mt-5 space-y-5">{children}</div>
    </section>
  );
}

function Row({
  label,
  help,
  children,
}: {
  label: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-[12px] text-[var(--ink)]">{label}</p>
        {help && (
          <p className="mt-1 text-[11px] leading-5 text-[var(--muted)]">
            {help}
          </p>
        )}
      </div>
      <div className="flex shrink-0 flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

export function AppSettingsPage() {
  const { settings, update, isSaving } = useSettings();
  const { showToast } = useToast();
  const [email, setEmail] = useState("");
  const [usage, setUsage] = useState<{
    used: number;
    limit: number;
    resetAt: string;
  } | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  useEffect(() => {
    void supabase.auth
      .getUser()
      .then(({ data }) => setEmail(data.user?.email ?? ""));
    void getUsage()
      .then(setUsage)
      .catch(() => undefined);
  }, []);
  const updateSetting = <K extends keyof typeof settings>(
    key: K,
    value: (typeof settings)[K],
  ) => {
    update({ [key]: value });
    showToast("Settings saved");
  };
  const exportChats = async () => {
    const { data, error } = await supabase
      .from("collections")
      .select(
        "name, documents(filename), chat_sessions(title, messages(role, content, created_at, citations(order_index, chunks(content, page_number, documents(filename)))) )",
      );
    if (error) {
      showToast("We could not export your chats.", "error");
      return;
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "notesrag-chats.json";
    link.click();
    URL.revokeObjectURL(link.href);
    showToast("Chat export downloaded");
  };
  const deleteAccount = async () => {
    if (deleteText !== "DELETE") return;
    setIsDeleting(true);
    try {
      const { error } = await supabase.functions.invoke("delete-account");
      if (error) throw error;
      await signOut();
    } catch {
      showToast("We could not delete your account.", "error");
      setIsDeleting(false);
    }
  };
  const usedPercent = usage
    ? Math.min(100, Math.round((usage.used / Math.max(usage.limit, 1)) * 100))
    : 0;
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-9">
      <div className="mb-7 flex items-end justify-between">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.14em] text-[var(--purple)]">
            Account
          </p>
          <h1 className="mt-2 font-[var(--serif)] text-[20px] font-light tracking-[-0.035em]">
            App settings
          </h1>
        </div>
        <button
          type="button"
          onClick={() => navigate({ name: "library" })}
          className="text-[11px] text-[var(--purple)] hover:text-[var(--purple-dark)]"
        >
          Back to library
        </button>
      </div>
      <div className="space-y-4">
        <Section title="Appearance">
          <Row label="Theme">
            <Choice<ThemePreference>
              label="System"
              value="system"
              selected={settings.theme}
              onChange={(value) => updateSetting("theme", value)}
            />
            <Choice<ThemePreference>
              label="Light"
              value="light"
              selected={settings.theme}
              onChange={(value) => updateSetting("theme", value)}
            />
            <Choice<ThemePreference>
              label="Dark"
              value="dark"
              selected={settings.theme}
              onChange={(value) => updateSetting("theme", value)}
            />
          </Row>
          <Row
            label="Reduce motion"
            help="Stops non-essential movement across the app."
          >
            <Choice<MotionPreference>
              label="System"
              value="system"
              selected={settings.reduceMotion}
              onChange={(value) => updateSetting("reduceMotion", value)}
            />
            <Choice<MotionPreference>
              label="On"
              value="on"
              selected={settings.reduceMotion}
              onChange={(value) => updateSetting("reduceMotion", value)}
            />
            <Choice<MotionPreference>
              label="Off"
              value="off"
              selected={settings.reduceMotion}
              onChange={(value) => updateSetting("reduceMotion", value)}
            />
          </Row>
          <Row label="Notes text size">
            <Choice<TextSize>
              label="S"
              value="s"
              selected={settings.textSize}
              onChange={(value) => updateSetting("textSize", value)}
            />
            <Choice<TextSize>
              label="M"
              value="m"
              selected={settings.textSize}
              onChange={(value) => updateSetting("textSize", value)}
            />
            <Choice<TextSize>
              label="L"
              value="l"
              selected={settings.textSize}
              onChange={(value) => updateSetting("textSize", value)}
            />
          </Row>
        </Section>
        <Section title="Usage">
          <div>
            <div className="flex justify-between text-[12px] text-[var(--body)]">
              <span>
                {usage
                  ? `${usage.used} of ${usage.limit} messages used today`
                  : "Loading today’s usage…"}
              </span>
              <span>{usedPercent}%</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--paper)]">
              <div
                className="h-full bg-[var(--purple)] transition-[transform] duration-200"
                style={{
                  transform: `scaleX(${usedPercent / 100})`,
                  transformOrigin: "left",
                }}
              />
            </div>
            <p className="mt-2 text-[11px] text-[var(--muted)]">
              Resets at {localResetTime(usage?.resetAt ?? nextUtcMidnight())}
            </p>
          </div>
        </Section>
        <Section title="Chat">
          <Row
            label="Answer style"
            help="Balanced keeps the current answer style."
          >
            <Choice<AnswerStyle>
              label="Concise"
              value="concise"
              selected={settings.answerStyle}
              onChange={(value) => updateSetting("answerStyle", value)}
            />
            <Choice<AnswerStyle>
              label="Balanced"
              value="balanced"
              selected={settings.answerStyle}
              onChange={(value) => updateSetting("answerStyle", value)}
            />
            <Choice<AnswerStyle>
              label="Detailed"
              value="detailed"
              selected={settings.answerStyle}
              onChange={(value) => updateSetting("answerStyle", value)}
            />
          </Row>
        </Section>
        <Section title="Data">
          <Row
            label="Export chats"
            help="Downloads collections, document names, messages, and citations. Raw files are not included."
          >
            <button
              type="button"
              onClick={() => void exportChats()}
              className="inline-flex h-8 items-center gap-2 rounded-md bg-[var(--paper)] px-3 text-[11px] text-[var(--purple)] hover:bg-[var(--lilac)]"
            >
              <Download size={14} strokeWidth={1} /> Export
            </button>
          </Row>
        </Section>
        <Section title="Help">
          <Row
            label="Replay tour"
            help="Shows the workspace guide the next time you open a collection."
          >
            <button
              type="button"
              onClick={() => {
                update({ tour: {} });
                showToast("The tour will replay in your next workspace.");
              }}
              className="inline-flex h-8 items-center gap-2 rounded-md bg-[var(--paper)] px-3 text-[11px] text-[var(--purple)] hover:bg-[var(--lilac)]"
            >
              <RotateCcw size={14} strokeWidth={1} /> Replay tour
            </button>
          </Row>
        </Section>
        <Section title="Account">
          <Row label="Signed in as">
            <span className="text-[12px] text-[var(--body)]">
              {email || "—"}
            </span>
          </Row>
          <Row label="Sign out">
            <button
              type="button"
              onClick={() => void signOut()}
              className="inline-flex h-8 items-center gap-2 rounded-md bg-[var(--paper)] px-3 text-[11px] text-[var(--body)] hover:text-[var(--purple)]"
            >
              <LogOut size={14} strokeWidth={1} /> Sign out
            </button>
          </Row>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              className="inline-flex h-8 items-center gap-2 text-[11px] text-[var(--signal)] hover:underline"
            >
              <Trash2 size={14} strokeWidth={1} /> Delete account and all data
            </button>
          </div>
        </Section>
      </div>
      {isSaving && (
        <p className="mt-4 text-[11px] text-[var(--muted)]">Saving…</p>
      )}
      {deleteOpen && (
        <div className="fixed inset-0 z-[100] grid place-items-center p-4">
          <button
            aria-label="Close delete account confirmation"
            className="absolute inset-0 bg-black/40"
            onClick={() => setDeleteOpen(false)}
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-account-title"
            className="relative w-full max-w-sm bg-[var(--cream)] p-6 shadow-[0_28px_90px_rgba(38,26,42,0.26)]"
          >
            <p className="text-[10px] font-semibold tracking-[0.14em] text-[var(--signal)]">
              Permanent action
            </p>
            <h2
              id="delete-account-title"
              className="mt-3 font-[var(--serif)] text-[19px] font-light"
            >
              Delete your account?
            </h2>
            <p className="mt-3 text-[12px] leading-5 text-[var(--body)]">
              This removes your collections, messages and stored documents. Type
              DELETE to confirm.
            </p>
            <input
              value={deleteText}
              onChange={(event) => setDeleteText(event.target.value)}
              className="mt-4 h-10 w-full rounded-md bg-white px-3 text-[12px] outline-none ring-1 ring-[var(--line)] focus:ring-2 focus:ring-[var(--purple)]"
              placeholder="DELETE"
            />
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteOpen(false)}
                className="h-8 px-3 text-[11px] text-[var(--body)]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteText !== "DELETE" || isDeleting}
                onClick={() => void deleteAccount()}
                className="h-8 rounded-md bg-[var(--signal)] px-3 text-[11px] text-white disabled:opacity-50"
              >
                {isDeleting ? "Deleting…" : "Delete account"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
