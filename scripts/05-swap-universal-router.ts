#!/usr/bin/env bun
/**
 * V4 Swap via Universal Router
 * Quote first, then execute swap following Uniswap V4 documentation
 * 
 * Available Quote Methods:
 * 1. quoteExactInputSingle - Get output amount for exact input on single pool
 * 2. quoteExactInput - Get output amount for exact input across multiple pools
 * 3. quoteExactOutputSingle - Get input amount for exact output on single pool
 * 4. quoteExactOutput - Get input amount for exact output across multiple pools
 * 
 * Note: For exactOutput methods, ensure the pool has sufficient liquidity
 */

import { 
  parseEther, 
  formatEther, 
  type Address
} from 'viem';
import { loadConfig } from './utils/config.js';
import { unichain } from './utils/clients.js';
import { QUOTER_ABI, UNIVERSAL_ROUTER_ABI, ERC20_ABI } from './utils/abis.js';
import { formatTokenAmount } from './utils/tokens.js';
import {
  printHeader,
  displayBalances,
  displaySuccess,
  displayError,
  displayInfo,
  displayWarning,
} from './utils/display.js';
import { printTransactionLink, extractQuoteFromRevert, handleTransactionError } from './utils/errorHandling.js';
import { 
  V4Planner,
  Actions
} from '@uniswap/v4-sdk';
import { 
  CommandType, 
  RoutePlanner 
} from '@uniswap/universal-router-sdk';

// Load all configuration
const config = loadConfig('unichain');
const { account, publicClient, walletClient, contracts: CONTRACTS, poolInfo } = config;

