export type ParseWorkerRequest = {
  type: 'parse';
  requestId: number;
  fileName: string;
  tableName: string;
  bytes: ArrayBuffer;
  chunkSize: number;
};

export type ParseWorkerStartResponse = {
  type: 'start';
  requestId: number;
  headers: string[];
};

export type ParseWorkerChunkResponse = {
  type: 'chunk';
  requestId: number;
  chunkIndex: number;
  rows: string[][];
};

export type ParseWorkerDoneResponse = {
  type: 'done';
  requestId: number;
  parsedRows: number;
};

export type ParseWorkerErrorResponse = {
  type: 'error';
  requestId: number;
  error: string;
};

export type ParseWorkerResponse =
  | ParseWorkerStartResponse
  | ParseWorkerChunkResponse
  | ParseWorkerDoneResponse
  | ParseWorkerErrorResponse;
