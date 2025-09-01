// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {Deployers} from "v4-core/test/utils/Deployers.sol";
import {BalanceDelta, toBalanceDelta, BalanceDeltaLibrary} from "v4-core/src/types/BalanceDelta.sol";
import {ModifyLiquidityParams} from "v4-core/src/types/PoolOperation.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {PoolId} from "v4-core/src/types/PoolId.sol";
import {Position} from "v4-core/src/libraries/Position.sol";
import {StateLibrary} from "v4-core/src/libraries/StateLibrary.sol";
import {FullMath} from "v4-core/src/libraries/FullMath.sol";
import {FixedPoint128} from "v4-core/src/libraries/FixedPoint128.sol";
import {SwapParams} from "v4-core/src/types/PoolOperation.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {CurrencyLibrary} from "v4-core/src/types/Currency.sol";
import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {console} from "forge-std/console.sol";

/// @title HookTestBase
/// @notice Enhanced test utilities for Uniswap V4 Hooks based on OpenZeppelin patterns
/// @dev Combines OpenZeppelin's HookTest with improved testing patterns
contract HookTestBase is Test, Deployers {
    using CurrencyLibrary for Currency;
    using StateLibrary for IPoolManager;

    // Test constants for predictable results
    int128 constant SWAP_AMOUNT_1e15 = 1e15;
    int128 constant SWAP_RESULT_1e15 = 999000999000999;
    uint256 constant BASE_LIQUIDITY_AMOUNT = 1e18;
    
    // Tick range for testing
    int24 constant TICK_LOWER = -60;
    int24 constant TICK_UPPER = 60;
    
    // Default salt for positions
    bytes32 constant DEFAULT_SALT = bytes32(0);

    /// @notice Calculate the current fees accrued for a given position
    function calculateFees(
        IPoolManager poolManager,
        PoolId poolId,
        address owner,
        int24 tickLower,
        int24 tickUpper,
        bytes32 salt
    ) internal view returns (int128, int128) {
        bytes32 positionKey = Position.calculatePositionKey(owner, tickLower, tickUpper, salt);
        (uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128) =
            poolManager.getPositionInfo(poolId, positionKey);

        (uint256 feeGrowthInside0X128, uint256 feeGrowthInside1X128) =
            poolManager.getFeeGrowthInside(poolId, tickLower, tickUpper);

        uint256 fees0 = FullMath.mulDiv(feeGrowthInside0X128 - feeGrowthInside0LastX128, liquidity, FixedPoint128.Q128);
        uint256 fees1 = FullMath.mulDiv(feeGrowthInside1X128 - feeGrowthInside1LastX128, liquidity, FixedPoint128.Q128);

        return (int128(int256(fees0)), int128(int256(fees1)));
    }

    /// @notice Calculate the current fee delta for a given position
    function calculateFeeDelta(
        IPoolManager poolManager,
        PoolId poolId,
        address owner,
        int24 tickLower,
        int24 tickUpper,
        bytes32 salt
    ) internal view returns (BalanceDelta feeDelta) {
        (int128 fees0, int128 fees1) = calculateFees(poolManager, poolId, owner, tickLower, tickUpper, salt);
        return toBalanceDelta(fees0, fees1);
    }

    /// @notice Modify the liquidity of a given position
    function modifyPoolLiquidity(
        PoolKey memory poolKey,
        int24 tickLower,
        int24 tickUpper,
        int256 liquidity,
        bytes32 salt
    ) internal returns (BalanceDelta) {
        ModifyLiquidityParams memory params = ModifyLiquidityParams({
            tickLower: tickLower,
            tickUpper: tickUpper,
            liquidityDelta: liquidity,
            salt: salt
        });
        return modifyLiquidityRouter.modifyLiquidity(poolKey, params, "");
    }

    /// @notice Perform swaps in all four combinations (zeroForOne true/false, exact input/output)
    function swapAllCombinations(PoolKey memory poolKey, uint256 amount) internal {
        // Exact input, token0 -> token1
        swap(poolKey, true, -int256(amount), ZERO_BYTES);
        
        // Exact output, token0 -> token1  
        swap(poolKey, true, int256(amount), ZERO_BYTES);
        
        // Exact input, token1 -> token0
        swap(poolKey, false, -int256(amount), ZERO_BYTES);
        
        // Exact output, token1 -> token0
        swap(poolKey, false, int256(amount), ZERO_BYTES);
    }

    /// @notice Test sandwich attack pattern
    /// @param poolKey Pool to test on
    /// @param attackAmount Amount for attack swaps
    /// @param userAmount Amount for user swap
    /// @return frontrunDelta Balance delta from frontrun
    /// @return userDelta Balance delta from user swap
    /// @return backrunDelta Balance delta from backrun
    function executeSandwichAttack(
        PoolKey memory poolKey,
        uint256 attackAmount,
        uint256 userAmount
    ) internal returns (
        BalanceDelta frontrunDelta,
        BalanceDelta userDelta,
        BalanceDelta backrunDelta
    ) {
        // Frontrun: attacker swaps first
        frontrunDelta = swap(poolKey, true, -int256(attackAmount), ZERO_BYTES);
        
        // User swap
        userDelta = swap(poolKey, true, -int256(userAmount), ZERO_BYTES);
        
        // Backrun: attacker swaps back
        backrunDelta = swap(poolKey, false, -int256(frontrunDelta.amount1()), ZERO_BYTES);
        
        return (frontrunDelta, userDelta, backrunDelta);
    }

    /// @notice Calculate profit from sandwich attack
    /// @param frontrunDelta Delta from frontrun swap
    /// @param backrunDelta Delta from backrun swap
    /// @return profit0 Profit in token0 (negative means loss)
    /// @return profit1 Profit in token1 (negative means loss)
    function calculateSandwichProfit(
        BalanceDelta frontrunDelta,
        BalanceDelta backrunDelta
    ) internal pure returns (int128 profit0, int128 profit1) {
        profit0 = backrunDelta.amount0() + frontrunDelta.amount0();
        profit1 = backrunDelta.amount1() + frontrunDelta.amount1();
    }

    /// @notice Check if sandwich attack was profitable
    function isSandwichProfitable(
        BalanceDelta frontrunDelta,
        BalanceDelta backrunDelta
    ) internal pure returns (bool) {
        (int128 profit0, int128 profit1) = calculateSandwichProfit(frontrunDelta, backrunDelta);
        // Profitable if we gained in either token
        return profit0 > 0 || profit1 > 0;
    }

    /// @notice Add liquidity with default parameters
    function addDefaultLiquidity(PoolKey memory poolKey) internal returns (BalanceDelta) {
        return modifyPoolLiquidity(poolKey, TICK_LOWER, TICK_UPPER, int256(BASE_LIQUIDITY_AMOUNT), DEFAULT_SALT);
    }

    /// @notice Remove liquidity with default parameters
    function removeDefaultLiquidity(PoolKey memory poolKey) internal returns (BalanceDelta) {
        return modifyPoolLiquidity(poolKey, TICK_LOWER, TICK_UPPER, -int256(BASE_LIQUIDITY_AMOUNT), DEFAULT_SALT);
    }

    /// @notice Helper to log balance delta information
    function logBalanceDelta(string memory label, BalanceDelta delta) internal view {
        console.log(label);
        console.log("  Amount0:", delta.amount0());
        console.log("  Amount1:", delta.amount1());
    }

    /// @notice Helper to log gas usage
    function logGasUsed(string memory operation, uint256 gasStart) internal view {
        uint256 gasUsed = gasStart - gasleft();
        console.log("%s gas used: %d", operation, gasUsed);
    }

    /// @notice Measure gas for a swap operation
    function measureSwapGas(
        PoolKey memory poolKey,
        bool zeroForOne,
        int256 amountSpecified,
        bytes memory hookData
    ) internal returns (BalanceDelta delta, uint256 gasUsed) {
        uint256 gasStart = gasleft();
        delta = swap(poolKey, zeroForOne, amountSpecified, hookData);
        gasUsed = gasStart - gasleft();
    }

    /// @notice Measure gas for a liquidity modification
    function measureLiquidityGas(
        PoolKey memory poolKey,
        int24 tickLower,
        int24 tickUpper,
        int256 liquidityDelta,
        bytes32 salt
    ) internal returns (BalanceDelta delta, uint256 gasUsed) {
        uint256 gasStart = gasleft();
        delta = modifyPoolLiquidity(poolKey, tickLower, tickUpper, liquidityDelta, salt);
        gasUsed = gasStart - gasleft();
    }

    /// @notice Setup test pool with hook and liquidity
    function setupTestPool(IHooks hook, uint24 fee) internal returns (PoolKey memory poolKey) {
        deployFreshManagerAndRouters();
        deployMintAndApprove2Currencies();
        
        (poolKey,) = initPoolAndAddLiquidity(currency0, currency1, hook, fee, SQRT_PRICE_1_1);
        
        return poolKey;
    }

    /// @notice Assert that sandwich attack failed (no profit)
    function assertSandwichFailed(
        BalanceDelta frontrunDelta,
        BalanceDelta backrunDelta,
        string memory message
    ) internal pure {
        (int128 profit0, int128 profit1) = calculateSandwichProfit(frontrunDelta, backrunDelta);
        assertLe(profit0, 0, string(abi.encodePacked(message, " - should not profit in token0")));
        assertLe(profit1, 0, string(abi.encodePacked(message, " - should not profit in token1")));
    }

    /// @notice Assert that sandwich attack succeeded (profitable)
    function assertSandwichSucceeded(
        BalanceDelta frontrunDelta,
        BalanceDelta backrunDelta,
        string memory message
    ) internal pure {
        bool profitable = isSandwichProfitable(frontrunDelta, backrunDelta);
        assertTrue(profitable, string(abi.encodePacked(message, " - should be profitable")));
    }
}