async function main() {
  printHeader('Quote & Swap via Universal Router (V4)');

  displayInfo(`Network: Unichain`);
  displayInfo(`Wallet: ${account.address}`);
  displayInfo(`Pool ID: ${poolInfo.POOL_ID}`);

  // Token configuration handled directly in poolKey structure below

  // Step 2: Setup swap configuration
  const swapAmount = parseEther('0.00002'); // 0.00002 ETH - within available balance
  
  const swapConfig = {
    poolKey: {
      currency0: poolInfo.CURRENCY0 as Address,
      currency1: poolInfo.CURRENCY1 as Address,
      fee: 3000, // Hardcoded as known value from pool config
      tickSpacing: 60, // Hardcoded as known value from pool config
      hooks: poolInfo.HOOKS as Address,
    },
    zeroForOne: true, // ETH -> USDC
    amountIn: swapAmount.toString(),
    amountOutMinimum: '0', // Will be updated after quote
    hookData: '0x' as const,
  };

  // Step 3: Check balances using display utils
  await displayBalances(publicClient, account.address, CONTRACTS);

  const [ethBalance, usdcBalance] = await Promise.all([
    publicClient.getBalance({ address: account.address }),
    publicClient.readContract({
      address: CONTRACTS.USDC!,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [account.address],
    }),
  ]);
  
  if (ethBalance < swapAmount) {
    displayError('Insufficient ETH balance');
    process.exit(1);
  }

  // Step 4: Get quote from Quoter contract
  displayInfo(`Getting quote for ${formatEther(swapAmount)} ETH → USDC`);
  
  // Quote parameters for V4 Quoter
  
  // Setup quote parameters following reference pattern
  const exactAmount = BigInt(swapConfig.amountIn);
  
  // Ensure exactAmount fits in uint128
  if (exactAmount > BigInt('0xffffffffffffffffffffffffffffffff')) {
    throw new Error('exactAmount exceeds uint128 maximum');
  }
  
  const quoteParams = {
    poolKey: swapConfig.poolKey,
    zeroForOne: swapConfig.zeroForOne,
    exactAmount: exactAmount,
    hookData: '0x' as const,
  };
  
  displayInfo('Quote parameters:');
  console.log('  Pool Key:', {
    currency0: quoteParams.poolKey.currency0,
    currency1: quoteParams.poolKey.currency1,
    fee: quoteParams.poolKey.fee,
    tickSpacing: quoteParams.poolKey.tickSpacing,
    hooks: quoteParams.poolKey.hooks,
  });
  console.log('  Zero for One:', quoteParams.zeroForOne);
  console.log('  Exact Amount:', formatEther(quoteParams.exactAmount), 'ETH');
  console.log('  Hook Data:', quoteParams.hookData);
  
  // Call quoter - it will revert with quote data (expected behavior)
  let quoteSucceeded = false;
  
  let amountOut: bigint;
  let gasEstimate: bigint | undefined;
  
  try {
    const quoterResult = await publicClient.simulateContract({
      address: CONTRACTS.QUOTER!,
      abi: QUOTER_ABI,
      functionName: 'quoteExactInputSingle',
      args: [quoteParams],
    });
    
    // Quoter succeeded! Extract the results
    amountOut = quoterResult.result[0];
    gasEstimate = quoterResult.result[1];
    
    displaySuccess('Quote successful!');
    console.log(`  Expected output: ${formatTokenAmount(amountOut, 6, 'USDC')}`);
    console.log(`  Gas estimate: ${gasEstimate.toString()}`);
    
    quoteSucceeded = true;
  } catch (error: unknown) {
    displayWarning('Quote reverted (expected for V4 Quoter)');
    
    try {
      amountOut = extractQuoteFromRevert(error);
      displaySuccess('Quote extracted from revert data!');
      console.log(`  Expected output: ${formatTokenAmount(amountOut, 6, 'USDC')}`);
      quoteSucceeded = true;
    } catch (extractError) {
      displayError('Failed to extract quote from V4 Quoter response');
      console.error('Quote failed - cannot proceed without valid quote');
      process.exit(1);
    }
  }
  
  // Set minimum output with 1% slippage
  const minAmountOut = (amountOut * 99n) / 100n;
  swapConfig.amountOutMinimum = minAmountOut.toString();
  
  console.log(`  Minimum output (1% slippage): ${formatTokenAmount(minAmountOut, 6, 'USDC')}`);
  
  // Calculate price
  const price = (Number(amountOut) / 1e6) / Number(formatEther(swapAmount));
  console.log(`  Price: 1 ETH = ${price.toFixed(2)} USDC`);
  
  // Ensure quote succeeded before proceeding
  if (!quoteSucceeded) {
    displayError('Quote validation failed - cannot proceed with swap');
    process.exit(1);
  }

  // Step 5: Build swap transaction using V4Planner
  displayInfo('Building swap transaction with V4 SDK');
    
    // Set deadline
    const currentBlock = await publicClient.getBlock();
    const deadline = Number(currentBlock.timestamp) + 3600; // 1 hour
    
    // Create V4Planner instance
    const v4Planner = new V4Planner();
    const routePlanner = new RoutePlanner();
    
    // Prepare swap parameters for V4
    const swapParams = {
      poolKey: swapConfig.poolKey,
      zeroForOne: swapConfig.zeroForOne,
      amountIn: swapConfig.amountIn,
      amountOutMinimum: swapConfig.amountOutMinimum,
      hookData: swapConfig.hookData as `0x${string}`,
    };
    
  console.log('  Building V4 actions...');
    
    // Add V4 actions in sequence
    v4Planner.addAction(Actions.SWAP_EXACT_IN_SINGLE, [swapParams]);
    v4Planner.addAction(Actions.SETTLE_ALL, [swapConfig.poolKey.currency0, swapConfig.amountIn]);
    v4Planner.addAction(Actions.TAKE_ALL, [swapConfig.poolKey.currency1, swapConfig.amountOutMinimum]);
    
    // Finalize V4 actions
    const encodedActions = v4Planner.finalize();
    
    // Add V4_SWAP command to Universal Router
    routePlanner.addCommand(CommandType.V4_SWAP, [v4Planner.actions, v4Planner.params]);
    
  console.log('  ✅ V4 actions encoded successfully');
  
  displayInfo('Transaction details:');
  console.log(`  Swap amount: ${formatEther(swapAmount)} ETH`);
  console.log(`  Min output: ${formatTokenAmount(BigInt(swapConfig.amountOutMinimum), 6, 'USDC')}`);
  console.log(`  Deadline: ${deadline}`);

  // Step 6: Execute swap
  try {
    displayInfo('Executing swap...');
    
    // Execute the swap through Universal Router
    console.log('  Sending transaction to Universal Router...');
      
    const { request } = await publicClient.simulateContract({
      address: CONTRACTS.UNIVERSAL_ROUTER!,
      abi: UNIVERSAL_ROUTER_ABI,
      functionName: 'execute',
      args: [
        routePlanner.commands as `0x${string}`,
        [encodedActions as `0x${string}`],
        BigInt(deadline),
      ],
      account, // Use the full account object, not just the address
      value: swapAmount, // Include ETH value for native ETH swaps
    });
    
    // Execute the transaction
    const txHash = await walletClient.writeContract(request);
    console.log('  📤 Transaction sent:', txHash);
      
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
    });
    
    displaySuccess('Transaction confirmed!');
    console.log(`  Gas used: ${receipt.gasUsed.toString()}`);

    // Step 7: Verify swap results
    displayInfo('Verifying swap results...');
    
    const [ethBalanceAfter, usdcBalanceAfter] = await Promise.all([
      publicClient.getBalance({ address: account.address }),
      publicClient.readContract({
        address: CONTRACTS.USDC!,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [account.address],
      }),
    ]);

    const ethSpent = ethBalance - ethBalanceAfter;
    const usdcReceived = usdcBalanceAfter - usdcBalance;

    displayInfo('Swap summary:');
    console.log(`  ETH spent: ${formatEther(ethSpent)} (including gas)`);
    console.log(`  USDC received: ${formatTokenAmount(usdcReceived, 6, 'USDC')}`);
    
    // Calculate actual execution price
    const actualPrice = (Number(usdcReceived) / 1e6) / Number(formatEther(swapAmount));
    console.log(`  Actual execution price: 1 ETH = ${actualPrice.toFixed(2)} USDC`);
    
    // Compare with expected if we have one
    if (swapConfig.amountOutMinimum !== '0') {
      const expectedUSDC = Number(swapConfig.amountOutMinimum) / 1e6;
      const slippage = ((expectedUSDC - (Number(usdcReceived) / 1e6)) / expectedUSDC) * 100;
      console.log(`  Slippage from expected: ${slippage.toFixed(3)}%`);
    }

    displaySuccess('Swap completed successfully!');
    printTransactionLink(receipt.transactionHash, unichain.id);

  } catch (error) {
    displayError('Swap execution failed');
    handleTransactionError(error, 'V4 Universal Router swap');
    console.log(`  Current min output: ${formatTokenAmount(BigInt(swapConfig.amountOutMinimum), 6, 'USDC')}`);
    process.exit(1);
  }
}

main().catch(console.error);