// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.26 <0.9.0;

import { LiquidityPenaltyHook } from "../src/LiquidityPenaltyHook.sol";
import { AntiSandwichHookImpl } from "../src/AntiSandwichHookImpl.sol";
import { LimitOrderHook } from "../src/LimitOrderHook.sol";
import { IPoolManager } from "@uniswap/v4-core/interfaces/IPoolManager.sol";
import { Hooks } from "@uniswap/v4-core/libraries/Hooks.sol";
import { HookMiner } from "../src/utils/HookMiner.sol";
import { BaseScript } from "./Base.s.sol";
import { console } from "forge-std/console.sol";

/// @title DeployHooksWithMiner - Hookデプロイの基本実装
/// @notice HookMinerを使用して3つのHookを正しいアドレスにデプロイします
/// @dev 直接使用するより、DeployAndSave.s.solを使用することを推奨
contract DeployHooksWithMiner is BaseScript {
    // Default addresses - update based on your deployment network
    address constant POOL_MANAGER = 0x1F98400000000000000000000000000000000004; // Unichain Mainnet
    address constant CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C; // Deterministic deployment proxy
    
    struct DeploymentResult {
        address liquidityPenaltyHook;
        address antiSandwichHook;
        address limitOrderHook;
        bytes32 liquidityPenaltySalt;
        bytes32 antiSandwichSalt;
        bytes32 limitOrderSalt;
    }
    
    function run() public virtual broadcast returns (DeploymentResult memory result) {
        IPoolManager poolManager = IPoolManager(POOL_MANAGER);
        
        // Deploy LiquidityPenaltyHook only for testing
        result.liquidityPenaltyHook = deployLiquidityPenaltyHook(poolManager);
        
        // Skip other hooks for now
        // result.antiSandwichHook = deployAntiSandwichHook(poolManager);
        // result.limitOrderHook = deployLimitOrderHook(poolManager);
        
        // Log deployment results
        console.log("===== Hook Deployment Results =====");
        console.log("LiquidityPenaltyHook:", result.liquidityPenaltyHook);
        console.log("===================================");
    }
    
    function deployLiquidityPenaltyHook(IPoolManager poolManager) internal returns (address hookAddress) {
        // LiquidityPenaltyHook permissions from getHookPermissions()
        uint160 flags = uint160(
            Hooks.AFTER_ADD_LIQUIDITY_FLAG | 
            Hooks.AFTER_REMOVE_LIQUIDITY_FLAG |
            Hooks.AFTER_ADD_LIQUIDITY_RETURNS_DELTA_FLAG |
            Hooks.AFTER_REMOVE_LIQUIDITY_RETURNS_DELTA_FLAG
        );
        
        // Constructor arguments
        uint48 blockNumberOffset = 10; // 10 block penalty period
        bytes memory constructorArgs = abi.encode(poolManager, blockNumberOffset);
        
        // Find CREATE2 address that satisfies the permission flags
        (address expectedAddress, bytes32 salt) = HookMiner.find(
            CREATE2_DEPLOYER,
            flags,
            type(LiquidityPenaltyHook).creationCode,
            constructorArgs
        );
        
        // Deploy with CREATE2
        LiquidityPenaltyHook hook = new LiquidityPenaltyHook{salt: salt}(
            poolManager,
            blockNumberOffset
        );
        
        hookAddress = address(hook);
        require(hookAddress == expectedAddress, "Hook address mismatch");
        
        console.log("LiquidityPenaltyHook deployed with salt:", uint256(salt));
    }
    
    function deployAntiSandwichHook(IPoolManager poolManager) internal returns (address hookAddress) {
        // AntiSandwichHook permissions from getHookPermissions()
        uint160 flags = uint160(
            Hooks.BEFORE_SWAP_FLAG |
            Hooks.AFTER_SWAP_FLAG |
            Hooks.AFTER_SWAP_RETURNS_DELTA_FLAG
        );
        
        // Constructor arguments
        bytes memory constructorArgs = abi.encode(poolManager);
        
        // Find CREATE2 address
        (address expectedAddress, bytes32 salt) = HookMiner.find(
            CREATE2_DEPLOYER,
            flags,
            type(AntiSandwichHookImpl).creationCode,
            constructorArgs
        );
        
        // Deploy with CREATE2
        AntiSandwichHookImpl hook = new AntiSandwichHookImpl{salt: salt}(poolManager);
        
        hookAddress = address(hook);
        require(hookAddress == expectedAddress, "Hook address mismatch");
        
        console.log("AntiSandwichHook deployed with salt:", uint256(salt));
    }
    
    function deployLimitOrderHook(IPoolManager poolManager) internal returns (address hookAddress) {
        // LimitOrderHook permissions from getHookPermissions()
        uint160 flags = uint160(
            Hooks.AFTER_INITIALIZE_FLAG |
            Hooks.AFTER_SWAP_FLAG
        );
        
        // Constructor arguments
        bytes memory constructorArgs = abi.encode(poolManager);
        
        // Find CREATE2 address
        (address expectedAddress, bytes32 salt) = HookMiner.find(
            CREATE2_DEPLOYER,
            flags,
            type(LimitOrderHook).creationCode,
            constructorArgs
        );
        
        // Deploy with CREATE2
        LimitOrderHook hook = new LimitOrderHook{salt: salt}(poolManager);
        
        hookAddress = address(hook);
        require(hookAddress == expectedAddress, "Hook address mismatch");
        
        console.log("LimitOrderHook deployed with salt:", uint256(salt));
    }
}