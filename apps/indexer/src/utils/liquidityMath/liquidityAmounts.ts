import { SqrtPriceMath } from "./sqrtPriceMath";
import { TickMath } from "./tickMath";

// https://github.com/Uniswap/v3-sdk/blob/4e16fe8e56c8c26541545f138c89133794c7ce72/src/entities/position.ts#L68-L127
export function getAmount0(
  tickLower: bigint,
  tickUpper: bigint,
  currTick: bigint,
  amount: bigint,
  currSqrtPriceX96: bigint
): bigint {
  const sqrtRatioAX96 = TickMath.getSqrtRatioAtTick(tickLower);
  const sqrtRatioBX96 = TickMath.getSqrtRatioAtTick(tickUpper);

  let amount0 = 0n;
  const roundUp = amount > 0n;

  if (currTick < tickLower) {
    amount0 = SqrtPriceMath.getAmount0Delta(
      sqrtRatioAX96,
      sqrtRatioBX96,
      amount,
      roundUp
    );
  } else if (currTick < tickUpper) {
    amount0 = SqrtPriceMath.getAmount0Delta(
      currSqrtPriceX96,
      sqrtRatioBX96,
      amount,
      roundUp
    );
  }

  return amount0;
}

export function getAmount1(
  tickLower: bigint,
  tickUpper: bigint,
  currTick: bigint,
  amount: bigint,
  currSqrtPriceX96: bigint
): bigint {
  const sqrtRatioAX96 = TickMath.getSqrtRatioAtTick(tickLower);
  const sqrtRatioBX96 = TickMath.getSqrtRatioAtTick(tickUpper);

  let amount1 = 0n;
  const roundUp = amount > 0n;

  if (currTick < tickLower) {
    amount1 = 0n;
  } else if (currTick < tickUpper) {
    amount1 = SqrtPriceMath.getAmount1Delta(
      sqrtRatioAX96,
      currSqrtPriceX96,
      amount,
      roundUp
    );
  } else {
    amount1 = SqrtPriceMath.getAmount1Delta(
      sqrtRatioAX96,
      sqrtRatioBX96,
      amount,
      roundUp
    );
  }

  return amount1;
}
