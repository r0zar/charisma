export interface SplitEstimate {
  total: number;
  perOrder: number;
  minTotal: number;
  minPerOrder: number;
}

/**
 * Estimate what a split swap will return, in the output token's raw units.
 * The estimate is the current quote spread evenly over the orders. The
 * minimum is what each order's post conditions guarantee relative to the
 * quote at execution time (executor default slippage is 1%).
 */
export function estimateSplitOutput({
  amountOut,
  slices,
  slippage = 0.01,
}: {
  amountOut: string | number | undefined;
  slices: number;
  slippage?: number;
}): SplitEstimate | null {
  const total = Number(amountOut);
  if (!amountOut || !Number.isFinite(total) || total <= 0 || slices <= 0) return null;

  const perOrder = total / slices;
  return {
    total,
    perOrder,
    minTotal: total * (1 - slippage),
    minPerOrder: perOrder * (1 - slippage),
  };
}
