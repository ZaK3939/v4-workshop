// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.26 <0.9.0;

import { LiquidityPenaltyHook } from "../src/LiquidityPenaltyHook.sol";
import { AntiSandwichHookImpl } from "../src/AntiSandwichHookImpl.sol";
import { LimitOrderHook } from "../src/LimitOrderHook.sol";
import { IPoolManager } from "@uniswap/v4-core/interfaces/IPoolManager.sol";
import { BaseScript } from "./Base.s.sol";

/// @title Deploy - 古い実装（使わないでください）
/// @notice DeployHooksWithMiner.s.solを使用してください
/// @dev DEPRECATED: HookMinerを使用していないため、正しいアドレスにデプロイできません
contract Deploy is BaseScript {
    // Default PoolManager address for Unichain Sepolia
    // Update this based on your deployment network
    address constant POOL_MANAGER = 0x2000d755f9e4F3c77E0C9dfb6f84a609E2A0f0fd;
    
    function run() public broadcast returns (
        LiquidityPenaltyHook liquidityPenaltyHook,
        AntiSandwichHookImpl antiSandwichHook,
        LimitOrderHook limitOrderHook
    ) {
        IPoolManager poolManager = IPoolManager(POOL_MANAGER);
        
        // Deploy LiquidityPenaltyHook with 10 block offset
        liquidityPenaltyHook = new LiquidityPenaltyHook(poolManager, 10);
        
        // Deploy AntiSandwichHook
        antiSandwichHook = new AntiSandwichHookImpl(poolManager);
        
        // Deploy LimitOrderHook
        limitOrderHook = new LimitOrderHook(poolManager);
    }
}