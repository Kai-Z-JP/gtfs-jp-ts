import Papa from "papaparse";

type ParseWorkerRequest = {
  type: "parse";
  requestId: number;
  fileName: string;
  tableName: string;
  bytes: ArrayBuffer;
};

type ParsedTable = {
  fileName: string;
  tableName: string;
  headers: string[];
  dataRows: string[][];
};

type ParseWorkerParsedResponse = {
  type: "parsed";
  requestId: number;
  parsedTable: ParsedTable;
};

type ParseWorkerErrorResponse = {
  type: "error";
  requestId: number;
  error: string;
};

type ParseWorkerResponse = ParseWorkerParsedResponse | ParseWorkerErrorResponse;

const SQL_IDENTIFIER_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const textDecoder = new TextDecoder("utf-8");

const runtime = self as DedicatedWorkerGlobalScope;

runtime.onmessage = (event: MessageEvent<ParseWorkerRequest>): void => {
  const request = event.data;
  if (request.type !== "parse") {
    return;
  }

  try {
    const csv = textDecoder.decode(new Uint8Array(request.bytes));
    const parsed = Papa.parse<string[]>(csv, {
      header: false,
      skipEmptyLines: "greedy",
    });

    if (parsed.errors.length > 0) {
      const firstError = parsed.errors[0];
      throw new Error(
        `${request.fileName}: CSV parse error at row ${String(firstError.row)}: ${firstError.message}`,
      );
    }

    const records = parsed.data;
    if (records.length === 0) {
      const response: ParseWorkerResponse = {
        type: "parsed",
        requestId: request.requestId,
        parsedTable: {
          fileName: request.fileName,
          tableName: request.tableName,
          headers: [],
          dataRows: [],
        },
      };
      runtime.postMessage(response);
      return;
    }

    const headers = records[0].map((value, index) =>
      normalizeHeaderName(value, request.fileName, index),
    );
    if (new Set(headers).size !== headers.length) {
      throw new Error(`${request.fileName}: duplicate columns found`);
    }

    const response: ParseWorkerResponse = {
      type: "parsed",
      requestId: request.requestId,
      parsedTable: {
        fileName: request.fileName,
        tableName: request.tableName,
        headers,
        dataRows: records.slice(1).filter(hasNonEmptyCell),
      },
    };

    runtime.postMessage(response);
  } catch (error) {
    const response: ParseWorkerResponse = {
      type: "error",
      requestId: request.requestId,
      error: toErrorMessage(error),
    };
    runtime.postMessage(response);
  }
};

const normalizeHeaderName = (header: string, fileName: string, index: number): string => {
  const cleaned = header.replace(/^\uFEFF/, "").trim();
  if (!cleaned) {
    throw new Error(`${fileName}: header[${index}] is empty`);
  }

  if (!SQL_IDENTIFIER_RE.test(cleaned)) {
    throw new Error(`${fileName}: header[${index}] is not a valid SQL identifier: ${cleaned}`);
  }

  return cleaned;
};

const hasNonEmptyCell = (row: string[]): boolean =>
  row.some((value) => value !== undefined && value.trim() !== "");

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
};

export {};
