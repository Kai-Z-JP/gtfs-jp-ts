import { inferSchema, initParser } from 'udsv';

import type {
  ParseWorkerErrorResponse,
  ParseWorkerRequest,
  ParseWorkerResponse,
} from './internal/import/protocol.js';
import { getErrorMessage } from './internal/error.js';

const SQL_IDENTIFIER_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const textDecoder = new TextDecoder('utf-8');

const runtime = self as DedicatedWorkerGlobalScope;

const normalizeHeaderName = (header: string, fileName: string, index: number): string => {
  const cleaned = header.replace(/^\uFEFF/, '').trim();
  if (!cleaned) {
    throw new Error(`${fileName}: header[${index}] is empty`);
  }

  if (!SQL_IDENTIFIER_RE.test(cleaned)) {
    throw new Error(`${fileName}: header[${index}] is not a valid SQL identifier: ${cleaned}`);
  }

  return cleaned;
};

const hasNonEmptyCell = (row: string[]): boolean =>
  row.some((value) => value !== undefined && value.trim() !== '');

const postError = (requestId: number, error: unknown): void => {
  const response: ParseWorkerErrorResponse = {
    type: 'error',
    requestId,
    error: getErrorMessage(error),
  };
  runtime.postMessage(response);
};

runtime.onmessage = (event: MessageEvent<ParseWorkerRequest>): void => {
  const request = event.data;
  if (request.type !== 'parse') {
    return;
  }

  try {
    const csv = textDecoder.decode(new Uint8Array(request.bytes));
    const chunkSize = Math.max(1, Math.floor(request.chunkSize));

    let headers: string[] | undefined;
    let chunk: string[][] = [];
    let chunkIndex = 0;
    let parsedRows = 0;

    const flushChunk = (): void => {
      if (chunk.length === 0) {
        return;
      }

      const response: ParseWorkerResponse = {
        type: 'chunk',
        requestId: request.requestId,
        chunkIndex,
        rows: chunk,
      };
      runtime.postMessage(response);
      chunk = [];
      chunkIndex += 1;
    };

    if (csv.trim() !== '') {
      const parser = initParser(
        inferSchema(csv, {
          header: () => [],
          trim: false,
        }),
      );

      parser.stringArrs<string[]>(csv, (rawRow) => {
        const row = rawRow.slice();
        if (!hasNonEmptyCell(row)) {
          return;
        }

        if (!headers) {
          headers = row.map((value, index) => normalizeHeaderName(value, request.fileName, index));
          if (new Set(headers).size !== headers.length) {
            throw new Error(`${request.fileName}: duplicate columns found`);
          }

          const startResponse: ParseWorkerResponse = {
            type: 'start',
            requestId: request.requestId,
            headers,
          };
          runtime.postMessage(startResponse);
          return;
        }

        parsedRows += 1;
        chunk.push(row);

        if (chunk.length >= chunkSize) {
          flushChunk();
        }
      });
    }

    if (!headers) {
      const startResponse: ParseWorkerResponse = {
        type: 'start',
        requestId: request.requestId,
        headers: [],
      };
      runtime.postMessage(startResponse);
    }

    flushChunk();

    const doneResponse: ParseWorkerResponse = {
      type: 'done',
      requestId: request.requestId,
      parsedRows,
    };
    runtime.postMessage(doneResponse);
  } catch (error) {
    postError(request.requestId, error);
  }
};

export {};
