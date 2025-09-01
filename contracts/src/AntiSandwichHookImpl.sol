// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {AntiSandwichHook} from "./AntiSandwichHook.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {SwapParams} from "v4-core/src/types/PoolOperation.sol";
import {BalanceDelta} from "v4-core/src/types/BalanceDelta.sol";

contract AntiSandwichHookImpl is AntiSandwichHook {
    constructor(IPoolManager _poolManager) AntiSandwichHook(_poolManager) {}

    function _afterSwapHandler(
        PoolKey calldata,
        SwapParams calldata,
        BalanceDelta,
        uint256,
        uint256 feeAmount
    ) internal override {
        // In this workshop implementation, collected fees stay in the hook contract
        // In production, you might want to:
        // 1. Distribute to LPs
        // 2. Send to a treasury
        // 3. Use for other purposes
        
        // For workshop: fees accumulate in the hook contract
    }
}