import { ONE_BI } from "../constants";
// https://github.com/Uniswap/sdks/blob/30b98e09d0486cd5cc3e4360e3277eb7cb60d2d5/sdks/v3-sdk/src/utils/fullMath.ts#L4
export class FullMath {
  public static mulDivRoundingUp(
    a: bigint,
    b: bigint,
    denominator: bigint
  ): bigint {
    const product = a * b;
    let result = product / denominator;
    if (product % denominator !== 0n) result = result + 1n;
    return result;
  }
}
