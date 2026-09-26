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

type IteratorResultLike<T> = { value: T; done?: boolean };
type IteratorLike<T> = { next(): IteratorResultLike<T> };
type IteratorHelperPrototype = {
  toArray?: (this: IteratorLike<unknown>) => unknown[];
  map?: (this: IteratorLike<unknown>, fn: (value: unknown, index: number) => unknown) => IterableIterator<unknown>;
  filter?: (this: IteratorLike<unknown>, fn: (value: unknown, index: number) => boolean) => IterableIterator<unknown>;
  take?: (this: IteratorLike<unknown>, count: number) => IterableIterator<unknown>;
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

function drainIterator<T>(iterator: IteratorLike<T>) {
  const items: T[] = [];
  let result = iterator.next();
  while (!result.done) {
    items.push(result.value);
    result = iterator.next();
  }
  return items;
}

// Safari can expose Iterator Helpers that exist but do not return properly
// iterable results. Replace the helpers after core-js has initialised rather
// than trusting feature detection, so PDF.js sees one predictable behavior.
const iteratorConstructor = (globalThis as unknown as { Iterator?: { prototype?: IteratorHelperPrototype } }).Iterator;
if (iteratorConstructor?.prototype) {
  const prototype = iteratorConstructor.prototype;
  prototype.toArray = function (this: IteratorLike<unknown>) {
    return drainIterator(this);
  };
  prototype.map = function (this: IteratorLike<unknown>, fn: (value: unknown, index: number) => unknown) {
    return drainIterator(this).map(fn)[Symbol.iterator]();
  };
  prototype.filter = function (this: IteratorLike<unknown>, fn: (value: unknown, index: number) => boolean) {
    return drainIterator(this).filter(fn)[Symbol.iterator]();
  };
  prototype.take = function (this: IteratorLike<unknown>, count: number) {
    return drainIterator(this).slice(0, count)[Symbol.iterator]();
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
