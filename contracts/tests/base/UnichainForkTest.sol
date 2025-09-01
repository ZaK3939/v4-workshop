// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {console2} from "forge-std/console2.sol";
import {Deployers} from "v4-core/test/utils/Deployers.sol";
import {IPoolManager} from "@uniswap/v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/types/Currency.sol";
import {CurrencyLibrary} from "@uniswap/v4-core/types/Currency.sol";
import {IHooks} from "@uniswap/v4-core/interfaces/IHooks.sol";
import {PoolSwapTest} from "v4-core/src/test/PoolSwapTest.sol";
import {PoolModifyLiquidityTest} from "v4-core/src/test/PoolModifyLiquidityTest.sol";
import {MockERC20} from "solmate/src/test/utils/mocks/MockERC20.sol";

/// @title UnichainForkTest
/// @notice Base contract for fork testing Uniswap V4 hooks on Unichain
/// @dev Extends Deployers with fork-specific functionality
abstract contract UnichainForkTest is Test, Deployers {
    using CurrencyLibrary for Currency;

    error WETHWrapFailed();

    // Unichain V4 constants (Chain ID: 130)
    address constant UNICHAIN_POOL_MANAGER = 0x1F98400000000000000000000000000000000004;
    address constant UNICHAIN_POSITION_MANAGER = 0x4529A01c7A0410167c5740C487A8DE60232617bf;
    address constant UNICHAIN_UNIVERSAL_ROUTER = 0xEf740bf23aCaE26f6492B10de645D6B98dC8Eaf3;
    address constant UNICHAIN_PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;
    
    // Common ERC20 tokens on Unichain
    address constant UNICHAIN_WETH = 0x4200000000000000000000000000000000000006;

    // Chain ID
    uint256 constant UNICHAIN_MAINNET_CHAIN_ID = 130;

    /// @notice Sets up a Unichain mainnet fork
    /// @param blockNumber The block number to fork from (0 for latest)
    modifier forkUnichainMainnet(uint256 blockNumber) {
        string memory rpcUrl = vm.envOr("UNICHAIN_RPC", string("https://mainnet.unichain.org"));
        uint256 unichainFork;
        
        if (blockNumber == 0) {
            unichainFork = vm.createFork(rpcUrl);
        } else {
            unichainFork = vm.createFork(rpcUrl, blockNumber);
        }
        
        vm.selectFork(unichainFork);
        assertEq(vm.activeFork(), unichainFork);
        
        // Override the manager with Unichain's deployed manager
        manager = IPoolManager(UNICHAIN_POOL_MANAGER);
        
        console2.log("Forked Unichain mainnet at block:", block.number);
        console2.log("Using PoolManager at:", address(manager));
        console2.log("Chain ID:", block.chainid);
        
        _;
    }


    /// @notice Helper to deal native ETH and wrap it
    /// @param to Address to send WETH to
    /// @param amount Amount of WETH to deal
    function dealWETH(address to, uint256 amount) internal {
        vm.deal(to, amount);
        vm.prank(to);
        (bool success,) = UNICHAIN_WETH.call{value: amount}("");
        if (!success) revert WETHWrapFailed();
    }

    /// @notice Initialize test currencies for fork environment
    function initializeForkCurrencies() internal {
        // Use WETH as currency0
        currency0 = Currency.wrap(UNICHAIN_WETH);
        
        // Deploy a test ERC20 for currency1
        MockERC20 token1 = new MockERC20("Test Token", "TEST", 18);
        currency1 = Currency.wrap(address(token1));
        
        // Mint tokens to this contract
        token1.mint(address(this), type(uint128).max);
        
        // Ensure proper ordering
        if (currency0 > currency1) {
            (currency0, currency1) = (currency1, currency0);
        }
    }

    /// @notice Deploy test infrastructure on fork
    function deployForkTestInfrastructure() internal {
        // Deploy all test routers
        swapRouter = new PoolSwapTest(manager);
        modifyLiquidityRouter = new PoolModifyLiquidityTest(manager);
        
        console2.log("Fork test infrastructure deployed:");
        console2.log("  SwapRouter:", address(swapRouter));
        console2.log("  ModifyLiquidityRouter:", address(modifyLiquidityRouter));
    }

    /// @notice Setup complete fork test environment
    function setupForkTestEnvironment() internal {
        initializeForkCurrencies();
        deployForkTestInfrastructure();
    }

    /// @notice Helper to check if running on fork
    function isFork() internal view virtual override returns (bool) {
        return vm.activeFork() != 0;
    }

    /// @notice Helper to advance time on fork
    /// @param timeToAdvance Seconds to advance
    function advanceTime(uint256 timeToAdvance) internal {
        vm.warp(block.timestamp + timeToAdvance);
        // On Unichain, blocks are ~2 seconds
        vm.roll(block.number + (timeToAdvance / 2));
    }

    /// @notice Take a snapshot and automatically revert after test
    modifier snapshot() {
        uint256 snapshotId = vm.snapshot();
        _;
        vm.revertTo(snapshotId);
    }
}