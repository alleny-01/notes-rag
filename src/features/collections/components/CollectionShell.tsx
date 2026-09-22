import { useState, type PropsWithChildren } from "react";
import {
  ArrowLeft,
  ChevronDown,
  FolderOpen,
  LogOut,
  Plus,
  Settings,
} from "lucide-react";
import type { Collection } from "../types/domain";
import { navigate } from "../../../app/navigation";
import { signOut } from "../../auth/api";
import { Spinner } from "../../../components/ui/spinner";

type CollectionShellProps = PropsWithChildren<{ collection?: Collection; isRefreshing?: boolean; onOpenCreateCollection: () => void }>;

export function CollectionShell({
  collection,
  children,
  isRefreshing = false,
  onOpenCreateCollection,
}: CollectionShellProps) {
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");

  const handleSignOut = async () => {
    setSignOutError("");
    setIsSigningOut(true);
    try {
      await signOut();
    } catch (error) {
      setSignOutError(error instanceof Error ? error.message : "We could not sign you out. Try again.");
      setIsSigningOut(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--canvas)] font-[var(--sans)] text-[var(--ink)]">
      <header className="sticky top-0 z-30 bg-[color:color-mix(in_srgb,var(--canvas)_90%,transparent)] backdrop-blur-xl">
        {isRefreshing && (
          <div className="absolute inset-x-0 top-full h-px overflow-hidden bg-[rgba(95,61,130,0.12)]" aria-live="polite">
            <div className="h-full w-1/3 animate-[loading-bar_0.9s_ease-in-out_infinite] motion-reduce:animate-none bg-[var(--purple)]" />
          </div>
        )}
        <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between px-4 sm:px-6 lg:px-9">
          <div className="flex min-w-0 items-center gap-4 sm:gap-7">
            <button
              type="button"
              onClick={() => navigate({ name: "library" })}
              className="flex shrink-0 items-center gap-2 text-[17px] font-semibold tracking-[-0.055em] text-[var(--ink)]"
            >
              <img src="favicon.png" alt="" className="h-6 w-6" />
              <span>NotesRAG</span>
            </button>
            {collection && (
              <>
                <span className="hidden h-5 w-px bg-[var(--line)] sm:block" />
                <div className="hidden min-w-0 items-center gap-2 text-[12px] text-[var(--body)] sm:flex">
                  <FolderOpen size={14} className="text-[var(--purple)]" strokeWidth={1} />
                  <span className="truncate">{collection.name}</span>
                  <ChevronDown size={13} strokeWidth={1} />
                </div>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {collection && (
              <button
                type="button"
                onClick={() => navigate({ name: "settings", collectionId: collection.id })}
                className="inline-flex h-9 items-center gap-2 rounded-md px-2.5 text-[12px] text-[var(--body)] transition duration-200 ease-out hover:-translate-y-px hover:bg-[var(--paper)] hover:text-[var(--ink)] active:translate-y-0"
              >
                <Settings size={15} strokeWidth={1}/>
                <span className="hidden sm:inline text-sm">Settings</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="inline-flex h-9 items-center gap-2 rounded-md px-2.5 text-[12px] text-[var(--body)] transition duration-200 ease-out hover:-translate-y-px hover:bg-[var(--paper)] hover:text-[var(--ink)] active:translate-y-0 disabled:cursor-wait disabled:opacity-60"
              aria-label="Log out"
            >
              {isSigningOut ? <Spinner className="size-[15px] animate-spin" /> : <LogOut size={15} strokeWidth={1}/>}
              <span className="hidden md:inline text-sm">{isSigningOut ? "Logging out…" : "Log out"}</span>
            </button>
            <button
              type="button"
              onClick={onOpenCreateCollection}
              className="inline-flex h-9 items-center gap-2 rounded-md bg-[var(--purple)] px-3 text-[12px] font-medium text-white transition duration-200 ease-out hover:-translate-y-px hover:bg-[var(--purple-dark)] active:translate-y-0"
            >
              <Plus size={15} strokeWidth={1}/>
              <span className="hidden sm:inline text-sm">New collection</span>
              <span className="sm:hidden">New</span>
            </button>
          </div>
        </div>
      </header>
      {collection && (
        <div className="bg-[var(--cream)]">
          <div className="mx-auto flex h-11 max-w-[1600px] items-center gap-2 px-4 text-[11px] text-[var(--muted)] sm:px-6 lg:px-9">
            <button
              type="button"
              onClick={() => navigate({ name: "library" })}
              className="inline-flex items-center gap-1 transition duration-200 ease-out hover:translate-x-0.5 hover:text-[var(--purple)]"
            >
              <ArrowLeft size={12} /> Library
            </button>
            <span>/</span>
            <button
              type="button"
              onClick={() => navigate({ name: "workspace", collectionId: collection.id })}
              className="inline-flex items-center gap-1 text-[var(--body)] transition duration-200 ease-out hover:translate-x-0.5 hover:text-[var(--purple)]"
            >
              {collection.name}
            </button>
          </div>
        </div>
      )}
      {signOutError && (
        <p className="fixed bottom-4 right-4 z-50 max-w-sm bg-[#fff7f7] px-4 py-3 text-[12px] text-[#8f3d42] shadow-[0_12px_26px_rgba(66,47,39,0.12)]" role="alert">
          {signOutError}
        </p>
      )}
      {children}
    </div>
  );
}