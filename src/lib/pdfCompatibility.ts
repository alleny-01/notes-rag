/**
 * Small, dependency-free fallbacks needed before PDF.js's legacy bundle loads.
 * They intentionally cover only stable web-platform APIs PDF.js uses at startup.
 */
type PromiseWithResolvers = <T>() => {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
};

type IteratorConstructor = (() => unknown) & {
  prototype?: {
    map?: unknown;
    filter?: unknown;
    take?: unknown;
    toArray?: unknown;
  };
};

declare global {
  interface PromiseConstructor {
    withResolvers?: PromiseWithResolvers;
  }

  interface URLConstructor {
    parse?: (url: string, base?: string | URL) => URL | null;
  }
}

if (typeof Promise.withResolvers !== "function") {
  Promise.withResolvers = <T>() => {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((resolvePromise, rejectPromise) => {
      resolve = resolvePromise;
      reject = rejectPromise;
    });
    return { promise, resolve, reject };
  };
}

if (typeof URL !== "undefined" && typeof URL.parse !== "function") {
  URL.parse = (url, base) => {
    try {
      return new URL(url, base);
    } catch {
      return null;
    }
  };
}

export function pdfRuntimeIsSupported() {
  const iterator = (globalThis as unknown as { Iterator?: IteratorConstructor }).Iterator;
  const hasIteratorHelpers = typeof iterator === "function"
    && typeof iterator.prototype?.map === "function"
    && typeof iterator.prototype?.filter === "function"
    && typeof iterator.prototype?.take === "function"
    && typeof iterator.prototype?.toArray === "function";

  return typeof Promise !== "undefined"
    && typeof Promise.withResolvers === "function"
    && typeof URL?.parse === "function"
    && typeof Uint8Array !== "undefined"
    && typeof Worker !== "undefined"
    && typeof TextDecoder !== "undefined"
    && hasIteratorHelpers;
}

export function pdfRuntimeMessage() {
  return "This browser cannot start NotesRAG’s PDF reader. Update the browser or use a current browser to upload PDFs; TXT and Markdown notes are still supported.";
}
