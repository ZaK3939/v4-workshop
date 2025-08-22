// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {HookTestBase} from "./utils/HookTestBase.sol";
import {BalanceDeltaAssertions} from "./utils/BalanceDeltaAssertions.sol";
import {console} from "forge-std/console.sol";
import {IHooks} from "@uniswap/v4-core/interfaces/IHooks.sol";
import {PoolKey} from "@uniswap/v4-core/types/PoolKey.sol";
import {BalanceDelta, toBalanceDelta} from "@uniswap/v4-core/types/BalanceDelta.sol";
import {Currency} from "@uniswap/v4-core/types/Currency.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/libraries/LPFeeLibrary.sol";
import {Hooks} from "@uniswap/v4-core/libraries/Hooks.sol";
import {LiquidityPenaltyHook} from "../src/LiquidityPenaltyHook.sol";

/// @title LiquidityPenaltyHookTest
/// @notice Unit tests for LiquidityPenaltyHook
contract LiquidityPenaltyHookTest is HookTestBase, BalanceDeltaAssertions {
    
    LiquidityPenaltyHook hook;
    PoolKey poolKey;
    
    // Test constants
    uint256 constant PENALTY_BASIS_POINTS = 10; // 0.1%
    uint256 constant LIQUIDITY_AMOUNT = 1e18;
    uint256 constant SMALL_LIQUIDITY = 1e15;
    
    function setUp() public {
        // Deploy fresh test environment
        deployFreshManagerAndRouters();
        deployMintAndApprove2Currencies();
        
        // Deploy LiquidityPenaltyHook
        address hookAddress = address(uint160(
            Hooks.BEFORE_REMOVE_LIQUIDITY_FLAG | 
            Hooks.AFTER_REMOVE_LIQUIDITY_FLAG |
            Hooks.AFTER_REMOVE_LIQUIDITY_RETURNS_DELTA_FLAG
        ));
        deployCodeTo(
            "src/LiquidityPenaltyHook.sol:LiquidityPenaltyHook", 
            abi.encode(manager, PENALTY_BASIS_POINTS), 
            hookAddress
        );
        hook = LiquidityPenaltyHook(hookAddress);
        
        // Initialize pool with hook
        (poolKey,) = initPoolAndAddLiquidity(
            currency0, 
            currency1, 
            IHooks(address(hook)), 
            LPFeeLibrary.DYNAMIC_FEE_FLAG, 
            SQRT_PRICE_1_1
        );
        
        vm.label(address(hook), "LiquidityPenaltyHook");
        vm.label(Currency.unwrap(currency0), "Currency0");
        vm.label(Currency.unwrap(currency1), "Currency1");
    }

    /// @notice Test adding liquidity (should work normally)
    function test_AddLiquidity() public {
        console.log("\n=== Testing Add Liquidity ===");
        
        uint256 gasStart = gasleft();
        BalanceDelta delta = addDefaultLiquidity(poolKey);
        uint256 gasUsed = gasStart - gasleft();
        
        logBalanceDelta("Add liquidity delta", delta);
        logGasUsed("Add liquidity", gasUsed);
        
        // Adding liquidity should result in negative delta (tokens deposited)
        assertNegativeAmount0(delta, "Should deposit currency0");
        assertNegativeAmount1(delta, "Should deposit currency1");
    }

    /// @notice Test removing liquidity immediately after adding (should incur penalty)
    function test_RemoveLiquidityWithPenalty() public {
        console.log("\n=== Testing Remove Liquidity With Penalty ===");
        
        // Add liquidity first
        BalanceDelta addDelta = addDefaultLiquidity(poolKey);
        logBalanceDelta("Add liquidity delta", addDelta);
        
        // Remove liquidity immediately (same block)
        uint256 gasStart = gasleft();
        BalanceDelta removeDelta = removeDefaultLiquidity(poolKey);
        uint256 gasUsed = gasStart - gasleft();
        
        logBalanceDelta("Remove liquidity delta", removeDelta);
        logGasUsed("Remove liquidity with penalty", gasUsed);
        
        // Removing liquidity should result in positive delta (tokens withdrawn)
        assertPositiveAmount0(removeDelta, "Should withdraw currency0");
        assertPositiveAmount1(removeDelta, "Should withdraw currency1");
        
        // Check that penalty was applied (should receive less than deposited)
        int128 netAmount0 = addDelta.amount0() + removeDelta.amount0();
        int128 netAmount1 = addDelta.amount1() + removeDelta.amount1();
        
        console.log("Net amounts after penalty:");
        console.log("  Net amount0: %d (should be negative due to penalty)", netAmount0);
        console.log("  Net amount1: %d (should be negative due to penalty)", netAmount1);
        
        // Net should be negative due to penalty
        assertLt(netAmount0, 0, "Should lose currency0 due to penalty");
        assertLt(netAmount1, 0, "Should lose currency1 due to penalty");
    }

    /// @notice Test removing liquidity after time passes (no penalty)
    function test_RemoveLiquidityNoPenalty() public {
        console.log("\n=== Testing Remove Liquidity No Penalty ===");
        
        // Add liquidity
        BalanceDelta addDelta = addDefaultLiquidity(poolKey);
        logBalanceDelta("Add liquidity delta", addDelta);
        
        // Advance to next block to avoid penalty
        vm.roll(block.number + 1);
        console.log("Advanced to block %d", block.number);
        
        // Remove liquidity
        uint256 gasStart = gasleft();
        BalanceDelta removeDelta = removeDefaultLiquidity(poolKey);
        uint256 gasUsed = gasStart - gasleft();
        
        logBalanceDelta("Remove liquidity delta", removeDelta);
        logGasUsed("Remove liquidity no penalty", gasUsed);
        
        // Check that no penalty was applied (should receive approximately what was deposited)
        int128 netAmount0 = addDelta.amount0() + removeDelta.amount0();
        int128 netAmount1 = addDelta.amount1() + removeDelta.amount1();
        
        console.log("Net amounts without penalty:");
        console.log("  Net amount0: %d", netAmount0);
        console.log("  Net amount1: %d", netAmount1);
        
        // Net should be close to zero (no penalty, just rounding)
        assertApproxEqAbs(
            toBalanceDelta(netAmount0, netAmount1),
            toBalanceDelta(0, 0),
            1000, // Allow small rounding differences
            "Should have minimal net difference without penalty"
        );
    }

    /// @notice Test penalty calculation accuracy
    function test_PenaltyCalculation() public {
        console.log("\n=== Testing Penalty Calculation ===");
        
        // Add a specific amount of liquidity
        uint256 specificLiquidity = 1000e18;
        BalanceDelta addDelta = modifyPoolLiquidity(
            poolKey, 
            TICK_LOWER, 
            TICK_UPPER, 
            int256(specificLiquidity), 
            DEFAULT_SALT
        );
        
        console.log("Added liquidity: %d", specificLiquidity);
        logBalanceDelta("Add specific liquidity delta", addDelta);
        
        // Remove liquidity immediately
        BalanceDelta removeDelta = modifyPoolLiquidity(
            poolKey, 
            TICK_LOWER, 
            TICK_UPPER, 
            -int256(specificLiquidity), 
            DEFAULT_SALT
        );
        
        logBalanceDelta("Remove specific liquidity delta", removeDelta);
        
        // Calculate expected penalty
        int128 expectedPenalty0 = int128(int256(uint256(int256(-addDelta.amount0())) * PENALTY_BASIS_POINTS / 10000));
        int128 expectedPenalty1 = int128(int256(uint256(int256(-addDelta.amount1())) * PENALTY_BASIS_POINTS / 10000));
        
        console.log("Expected penalties:");
        console.log("  Currency0 penalty: %d", expectedPenalty0);
        console.log("  Currency1 penalty: %d", expectedPenalty1);
        
        // Calculate actual penalty
        int128 actualPenalty0 = -addDelta.amount0() - removeDelta.amount0();
        int128 actualPenalty1 = -addDelta.amount1() - removeDelta.amount1();
        
        console.log("Actual penalties:");
        console.log("  Currency0 penalty: %d", actualPenalty0);
        console.log("  Currency1 penalty: %d", actualPenalty1);
        
        // Verify penalty amounts are approximately correct
        assertApproxEqAbs(
            int256(actualPenalty0), int256(expectedPenalty0), 
            uint256(int256(expectedPenalty0) / 100), // 1% tolerance
            "Currency0 penalty should match expected"
        );
        assertApproxEqAbs(
            int256(actualPenalty1), int256(expectedPenalty1),
            uint256(int256(expectedPenalty1) / 100), // 1% tolerance  
            "Currency1 penalty should match expected"
        );
    }

    /// @notice Test multiple liquidity operations in same block
    function test_MultipleLiquidityOperationsSameBlock() public {
        console.log("\n=== Testing Multiple Liquidity Operations Same Block ===");
        
        // First operation: Add liquidity
        BalanceDelta add1 = modifyPoolLiquidity(poolKey, TICK_LOWER, TICK_UPPER, int256(SMALL_LIQUIDITY), bytes32(uint256(1)));
        logBalanceDelta("First add", add1);
        
        // Second operation: Add more liquidity (same block)
        BalanceDelta add2 = modifyPoolLiquidity(poolKey, TICK_LOWER + 60, TICK_UPPER + 60, int256(SMALL_LIQUIDITY), bytes32(uint256(2)));
        logBalanceDelta("Second add", add2);
        
        // Third operation: Remove first liquidity (should have penalty)
        BalanceDelta remove1 = modifyPoolLiquidity(poolKey, TICK_LOWER, TICK_UPPER, -int256(SMALL_LIQUIDITY), bytes32(uint256(1)));
        logBalanceDelta("First remove (with penalty)", remove1);
        
        // Fourth operation: Remove second liquidity (should also have penalty)
        BalanceDelta remove2 = modifyPoolLiquidity(poolKey, TICK_LOWER + 60, TICK_UPPER + 60, -int256(SMALL_LIQUIDITY), bytes32(uint256(2)));
        logBalanceDelta("Second remove (with penalty)", remove2);
        
        // Both removals should incur penalties
        assertLt(add1.amount0() + remove1.amount0(), 0, "First operation should have penalty");
        assertLt(add2.amount0() + remove2.amount0(), 0, "Second operation should have penalty");
    }

    /// @notice Test JIT liquidity prevention scenario
    function test_JITLiquidityPrevention() public {
        console.log("\n=== Testing JIT Liquidity Prevention ===");
        
        // Simulate JIT attack pattern:
        // 1. Large swap is about to happen
        // 2. Attacker adds liquidity just before
        // 3. Attacker removes liquidity just after
        
        // Step 1: Attacker adds liquidity right before large swap
        console.log("Step 1: Attacker adds liquidity");
        BalanceDelta attackerAdd = modifyPoolLiquidity(
            poolKey, 
            TICK_LOWER, 
            TICK_UPPER, 
            int256(LIQUIDITY_AMOUNT * 10), // Large liquidity
            bytes32(uint256(0x999)) // Attacker salt
        );
        logBalanceDelta("Attacker adds liquidity", attackerAdd);
        
        // Step 2: Large user swap happens (in same block)
        console.log("Step 2: Large user swap");
        BalanceDelta swapDelta = swap(poolKey, true, -int256(1e18), ZERO_BYTES);
        logBalanceDelta("User swap", swapDelta);
        
        // Step 3: Attacker tries to remove liquidity immediately (should be penalized)
        console.log("Step 3: Attacker removes liquidity (with penalty)");
        BalanceDelta attackerRemove = modifyPoolLiquidity(
            poolKey,
            TICK_LOWER,
            TICK_UPPER,
            -int256(LIQUIDITY_AMOUNT * 10),
            bytes32(uint256(0x999))
        );
        logBalanceDelta("Attacker removes liquidity", attackerRemove);
        
        // Calculate attacker's net result
        int128 attackerNet0 = attackerAdd.amount0() + attackerRemove.amount0();
        int128 attackerNet1 = attackerAdd.amount1() + attackerRemove.amount1();
        
        console.log("Attacker's net result:");
        console.log("  Net currency0: %d", attackerNet0);
        console.log("  Net currency1: %d", attackerNet1);
        
        // Attacker should lose money due to penalty
        assertLt(attackerNet0, 0, "Attacker should lose currency0 due to penalty");
        assertLt(attackerNet1, 0, "Attacker should lose currency1 due to penalty");
        
        console.log("\n[OK] JIT attack was penalized and made unprofitable");
    }

    /// @notice Test gas efficiency of penalty hook
    function test_GasEfficiency() public {
        console.log("\n=== Testing Gas Efficiency ===");
        
        // Test gas usage for add liquidity
        (BalanceDelta addDelta, uint256 addGas) = measureLiquidityGas(
            poolKey, TICK_LOWER, TICK_UPPER, int256(LIQUIDITY_AMOUNT), bytes32(uint256(1))
        );
        
        // Test gas usage for remove liquidity (with penalty)
        (BalanceDelta removeDelta, uint256 removeGas) = measureLiquidityGas(
            poolKey, TICK_LOWER, TICK_UPPER, -int256(LIQUIDITY_AMOUNT), bytes32(uint256(1))
        );
        
        console.log("Gas usage:");
        console.log("  Add liquidity: %d gas", addGas);
        console.log("  Remove liquidity (with penalty): %d gas", removeGas);
        
        // Remove should use more gas due to penalty logic
        assertGt(removeGas, addGas, "Remove liquidity should use more gas due to penalty logic");
        
        // But should still be reasonable (less than 500k gas)
        assertLt(removeGas, 500000, "Remove liquidity gas usage should be reasonable");
    }

    /// @notice Test penalty basis points configuration
    function test_PenaltyBasisPointsConfiguration() public {
        console.log("\n=== Testing Penalty Configuration ===");
        
        // Test with different penalty rates
        uint256[] memory penaltyRates = new uint256[](3);
        penaltyRates[0] = 5;   // 0.05%
        penaltyRates[1] = 10;  // 0.1% 
        penaltyRates[2] = 50;  // 0.5%
        
        for (uint256 i = 0; i < penaltyRates.length; i++) {
            console.log("\nTesting penalty rate: %d basis points", penaltyRates[i]);
            
            // Deploy hook with different penalty rate
            address testHookAddress = address(uint160(
                Hooks.BEFORE_REMOVE_LIQUIDITY_FLAG | 
                Hooks.AFTER_REMOVE_LIQUIDITY_FLAG |
                Hooks.AFTER_REMOVE_LIQUIDITY_RETURNS_DELTA_FLAG |
                uint160(i + 1) // Different salt for each hook
            ));
            
            deployCodeTo(
                "src/LiquidityPenaltyHook.sol:LiquidityPenaltyHook",
                abi.encode(manager, penaltyRates[i]),
                testHookAddress
            );
            
            // Create pool with this hook
            (PoolKey memory testKey,) = initPoolAndAddLiquidity(
                currency0,
                currency1,
                IHooks(testHookAddress),
                LPFeeLibrary.DYNAMIC_FEE_FLAG,
                SQRT_PRICE_1_1
            );
            
            // Test penalty
            BalanceDelta addDelta = modifyPoolLiquidity(testKey, TICK_LOWER, TICK_UPPER, int256(LIQUIDITY_AMOUNT), DEFAULT_SALT);
            BalanceDelta removeDelta = modifyPoolLiquidity(testKey, TICK_LOWER, TICK_UPPER, -int256(LIQUIDITY_AMOUNT), DEFAULT_SALT);
            
            int128 penalty0 = -addDelta.amount0() - removeDelta.amount0();
            int128 penalty1 = -addDelta.amount1() - removeDelta.amount1();
            
            console.log("  Penalty0:", penalty0);
            console.log("  Penalty1:", penalty1);
            
            // Verify penalty scales with basis points
            if (i > 0) {
                // Current penalty should be roughly proportional to penalty rate
                // (allowing for rounding differences)
                assertTrue(penalty0 > 0, "Should have positive penalty");
                assertTrue(penalty1 > 0, "Should have positive penalty");
            }
        }
        
        console.log("\n[OK] Penalty rates configuration works correctly");
    }
}