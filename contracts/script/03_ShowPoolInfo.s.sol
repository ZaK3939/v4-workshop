// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {PoolKey} from "@uniswap/v4-core/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/types/Currency.sol";
import {IHooks} from "@uniswap/v4-core/interfaces/IHooks.sol";
import {PoolIdLibrary, PoolId} from "@uniswap/v4-core/types/PoolId.sol";
import {Hooks} from "@uniswap/v4-core/libraries/Hooks.sol";

contract ShowPoolInfo is Script {
    using PoolIdLibrary for PoolKey;

    function run() external view {
        console.log("========================================");
        console.log("  Uniswap V4 Pool Info from 01 & 02");
        console.log("========================================");
        console.log("");
        
        // Read deployment info from 01_DeployAndSave
        string memory deploymentData = vm.readFile("./script/.deployment.env");
        require(bytes(deploymentData).length > 0, "Deployment file not found. Please run 01_DeployAndSave.s.sol first");
        
        // Read pool info from 02_CreatePool
        string memory poolData = vm.readFile("./script/.pool.env");
        require(bytes(poolData).length > 0, "Pool file not found. Please run 02_CreatePool.s.sol first");
        
        // Parse pool info
        string[] memory poolLines = vm.split(poolData, "\n");
        bytes32 poolId;
        address currency0;
        address currency1;
        uint24 fee;
        int24 tickSpacing;
        address hooks;
        uint160 sqrtPriceX96;
        int24 tick;
        
        for (uint i = 0; i < poolLines.length; i++) {
            if (bytes(poolLines[i]).length > 0) {
                string[] memory parts = vm.split(poolLines[i], "=");
                if (keccak256(bytes(parts[0])) == keccak256(bytes("POOL_ID"))) {
                    poolId = vm.parseBytes32(parts[1]);
                } else if (keccak256(bytes(parts[0])) == keccak256(bytes("CURRENCY0"))) {
                    currency0 = vm.parseAddress(parts[1]);
                } else if (keccak256(bytes(parts[0])) == keccak256(bytes("CURRENCY1"))) {
                    currency1 = vm.parseAddress(parts[1]);
                } else if (keccak256(bytes(parts[0])) == keccak256(bytes("FEE"))) {
                    fee = uint24(vm.parseUint(parts[1]));
                } else if (keccak256(bytes(parts[0])) == keccak256(bytes("TICK_SPACING"))) {
                    tickSpacing = int24(vm.parseInt(parts[1]));
                } else if (keccak256(bytes(parts[0])) == keccak256(bytes("HOOKS"))) {
                    hooks = vm.parseAddress(parts[1]);
                } else if (keccak256(bytes(parts[0])) == keccak256(bytes("SQRT_PRICE_X96"))) {
                    sqrtPriceX96 = uint160(vm.parseUint(parts[1]));
                } else if (keccak256(bytes(parts[0])) == keccak256(bytes("TICK"))) {
                    tick = int24(vm.parseInt(parts[1]));
                }
            }
        }
        
        console.log("Hook deployed in 01_DeployAndSave:", hooks);
        console.log("");
        console.log("Pool created in 02_CreatePool:");
        console.log("  Pool ID:", vm.toString(poolId));
        console.log("  Currency0 (ETH):", currency0);
        console.log("  Currency1 (USDC):", currency1);
        console.log("  Fee:", fee / 10000, "%");
        console.log("  Tick Spacing:", vm.toString(tickSpacing));
        console.log("  Hook:", hooks);
        console.log("  sqrtPriceX96:", sqrtPriceX96);
        console.log("  Tick:", vm.toString(tick));
        console.log("");
        
        // Generate Uniswap link
        console.log("Uniswap Pool Link:");
        console.log(
            string.concat(
                "https://app.uniswap.org/explore/pools/unichain/",
                vm.toString(poolId)
            )
        );
        
        // Display Hook permissions
        console.log("");
        console.log("== Hook Permissions ==");
        displayHookPermissions(hooks);
    }
    
    function displayHookPermissions(address hookAddress) internal view {
        // Check which permissions are enabled based on the hook address
        // Hook permissions are encoded in the address itself
        IHooks hook = IHooks(hookAddress);
        
        console.log("Checking permissions for:", hookAddress);
        console.log("");
        
        // The hook address encodes permissions in specific bits
        bool beforeInitialize = Hooks.hasPermission(hook, Hooks.BEFORE_INITIALIZE_FLAG);
        bool afterInitialize = Hooks.hasPermission(hook, Hooks.AFTER_INITIALIZE_FLAG);
        bool beforeAddLiquidity = Hooks.hasPermission(hook, Hooks.BEFORE_ADD_LIQUIDITY_FLAG);
        bool afterAddLiquidity = Hooks.hasPermission(hook, Hooks.AFTER_ADD_LIQUIDITY_FLAG);
        bool beforeRemoveLiquidity = Hooks.hasPermission(hook, Hooks.BEFORE_REMOVE_LIQUIDITY_FLAG);
        bool afterRemoveLiquidity = Hooks.hasPermission(hook, Hooks.AFTER_REMOVE_LIQUIDITY_FLAG);
        bool beforeSwap = Hooks.hasPermission(hook, Hooks.BEFORE_SWAP_FLAG);
        bool afterSwap = Hooks.hasPermission(hook, Hooks.AFTER_SWAP_FLAG);
        bool beforeDonate = Hooks.hasPermission(hook, Hooks.BEFORE_DONATE_FLAG);
        bool afterDonate = Hooks.hasPermission(hook, Hooks.AFTER_DONATE_FLAG);
        bool beforeSwapReturnDelta = Hooks.hasPermission(hook, Hooks.BEFORE_SWAP_RETURNS_DELTA_FLAG);
        bool afterSwapReturnDelta = Hooks.hasPermission(hook, Hooks.AFTER_SWAP_RETURNS_DELTA_FLAG);
        bool afterAddLiquidityReturnDelta = Hooks.hasPermission(hook, Hooks.AFTER_ADD_LIQUIDITY_RETURNS_DELTA_FLAG);
        bool afterRemoveLiquidityReturnDelta = Hooks.hasPermission(hook, Hooks.AFTER_REMOVE_LIQUIDITY_RETURNS_DELTA_FLAG);
        
        console.log("Lifecycle Hooks:");
        if (beforeInitialize) console.log("  [X] beforeInitialize");
        if (afterInitialize) console.log("  [X] afterInitialize");
        if (beforeAddLiquidity) console.log("  [X] beforeAddLiquidity");
        if (afterAddLiquidity) console.log("  [X] afterAddLiquidity");
        if (beforeRemoveLiquidity) console.log("  [X] beforeRemoveLiquidity");
        if (afterRemoveLiquidity) console.log("  [X] afterRemoveLiquidity");
        if (beforeSwap) console.log("  [X] beforeSwap");
        if (afterSwap) console.log("  [X] afterSwap");
        if (beforeDonate) console.log("  [X] beforeDonate");
        if (afterDonate) console.log("  [X] afterDonate");
        
        console.log("");
        console.log("Delta Return Flags:");
        if (beforeSwapReturnDelta) console.log("  [X] beforeSwapReturnDelta");
        if (afterSwapReturnDelta) console.log("  [X] afterSwapReturnDelta");
        if (afterAddLiquidityReturnDelta) console.log("  [X] afterAddLiquidityReturnDelta");
        if (afterRemoveLiquidityReturnDelta) console.log("  [X] afterRemoveLiquidityReturnDelta");
        
        console.log("");
        console.log("LiquidityPenaltyHook Purpose:");
        console.log("  - Prevents Just-In-Time (JIT) liquidity attacks");
        console.log("  - Penalizes fee collection if liquidity was recently added");
        console.log("  - Protects long-term liquidity providers");
    }
}