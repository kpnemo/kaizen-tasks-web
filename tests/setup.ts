import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { toast } from "sonner";
import { afterAll, afterEach, beforeEach } from "vitest";
import { authStore } from "@/api/auth-store";
import { db } from "./msw/db";
import { setFeatureRequestList } from "./msw/handlers";
import { server } from "./msw/server";

// Started at module scope, not inside beforeAll. openapi-fetch's createClient() reads
// globalThis.fetch once, synchronously, when src/api/client.ts is imported by a test file -
// which happens during Vitest's module-collection phase, before any beforeAll callback runs.
// MSW's fetch interceptor only patches globalThis.fetch once server.listen() actually executes,
// so a beforeAll(() => server.listen(...)) here would patch fetch too late: the client would have
// already captured the pristine, un-intercepted fetch and every request would hit the real network.
// Setup files import before the test file itself, so starting the server here guarantees the patch
// lands first.
server.listen({ onUnhandledRequest: "error" });
beforeEach(() => {
  authStore.reset();
  db.reset();
  setFeatureRequestList([]);
});
afterEach(() => {
  server.resetHandlers();
  cleanup();
  // sonner's ToastState is a module singleton, and subscribe() replays every still-active toast to
  // each new subscriber. Without this, a toast raised by one test reappears under the next test's
  // <Toaster />, so any "no toast was shown" assertion would read another test's toast.
  toast.dismiss();
});
afterAll(() => server.close());

// jsdom gaps that Radix (Popover, AlertDialog, Checkbox) and sonner touch.
if (typeof globalThis.ResizeObserver === "undefined") {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}
if (typeof window.matchMedia !== "function") {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}
if (typeof Element.prototype.scrollIntoView !== "function") {
  Element.prototype.scrollIntoView = () => {};
}
if (typeof Element.prototype.hasPointerCapture !== "function") {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
}
