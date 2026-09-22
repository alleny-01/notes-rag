import { useEffect, useRef, useState } from "react";

export type AppRoute =
  | { name: "library" }
  | { name: "upload"; collectionId: string }
  | { name: "workspace"; collectionId: string }
  | { name: "settings"; collectionId: string };

const navigationStartEvent = "notesrag:navigation-start";

function readRoute(): AppRoute | null {
  const match = window.location.hash.match(/^#app(?:\/(.*))?$/);
  if (!match) return null;
  const segments = (match[1] ?? "library").split("/").filter(Boolean);
  if (segments[0] === "collections" && segments[1]) {
    if (segments[2] === "upload") return { name: "upload", collectionId: segments[1] };
    if (segments[2] === "settings") return { name: "settings", collectionId: segments[1] };
    return { name: "workspace", collectionId: segments[1] };
  }
  return { name: "library" };
}

export function routeHref(route: AppRoute) {
  if (route.name === "library") return "#app";
  if (route.name === "upload") return `#app/collections/${route.collectionId}/upload`;
  if (route.name === "settings") return `#app/collections/${route.collectionId}/settings`;
  return `#app/collections/${route.collectionId}`;
}

export function navigate(route: AppRoute) {
  const nextHash = routeHref(route);
  if (window.location.hash === nextHash) return;
  window.dispatchEvent(new Event(navigationStartEvent));
  window.location.hash = nextHash.slice(1);
}

export function useAppRoute() {
  const [route, setRoute] = useState<AppRoute | null>(readRoute);
  const [isNavigating, setIsNavigating] = useState(false);
  const completeTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const update = () => {
      setRoute(readRoute());
      window.clearTimeout(completeTimer.current);
      completeTimer.current = window.setTimeout(() => setIsNavigating(false), 280);
    };
    const start = () => {
      window.clearTimeout(completeTimer.current);
      setIsNavigating(true);
    };
    window.addEventListener("hashchange", update);
    window.addEventListener(navigationStartEvent, start);
    return () => {
      window.removeEventListener("hashchange", update);
      window.removeEventListener(navigationStartEvent, start);
      window.clearTimeout(completeTimer.current);
    };
  }, []);

  return { route, isNavigating };
}