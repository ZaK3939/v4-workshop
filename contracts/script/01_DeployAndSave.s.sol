// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.26 <0.9.0;

import { DeployHooksWithMiner } from "./DeployHooksWithMiner.s.sol";
import { console } from "forge-std/console.sol";

/// @title DeployAndSave - メインのデプロイスクリプト（これを使ってください！）
/// @notice HookMinerでデプロイし、結果をJSON形式で出力します
/// @dev DeployHooksWithMinerを継承し、デプロイ結果を見やすく整形して表示
contract DeployAndSave is DeployHooksWithMiner {
    
    function run() public override returns (DeploymentResult memory result) {
        // Call parent deployment
        result = super.run();
        
        // Log deployment info for manual update
        console.log("\n========== DEPLOYMENT COMPLETE ==========");
        console.log("Please update deployments/unichain-sepolia.json with:");
        console.log("");
        console.log("LiquidityPenaltyHook:");
        console.log("  address:", result.liquidityPenaltyHook);
        console.log("  salt:", vm.toString(result.liquidityPenaltySalt));
        console.log("");
        console.log("AntiSandwichHookImpl:");
        console.log("  address:", result.antiSandwichHook);
        console.log("  salt:", vm.toString(result.antiSandwichSalt));
        console.log("");
        console.log("LimitOrderHook:");
        console.log("  address:", result.limitOrderHook);
        console.log("  salt:", vm.toString(result.limitOrderSalt));
        console.log("=========================================\n");
        
        // Create deployment JSON output
        string memory json = string.concat(
            '{\n',
            '  "network": "unichain-sepolia",\n',
            '  "chainId": 1301,\n',
            '  "poolManager": "0x2000d755f9e4F3c77E0C9dfb6f84a609E2A0f0fd",\n',
            '  "hooks": {\n',
            '    "LiquidityPenaltyHook": {\n',
            '      "address": "', vm.toString(result.liquidityPenaltyHook), '",\n',
            '      "deploymentBlock": ', vm.toString(block.number), ',\n',
            '      "salt": "', vm.toString(result.liquidityPenaltySalt), '"\n',
            '    },\n',
            '    "AntiSandwichHookImpl": {\n',
            '      "address": "', vm.toString(result.antiSandwichHook), '",\n',
            '      "deploymentBlock": ', vm.toString(block.number), ',\n',
            '      "salt": "', vm.toString(result.antiSandwichSalt), '"\n',
            '    },\n',
            '    "LimitOrderHook": {\n',
            '      "address": "', vm.toString(result.limitOrderHook), '",\n',
            '      "deploymentBlock": ', vm.toString(block.number), ',\n',
            '      "salt": "', vm.toString(result.limitOrderSalt), '"\n',
            '    }\n',
            '  },\n',
            '  "deployedAt": "', vm.toString(block.timestamp), '"\n',
            '}'
        );
        
        console.log("\nDeployment JSON:");
        console.log(json);
        
        // Save deployment addresses to file for other scripts to read
        string memory deploymentFile = string.concat(
            "LIQUIDITY_PENALTY_HOOK=", vm.toString(result.liquidityPenaltyHook), "\n",
            "ANTI_SANDWICH_HOOK=", vm.toString(result.antiSandwichHook), "\n", 
            "LIMIT_ORDER_HOOK=", vm.toString(result.limitOrderHook), "\n"
        );
        
        vm.writeFile("./script/.deployment.env", deploymentFile);
        console.log("\nDeployment addresses saved to script/.deployment.env");
    }
}