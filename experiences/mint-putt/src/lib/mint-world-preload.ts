"use client";

import ReactDOM from "react-dom";
import { getExactMintWorldRuntime } from "./mint-world-runtime";

const MINT_CDN_ORIGIN = "https://cdn.mint.gg";
const RAD_HEADER_BYTES = 64 * 1024;
const warmedRadHeaders = new Map<string, Promise<void>>();

export function hintMintCdn() {
  ReactDOM.preconnect(MINT_CDN_ORIGIN, { crossOrigin: "anonymous" });
  ReactDOM.prefetchDNS(MINT_CDN_ORIGIN);
}

export function warmMintWorldRuntime(holeNumber: number) {
  const runtime = getExactMintWorldRuntime(holeNumber);
  if (!runtime) return;

  hintMintCdn();

  if (typeof window === "undefined" || warmedRadHeaders.has(runtime.runtimeUrl)) {
    return;
  }

  const warmup = fetch(runtime.runtimeUrl, {
    cache: "force-cache",
    credentials: "omit",
    headers: { Range: `bytes=0-${RAD_HEADER_BYTES - 1}` },
    mode: "cors",
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Mint RAD warmup failed with ${response.status}.`);
      }
      return response.arrayBuffer();
    })
    .then(() => undefined)
    .catch(() => {
      warmedRadHeaders.delete(runtime.runtimeUrl);
    });

  warmedRadHeaders.set(runtime.runtimeUrl, warmup);
}
