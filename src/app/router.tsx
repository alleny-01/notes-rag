import { lazy, Suspense, useState } from "react";
import { useSession } from "../features/auth/hooks/useSession";
import { CollectionShell } from "../features/collections/components/CollectionShell";
import { CreateCollectionModal } from "../features/collections/components/CreateCollectionModal";
import { useCollections } from "../features/collections/hooks/useCollections";
import { LibraryPage } from "../features/collections/pages/LibraryPage";
import { useUploadDocument } from "../features/documents/hooks/useUploadDocument";
import { useDocumentStatus } from "../features/documents/hooks/useDocumentStatus";
import { Skeleton } from "../components/ui/skeleton";
import { Spinner } from "../components/ui/spinner";
import { navigate, useAppRoute } from "./navigation";
import { OnboardingPage } from "../features/onboarding/pages/OnboardingPage";
import { AppErrorBoundary } from "../components/ui/AppErrorBoundary";

const UploadPage = lazy(() => import("../features/collections/pages/UploadPage").then((module) => ({ default: module.UploadPage })));
const WorkspacePage = lazy(() => import("../features/collections/pages/WorkspacePage").then((module) => ({ default: module.WorkspacePage })));
const CollectionSettingsPage = lazy(() => import("../features/collections/pages/CollectionSettingsPage").then((module) => ({ default: module.CollectionSettingsPage })));

function SessionBootScreen() {
  return <main className="min-h-screen bg-[var(--canvas)]" aria-busy="true" />;
}

function ProductLoading() {
  return <div className="min-h-screen bg-[var(--canvas)] font-[var(--sans)] text-[var(--ink)]"><header className="sticky top-0 z-30 bg-[color:color-mix(in_srgb,var(--canvas)_90%,transparent)] backdrop-blur-xl"><div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between px-4 sm:px-6 lg:px-9"><div className="flex items-center gap-3"><Skeleton className="h-6 w-6 rounded-md" /><Skeleton className="h-4 w-24" /></div><div className="flex items-center gap-2"><Skeleton className="h-9 w-9" /><Skeleton className="h-9 w-28" /></div></div></header><main className="mx-auto w-full max-w-[1400px] px-4 py-9 sm:px-6 sm:py-12 lg:px-9"><Skeleton className="h-3 w-24" /><Skeleton className="mt-3 h-6 w-64" /><div className="mt-8 bg-[var(--paper)] p-3 shadow-[0_10px_22px_rgba(66,47,39,0.04)]"><Skeleton className="h-10 w-full bg-white" /></div><div className="mt-9 space-y-2">{["one", "two", "three"].map((item) => <div key={item} className="flex items-center gap-4 bg-[var(--cream)] px-4 py-5 shadow-[0_1px_0_rgba(66,47,39,0.03)]"><Skeleton className="h-9 w-9" /><div className="flex-1"><Skeleton className="h-5 w-40" /><Skeleton className="mt-2 h-3 w-52" /></div><Skeleton className="h-8 w-16" /></div>)}</div></main></div>;
}

function PageNavigationLoader() {
  return <div className="fixed inset-0 z-[70] grid place-items-center bg-[var(--canvas)]" role="status" aria-label="Loading page"><Spinner className="size-8 animate-[spin_1.35s_linear_infinite] text-[var(--purple)] drop-shadow-[0_4px_12px_rgba(95,61,130,0.24)] motion-reduce:animate-none" /></div>;
}

function ProductApp() {
  const { route: routeFromLocation } = useAppRoute();
  const [isCreateCollectionOpen, setIsCreateCollectionOpen] = useState(false);
  const route = routeFromLocation ?? { name: "library" as const };
  const collectionState = useCollections();
  const documentUpload = useUploadDocument();
  useDocumentStatus();
  const collections = collectionState.collections;
  const activeCollection = "collectionId" in route ? collections.find((collection) => collection.id === route.collectionId) : undefined;

  if (collectionState.isLoading) return <ProductLoading />;
  if (collectionState.error) return <div className="grid min-h-screen place-items-center bg-[var(--canvas)] p-6 text-center"><div><p className="text-[13px] text-[#8f3d42]">We couldn’t load your library.</p><button type="button" onClick={() => collectionState.refetch()} className="mt-3 inline-flex items-center gap-2 text-[12px] text-[var(--purple)]"><Spinner className={collectionState.isFetching ? "size-3 animate-spin" : "hidden"} />Try again</button></div></div>;

  const create = async (name: string) => {
    const collection = await collectionState.create.mutateAsync(name);
    navigate({ name: "upload", collectionId: collection.id });
  };
  const addDocument = async (collectionId: string, file: File) => { await documentUpload.mutateAsync({ collectionId, file }); };
  const recordOpen = (collectionId: string) => { void collectionState.recordOpen.mutateAsync(collectionId); };
  const rename = async (collectionId: string, name: string) => { await collectionState.rename.mutateAsync({ collectionId, name }); };
  const removeDocument = async (collectionId: string, documentId: string) => {
    const document = collections.find((collection) => collection.id === collectionId)?.documents.find((item) => item.id === documentId);
    if (document) await collectionState.removeDocument.mutateAsync(document);
  };
  const deleteCollection = async (collectionId: string) => {
    const collection = collections.find((item) => item.id === collectionId);
    if (collection) await collectionState.delete.mutateAsync(collection);
    navigate({ name: "library" });
  };
  const deleteCollections = async (collectionIds: string[]) => {
    const targetIds = new Set(collectionIds);
    const targets = collections.filter((collection) => targetIds.has(collection.id));
    for (const collection of targets) {
      await collectionState.delete.mutateAsync(collection);
    }
  };

  const library = <LibraryPage collections={collections} onDeleteCollections={deleteCollections} onOpenCollection={recordOpen} onOpenCreateCollection={() => setIsCreateCollectionOpen(true)} />;
  const body = (() => {
    if (route.name === "library" || !activeCollection) return library;
    if (route.name === "upload") return <UploadPage collection={activeCollection} onAddDocument={addDocument} onRemoveDocument={(documentId) => removeDocument(activeCollection.id, documentId)} />;
    if (route.name === "settings") return <CollectionSettingsPage collection={activeCollection} onRename={rename} onRemoveDocument={removeDocument} onDelete={deleteCollection} />;
    return <WorkspacePage collection={activeCollection} />;
  })();

  return <>
    <CollectionShell collection={activeCollection} isRefreshing={collectionState.isFetching} onOpenCreateCollection={() => setIsCreateCollectionOpen(true)}><Suspense fallback={<PageNavigationLoader />}>{body}</Suspense></CollectionShell>
    <CreateCollectionModal isOpen={isCreateCollectionOpen} onClose={() => setIsCreateCollectionOpen(false)} onCreate={create} />
  </>;
}

export function AppRouter() {
  const { session, isLoading } = useSession();
  if (isLoading) return <SessionBootScreen />;
  return session ? <AppErrorBoundary resetKey={window.location.hash}><ProductApp /></AppErrorBoundary> : <OnboardingPage />;
}
