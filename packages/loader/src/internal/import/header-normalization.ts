const SQL_IDENTIFIER_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

export const normalizeHeaderName = (header: string, fileName: string, index: number): string => {
  const cleaned = header
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase();
  if (!cleaned) {
    throw new Error(`${fileName}: header[${index}] is empty`);
  }

  if (!SQL_IDENTIFIER_RE.test(cleaned)) {
    throw new Error(`${fileName}: header[${index}] is not a valid SQL identifier: ${cleaned}`);
  }

  return cleaned;
};
