export type ParsedLimit =
  | { ok: true; value: number }
  | { ok: false; errorMessage: string };

export function parseLimit(value: string): ParsedLimit {
  const parsedLimit = Number.parseInt(value, 10);
  if (!Number.isFinite(parsedLimit) || parsedLimit <= 0) {
    return {
      ok: false,
      errorMessage: "limit は1以上の整数にしてください",
    };
  }

  return { ok: true, value: parsedLimit };
}
