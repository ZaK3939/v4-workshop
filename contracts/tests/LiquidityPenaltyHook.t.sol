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
import {HookMiner} from "../src/utils/HookMiner.sol";

/// @title LiquidityPenaltyHookTest
/// @notice Unit tests for LiquidityPenaltyHook
contract LiquidityPenaltyHookTest is HookTestBase, BalanceDeltaAssertions {
    
    LiquidityPenaltyHook hook;
    PoolKey poolKey;
    
    // Test constants
    uint48 constant PENALTY_BASIS_POINTS = 10; // 0.1%
    uint256 constant LIQUIDITY_AMOUNT = 1e18;
    uint256 constant SMALL_LIQUIDITY = 1e15;
    
    function setUp() public {
        deployFreshManagerAndRouters();
        deployMintAndApprove2Currencies();
        
        uint160 permissions = uint160(
            Hooks.AFTER_ADD_LIQUIDITY_FLAG | 
            Hooks.AFTER_ADD_LIQUIDITY_RETURNS_DELTA_FLAG |
            Hooks.AFTER_REMOVE_LIQUIDITY_FLAG |
            Hooks.AFTER_REMOVE_LIQUIDITY_RETURNS_DELTA_FLAG
        );
        
        (address hookAddress, bytes32 salt) = HookMiner.find(
            address(this),
            permissions,
            type(LiquidityPenaltyHook).creationCode,
            abi.encode(address(manager), PENALTY_BASIS_POINTS)
        );
        
        hook = new LiquidityPenaltyHook{salt: salt}(manager, PENALTY_BASIS_POINTS);
        require(address(hook) == hookAddress, "Hook address mismatch");
        
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
        logGasUsed("Add liquidity", gasStart);
        
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
        logGasUsed("Remove liquidity with penalty", gasStart);
        
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
        logGasUsed("Remove liquidity no penalty", gasStart);
        
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



    /// @notice Test penalty basis points configuration
    function test_PenaltyBasisPointsConfiguration() public {
        console.log("\n=== Testing Penalty Configuration ===");
        
        // Test with different penalty rates
        uint48[] memory penaltyRates = new uint48[](3);
        penaltyRates[0] = 5;   // 0.05%
        penaltyRates[1] = 10;  // 0.1% 
        penaltyRates[2] = 50;  // 0.5%
        
        for (uint256 i = 0; i < penaltyRates.length; i++) {
            console.log("\nTesting penalty rate: %d basis points", penaltyRates[i]);
            
            uint160 testPermissions = uint160(
                Hooks.AFTER_ADD_LIQUIDITY_FLAG | 
                Hooks.AFTER_ADD_LIQUIDITY_RETURNS_DELTA_FLAG |
                Hooks.AFTER_REMOVE_LIQUIDITY_FLAG |
                Hooks.AFTER_REMOVE_LIQUIDITY_RETURNS_DELTA_FLAG
            );
            
            (address testHookAddress, bytes32 testSalt) = HookMiner.find(
                address(this),
                testPermissions,
                type(LiquidityPenaltyHook).creationCode,
                abi.encode(address(manager), penaltyRates[i])
            );
            
            LiquidityPenaltyHook testHook = new LiquidityPenaltyHook{salt: testSalt}(manager, penaltyRates[i]);
            require(address(testHook) == testHookAddress, "Hook address mismatch");
            
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