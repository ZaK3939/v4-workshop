// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {IPoolManager} from "@uniswap/v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/types/Currency.sol";
import {IHooks} from "@uniswap/v4-core/interfaces/IHooks.sol";
import {PoolIdLibrary, PoolId} from "@uniswap/v4-core/types/PoolId.sol";
import {FixedPointMathLib} from "solmate/src/utils/FixedPointMathLib.sol";
import {V3PriceOracle} from "./utils/V3PriceOracle.sol";

interface IStateView {
    function getSlot0(bytes32 poolId) external view returns (uint160 sqrtPriceX96, int24 tick, uint32 protocolFee, uint32 lpFee);
    function getLiquidity(bytes32 poolId) external view returns (uint128);
}


contract CreatePool is Script {
    using PoolIdLibrary for PoolKey;
    using FixedPointMathLib for uint256;

    // Unichain V4 Contract Addresses
    IPoolManager constant POOL_MANAGER = IPoolManager(0x1F98400000000000000000000000000000000004);
    address constant STATE_VIEW = 0x86e8631A016F9068C3f085fAF484Ee3F5fDee8f2;
    
    // Tokens
    address constant ETH = address(0); // Native ETH in V4
    address constant USDC = 0x078D782b760474a361dDA0AF3839290b0EF57AD6;

    function run() external {
        // Load private key from environment
        uint256 deployerPrivateKey = vm.envUint("PK");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("==== Creating Uniswap V4 Pool ====");
        console.log("Deployer:", deployer);
        console.log("Network: Unichain");
        
        // Verify contract addresses
        console.log("\n== V4 Contract Addresses ==");
        console.log("PoolManager:", address(POOL_MANAGER));
        console.log("StateView:", address(STATE_VIEW));
        
        
        // Sort tokens (currency0 must be < currency1)
        // ETH is address(0), so it's always < USDC
        (Currency currency0, Currency currency1) = (Currency.wrap(ETH), Currency.wrap(USDC));
        
        // Load LiquidityPenaltyHook address from deployment file
        string memory deploymentData = vm.readFile("./script/.deployment.env");
        require(bytes(deploymentData).length > 0, "Deployment file not found. Please run 01_DeployAndSave.s.sol first");
        
        // Parse the deployment file to get LIQUIDITY_PENALTY_HOOK address
        // The file format is: LIQUIDITY_PENALTY_HOOK=0x...
        address liquidityPenaltyHook;
        string[] memory lines = vm.split(deploymentData, "\n");
        for (uint i = 0; i < lines.length; i++) {
            if (bytes(lines[i]).length > 0) {
                string[] memory parts = vm.split(lines[i], "=");
                if (keccak256(bytes(parts[0])) == keccak256(bytes("LIQUIDITY_PENALTY_HOOK"))) {
                    liquidityPenaltyHook = vm.parseAddress(parts[1]);
                    console.log("Loaded LiquidityPenaltyHook from deployment:", liquidityPenaltyHook);
                    break;
                }
            }
        }
        require(liquidityPenaltyHook != address(0), "LiquidityPenaltyHook address not found in deployment file");
        
        // Create pool key with LiquidityPenaltyHook
        PoolKey memory poolKey = PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: 3000,                  // 0.3% fee
            tickSpacing: 60,            // 60 for 0.3% fee tier
            hooks: IHooks(liquidityPenaltyHook)   // LiquidityPenaltyHook
        });
        
        console.log("\n== Pool Configuration ==");
        console.log("Currency0:", Currency.unwrap(currency0));
        console.log("Currency1:", Currency.unwrap(currency1));
        console.log("Pair: ETH/USDC");
        console.log("Fee:", poolKey.fee);
        console.log("Tick Spacing:", poolKey.tickSpacing);
        console.log("Hook:", address(poolKey.hooks));
        console.log("Hook Name: LiquidityPenaltyHook");
        console.log("Initial Price: From V3 TWAP");
        
        // Calculate pool ID
        bytes32 poolId = PoolId.unwrap(poolKey.toId());
        console.log("\n== Pool ID ==");
        console.log("Pool ID:", vm.toString(poolId));
        
        // Check if pool already exists
        console.log("\n== Checking if pool exists ==");
        (uint160 sqrtPriceX96, int24 tick, , ) = IStateView(STATE_VIEW).getSlot0(poolId);
        
        if (sqrtPriceX96 > 0) {
            console.log("! Pool already exists!");
            console.log("sqrtPriceX96:", sqrtPriceX96);
            console.log("tick:", vm.toString(tick));
            
            // Calculate human-readable price
            // For ETH/USDC with ETH having 18 decimals and USDC having 6
            uint256 Q96 = 2**96;
            uint256 price = uint256(sqrtPriceX96).mulDivDown(sqrtPriceX96, Q96);
            price = price.mulDivDown(1e6, Q96); // Adjust for decimal difference (18-6=12)
            console.log("ETH/USDC price: $", price / 1e6); // Display in human readable format
            
            console.log("\n== Pool Key JSON ==");
            console.log("{");
            console.log("  \"currency0\": \"%s\",", Currency.unwrap(currency0));
            console.log("  \"currency1\": \"%s\",", Currency.unwrap(currency1));
            console.log("  \"fee\": %s,", poolKey.fee);
            console.log("  \"tickSpacing\": %s,", poolKey.tickSpacing);
            console.log("  \"hooks\": \"%s\"", address(poolKey.hooks));
            console.log("}");
            
            // Output pool info even if it already exists
            console.log("\n== POOL_CREATION_RESULT ==");
            console.log("poolId=%s", vm.toString(poolId));
            console.log("currency0=%s", Currency.unwrap(currency0));
            console.log("currency1=%s", Currency.unwrap(currency1));
            console.log("fee=%s", poolKey.fee);
            console.log("tickSpacing=%s", poolKey.tickSpacing);
            console.log("hooks=%s", address(poolKey.hooks));
            console.log("== END_POOL_CREATION_RESULT ==");
            return;
        }
        
        console.log("Pool does not exist yet");
        
        // Get price from V3 oracle
        uint160 sqrtPriceX96Init = V3PriceOracle.getSqrtPriceX96();
        console.log("Using sqrtPriceX96 from V3:", sqrtPriceX96Init);
        
        // Initialize pool
        console.log("\n== Initializing pool ==");
        
        vm.startBroadcast(deployerPrivateKey);
        
        int24 tickCreated = POOL_MANAGER.initialize(poolKey, sqrtPriceX96Init);
        
        vm.stopBroadcast();
        
        console.log("\n[OK] Pool created successfully!");
        console.log("Initial tick:", vm.toString(tickCreated));
        
        // Verify pool creation
        console.log("\n== Verifying pool creation ==");
        (sqrtPriceX96, tick, , ) = IStateView(STATE_VIEW).getSlot0(poolId);
        
        if (sqrtPriceX96 > 0) {
            console.log("[OK] Pool verified in StateView!");
            console.log("sqrtPriceX96:", sqrtPriceX96);
            console.log("tick:", vm.toString(tick));
            
            // Calculate human-readable price
            // For ETH/USDC with ETH having 18 decimals and USDC having 6
            uint256 Q96 = 2**96;
            uint256 price = uint256(sqrtPriceX96).mulDivDown(sqrtPriceX96, Q96);
            price = price.mulDivDown(1e6, Q96); // Adjust for decimal difference (18-6=12)
            console.log("ETH/USDC price: $", price / 1e6); // Display in human readable format
        } else {
            console.log("! Pool not found in StateView (might need a moment to sync)");
        }
        
        console.log("\n== Pool Key JSON ==");
        console.log("{");
        console.log("  \"currency0\": \"%s\",", Currency.unwrap(currency0));
        console.log("  \"currency1\": \"%s\",", Currency.unwrap(currency1));
        console.log("  \"fee\": %s,", poolKey.fee);
        console.log("  \"tickSpacing\": %s,", poolKey.tickSpacing);
        console.log("  \"hooks\": \"%s\"", address(poolKey.hooks));
        console.log("}");
        
        // Output pool creation info for saving
        console.log("\n== POOL_CREATION_RESULT ==");
        console.log("poolId=%s", vm.toString(poolId));
        console.log("currency0=%s", Currency.unwrap(currency0));
        console.log("currency1=%s", Currency.unwrap(currency1));
        console.log("fee=%s", poolKey.fee);
        console.log("tickSpacing=%s", poolKey.tickSpacing);
        console.log("hooks=%s", address(poolKey.hooks));
        console.log("== END_POOL_CREATION_RESULT ==");
        
        // Save pool info to file for 03_ShowPoolInfo.s.sol
        string memory poolInfoFile = string.concat(
            "POOL_ID=", vm.toString(poolId), "\n",
            "CURRENCY0=", vm.toString(Currency.unwrap(currency0)), "\n",
            "CURRENCY1=", vm.toString(Currency.unwrap(currency1)), "\n",
            "FEE=", vm.toString(poolKey.fee), "\n",
            "TICK_SPACING=", vm.toString(poolKey.tickSpacing), "\n",
            "HOOKS=", vm.toString(address(poolKey.hooks)), "\n"
        );
        
        vm.writeFile("./script/.pool.env", poolInfoFile);
        console.log("\nPool info saved to script/.pool.env");
    }
    
}