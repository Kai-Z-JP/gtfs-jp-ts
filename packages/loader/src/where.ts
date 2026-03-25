import type { GtfsRow, GtfsScalar } from '@gtfs-jp/types';

export type WhereOp =
  | '='
  | '!='
  | '<'
  | '<='
  | '>'
  | '>='
  | 'like'
  | 'not like'
  | 'in'
  | 'not in'
  | 'is null'
  | 'is not null';

export type WhereExpr<TRow extends GtfsRow = GtfsRow> =
  | { kind: 'cond'; col: string & keyof TRow; op: WhereOp; val?: GtfsScalar | GtfsScalar[] }
  | { kind: 'and'; exprs: readonly WhereExpr<TRow>[] }
  | { kind: 'or'; exprs: readonly WhereExpr<TRow>[] }
  | { kind: 'not'; expr: WhereExpr<TRow> };

export interface WhereExprBuilder<TRow extends GtfsRow> {
  <K extends string & keyof TRow>(
    col: K,
    op: WhereOp,
    val?: GtfsScalar | GtfsScalar[],
  ): WhereExpr<TRow>;
  and(exprs: readonly WhereExpr<TRow>[]): WhereExpr<TRow>;
  or(exprs: readonly WhereExpr<TRow>[]): WhereExpr<TRow>;
  not(expr: WhereExpr<TRow>): WhereExpr<TRow>;
}

export type WhereInput<TRow extends GtfsRow = GtfsRow> =
  | WhereExpr<TRow>
  | ((eb: WhereExprBuilder<TRow>) => WhereExpr<TRow>);

export const makeWhereExprBuilder = <TRow extends GtfsRow>(): WhereExprBuilder<TRow> => {
  const eb = (col: string, op: WhereOp, val?: GtfsScalar | GtfsScalar[]) => ({
    kind: 'cond' as const,
    col,
    op,
    val,
  });
  eb.and = (exprs: readonly WhereExpr<TRow>[]) => ({ kind: 'and' as const, exprs });
  eb.or = (exprs: readonly WhereExpr<TRow>[]) => ({ kind: 'or' as const, exprs });
  eb.not = (expr: WhereExpr<TRow>) => ({ kind: 'not' as const, expr });
  return eb as unknown as WhereExprBuilder<TRow>;
};
