// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {TickMath} from "@uniswap/v4-core/libraries/TickMath.sol";
import {FullMath} from "@uniswap/v4-core/libraries/FullMath.sol";
import {FixedPointMathLib} from "solmate/src/utils/FixedPointMathLib.sol";

interface IUniswapV3Factory {
    function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool);
}

interface IUniswapV3Pool {
    function slot0() external view returns (
        uint160 sqrtPriceX96,
        int24 tick,
        uint16 observationIndex,
        uint16 observationCardinality,
        uint16 observationCardinalityNext,
        uint8 feeProtocol,
        bool unlocked
    );
    function token0() external view returns (address);
    function token1() external view returns (address);
}

error NoV3PoolFound();

library V3PriceOracle {
    IUniswapV3Factory constant V3_FACTORY = IUniswapV3Factory(0x1F98400000000000000000000000000000000003);
    address constant WETH = 0x4200000000000000000000000000000000000006;
    address constant USDC = 0x078D782b760474a361dDA0AF3839290b0EF57AD6;

    function getSqrtPriceX96() internal view returns (uint160) {
        // Use the most liquid pool - 0.05% fee tier (500)
        address poolAddress = V3_FACTORY.getPool(WETH, USDC, 500);
        
        if (poolAddress != address(0)) {
            return getSqrtPriceFromPool(poolAddress);
        }
        
        // Fallback to 0.3% pool if 0.05% doesn't exist
        poolAddress = V3_FACTORY.getPool(WETH, USDC, 3000);
        if (poolAddress != address(0)) {
            return getSqrtPriceFromPool(poolAddress);
        }
        
        // Revert if no V3 pool found
        revert NoV3PoolFound();
    }

    function getETHPriceInUSDC() internal view returns (uint256) {
        // Use the most liquid pool - 0.05% fee tier (500)
        address poolAddress = V3_FACTORY.getPool(WETH, USDC, 500);
        
        if (poolAddress != address(0)) {
            return getPriceFromPool(poolAddress);
        }
        
        // Fallback to 0.3% pool if 0.05% doesn't exist
        poolAddress = V3_FACTORY.getPool(WETH, USDC, 3000);
        if (poolAddress != address(0)) {
            return getPriceFromPool(poolAddress);
        }
        
        // Revert if no V3 pool found
        revert NoV3PoolFound();
    }

    function getSqrtPriceFromPool(address poolAddress) private view returns (uint160) {
        IUniswapV3Pool pool = IUniswapV3Pool(poolAddress);
        (uint160 sqrtPriceX96V3,,,,,, ) = pool.slot0();
        
        // V3 pool: USDC/WETH (USDC is token0, WETH is token1)
        // V4 pool: ETH/USDC (ETH is token0, USDC is token1)
        // We need to invert the price since the token order is reversed
        // V3 price is WETH per USDC, we need USDC per ETH
        // So we need to invert: sqrtPriceInverted = 2^96 / sqrtPrice
        return uint160((uint256(1) << 192) / uint256(sqrtPriceX96V3));
    }

    function getPriceFromPool(address poolAddress) private view returns (uint256) {
        IUniswapV3Pool pool = IUniswapV3Pool(poolAddress);
        
        // Use current price from slot0
        (uint160 sqrtPriceX96,,,,,, ) = pool.slot0();
        return calculatePrice(sqrtPriceX96);
    }

    function calculatePrice(uint160 sqrtPriceX96) private pure returns (uint256) {
        // V3 pool: USDC/WETH - price is WETH per USDC, we need USDC per WETH
        // price = 2^192 / (sqrtPriceX96)^2 * 10^6
        uint256 priceX192 = uint256(sqrtPriceX96) * uint256(sqrtPriceX96);
        return FullMath.mulDiv(1 << 192, 1e6, priceX192);
    }
}