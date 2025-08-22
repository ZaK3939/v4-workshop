import { FullMath } from "./fullMath";

const Q96 = 2n ** 96n;

export class SqrtPriceMath {
  public static getAmount0Delta(
    sqrtRatioAX96: bigint,
    sqrtRatioBX96: bigint,
    liquidity: bigint,
    roundUp: boolean
  ): bigint {
    if (sqrtRatioAX96 > sqrtRatioBX96) {
      [sqrtRatioAX96, sqrtRatioBX96] = [sqrtRatioBX96, sqrtRatioAX96];
    }

    const numerator1 = liquidity << 96n;
    const numerator2 = sqrtRatioBX96 - sqrtRatioAX96;

    return roundUp
      ? FullMath.mulDivRoundingUp(
          FullMath.mulDivRoundingUp(numerator1, numerator2, sqrtRatioBX96),
          1n,
          sqrtRatioAX96
        )
      : (numerator1 * numerator2) / sqrtRatioBX96 / sqrtRatioAX96;
  }

  public static getAmount1Delta(
    sqrtRatioAX96: bigint,
    sqrtRatioBX96: bigint,
    liquidity: bigint,
    roundUp: boolean
  ): bigint {
    if (sqrtRatioAX96 > sqrtRatioBX96) {
      [sqrtRatioAX96, sqrtRatioBX96] = [sqrtRatioBX96, sqrtRatioAX96];
    }

    const difference = sqrtRatioBX96 - sqrtRatioAX96;

    return roundUp
      ? FullMath.mulDivRoundingUp(liquidity, difference, Q96)
      : (liquidity * difference) / Q96;
  }
}
