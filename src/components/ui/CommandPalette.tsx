import { useEffect, useMemo, useRef, useState } from "react";
import {
  Command,
  FolderOpen,
  LogOut,
  Moon,
  Plus,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { navigate } from "../../app/navigation";
import type { Collection } from "../../features/collections/types/domain";
import { useSettings } from "../../features/settings/hooks/useSettings";

type Props = {
  collections: Collection[];
  onNewCollection: () => void;
  onSignOut: () => void;
};

export function CommandPalette({
  collections,
  onNewCollection,
  onSignOut,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { settings, update } = useSettings();
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);
  useEffect(() => {
    if (open) window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);
  const matches = useMemo(
    () =>
      collections
        .filter((collection) =>
          collection.name.toLowerCase().includes(query.toLowerCase()),
        )
        .slice(0, 7),
    [collections, query],
  );
  const close = () => {
    setOpen(false);
    setQuery("");
  };
  if (!open) return null;
  const action = (callback: () => void) => {
    callback();
    close();
  };
  const actions: Array<{
    Icon: LucideIcon;
    label: string;
    callback: () => void;
  }> = [
    { Icon: Plus, label: "New collection", callback: onNewCollection },
    {
      Icon: Settings,
      label: "Open App settings",
      callback: () => navigate({ name: "app-settings" }),
    },
    {
      Icon: Moon,
      label: "Toggle theme",
      callback: () =>
        update({ theme: settings.theme === "dark" ? "light" : "dark" }),
    },
    { Icon: LogOut, label: "Sign out", callback: onSignOut },
  ];
  return (
    <div
      className="fixed inset-0 z-[110] grid place-items-start bg-[rgba(27,25,26,0.32)] p-4 pt-[13vh] backdrop-blur-[2px]"
      role="presentation"
    >
      <button
        className="absolute inset-0"
        aria-label="Close command palette"
        onClick={close}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="relative w-full max-w-xl overflow-hidden bg-[var(--cream)] shadow-[0_28px_90px_rgba(38,26,42,0.26)]"
      >
        <div className="flex items-center gap-3 bg-white px-4 shadow-[inset_0_-1px_0_var(--line)]">
          <Command size={16} className="text-[var(--purple)]" strokeWidth={1} />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") close();
            }}
            placeholder="Search collections or actions…"
            className="h-12 min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-[var(--muted)]"
          />
          <kbd className="hidden rounded bg-[var(--paper)] px-1.5 py-0.5 text-[10px] text-[var(--muted)] sm:block">
            Esc
          </kbd>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2">
          <p className="px-2 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
            Actions
          </p>
          {actions.map(({ Icon, label, callback }) => (
            <button
              key={label}
              type="button"
              onClick={() => action(callback)}
              className="flex h-10 w-full items-center gap-3 rounded-md px-3 text-left text-[12px] text-[var(--body)] transition hover:bg-[var(--paper)] hover:text-[var(--purple)]"
            >
              <Icon size={15} strokeWidth={1} />
              {label}
            </button>
          ))}
          <p className="mt-2 px-2 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
            Collections
          </p>
          {matches.length ? (
            matches.map((collection) => (
              <button
                key={collection.id}
                type="button"
                onClick={() =>
                  action(() =>
                    navigate({
                      name: "workspace",
                      collectionId: collection.id,
                    }),
                  )
                }
                className="flex h-10 w-full items-center gap-3 rounded-md px-3 text-left text-[12px] text-[var(--body)] transition hover:bg-[var(--paper)] hover:text-[var(--purple)]"
              >
                <FolderOpen size={15} strokeWidth={1} />
                {collection.name}
              </button>
            ))
          ) : (
            <p className="px-3 py-3 text-[11px] text-[var(--muted)]">
              No matching collection.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
