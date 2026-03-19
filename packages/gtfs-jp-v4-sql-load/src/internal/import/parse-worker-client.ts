import type {
  ParseWorkerRequest,
  ParseWorkerResponse,
} from "./protocol.js";

type ParseCallbacks = {
  onStart: (headers: string[]) => void;
  onChunk: (chunkIndex: number, rows: string[][]) => void;
  onDone: (parsedRows: number) => void;
};

type PendingRequest = ParseCallbacks & {
  resolve: () => void;
  reject: (reason?: unknown) => void;
};

export class ParseWorkerClient {
  #worker: Worker;
  #nextRequestId = 1;
  #pending = new Map<number, PendingRequest>();

  constructor() {
    this.#worker = new Worker(new URL("./parse-worker.js", import.meta.url), {
      type: "module",
    });
    this.#worker.addEventListener("message", this.#handleMessage);
    this.#worker.addEventListener("error", this.#handleError);
    this.#worker.addEventListener("messageerror", this.#handleError);
  }

  async parse(
    fileName: string,
    tableName: string,
    bytes: Uint8Array,
    chunkSize: number,
    callbacks: ParseCallbacks,
  ): Promise<void> {
    const requestId = this.#nextRequestId;
    this.#nextRequestId += 1;

    const requestBytes = new Uint8Array(bytes.byteLength);
    requestBytes.set(bytes);
    const byteBuffer = requestBytes.buffer;

    return await new Promise<void>((resolve, reject) => {
      this.#pending.set(requestId, {
        ...callbacks,
        resolve,
        reject,
      });

      const payload: ParseWorkerRequest = {
        type: "parse",
        requestId,
        fileName,
        tableName,
        bytes: byteBuffer,
        chunkSize,
      };
      this.#worker.postMessage(payload, [byteBuffer]);
    });
  }

  terminate(): void {
    for (const pending of this.#pending.values()) {
      pending.reject(new Error("Parse worker terminated"));
    }
    this.#pending.clear();
    this.#worker.removeEventListener("message", this.#handleMessage);
    this.#worker.removeEventListener("error", this.#handleError);
    this.#worker.removeEventListener("messageerror", this.#handleError);
    this.#worker.terminate();
  }

  #handleMessage = (event: MessageEvent<ParseWorkerResponse>): void => {
    const response = event.data;
    const pending = this.#pending.get(response.requestId);
    if (!pending) {
      return;
    }

    if (response.type === "error") {
      this.#pending.delete(response.requestId);
      pending.reject(new Error(response.error));
      return;
    }

    try {
      if (response.type === "start") {
        pending.onStart(response.headers);
        return;
      }

      if (response.type === "chunk") {
        pending.onChunk(response.chunkIndex, response.rows);
        return;
      }

      this.#pending.delete(response.requestId);
      pending.onDone(response.parsedRows);
      pending.resolve();
    } catch (error) {
      this.#pending.delete(response.requestId);
      pending.reject(error);
    }
  };

  #handleError = (): void => {
    for (const pending of this.#pending.values()) {
      pending.reject(new Error("Parse worker failed"));
    }
    this.#pending.clear();
  };
}
