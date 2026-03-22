import type {OpfsSupport} from "../../domain/gtfsWorkbench";

export function detectOpfsSupport(): OpfsSupport {
  if (!globalThis.isSecureContext) {
    return {
      available: false,
      reason: "HTTPS または localhost でアクセスしてください。",
    };
  }

  if (!globalThis.crossOriginIsolated) {
    return {
      available: false,
      reason: "COOP/COEP が不足しています (Cross-Origin-Opener-Policy / Cross-Origin-Embedder-Policy)。",
    };
  }

  if (typeof globalThis.SharedArrayBuffer === "undefined" || typeof globalThis.Atomics === "undefined") {
    return {
      available: false,
      reason: "SharedArrayBuffer/Atomics が利用できません。",
    };
  }

  if (typeof globalThis.navigator?.storage?.getDirectory !== "function") {
    return {
      available: false,
      reason: "このブラウザは OPFS API (navigator.storage.getDirectory) に未対応です。",
    };
  }

  return {available: true};
}
