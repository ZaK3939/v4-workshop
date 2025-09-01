#!/usr/bin/env bun
/**
 * Remove Liquidity from V4 Pool using V4 SDK
 * This script demonstrates the proper way to remove liquidity using V4PositionManager
 */

import {
  type Address,
  formatEther,
} from 'viem';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { loadConfig } from './utils/config.js';
import { unichain } from './utils/clients.js';
import { POSITION_MANAGER_ABI, STATE_VIEW_ABI, ERC20_ABI } from './utils/abis.js';
import { getTokens, formatTokenAmount } from './utils/tokens.js';
import { printHeader, displayBalances, displaySuccess, displayError, displayInfo, displayWarning } from './utils/display.js';
import { printTransactionLink } from './utils/errorHandling.js';
import {
  Pool,
  Position,
  V4PositionManager,
} from '@uniswap/v4-sdk';
import type { RemoveLiquidityOptions } from '@uniswap/v4-sdk';
import {
  Percent,
  type Currency,
} from '@uniswap/sdk-core';

const __dirname = new URL('.', import.meta.url).pathname;

// Load all configuration
const config = loadConfig('unichain');
const { account, publicClient, walletClient, contracts: CONTRACTS } = config;


// Load position data from file
function loadPositionData(): { tokenId: string; poolId: string; tickLower?: number; tickUpper?: number } | null {
  const positionFile = join(__dirname, '.position.json');
  if (!existsSync(positionFile)) {
    console.error('❌ No position data found. Run 04-add-liquidity.ts first');
    return null;
  }
  
  try {
    const data = JSON.parse(readFileSync(positionFile, 'utf8'));
    return data;
  } catch (error) {
    console.error('❌ Failed to load position data:', error);
    return null;
  }
}

// Calculate liquidity to remove
function calculateLiquidityToRemove(
  currentLiquidity: bigint,
  percentageToRemove: number // 0.25 = 25%, 1.0 = 100%
): {
  liquidityToRemove: bigint;
  liquidityPercentage: Percent;
} {
  const liquidityToRemove = (currentLiquidity * BigInt(Math.floor(percentageToRemove * 10000))) / 10000n;
  const liquidityPercentage = new Percent(Math.floor(percentageToRemove * 100), 100);

  return { liquidityToRemove, liquidityPercentage };
}

async function main() {
  printHeader('Remove Liquidity from V4 Pool');
  
  displayInfo('Network: Unichain');
  displayInfo(`Account: ${account.address}`);

  // Load position data
  const positionData = loadPositionData();
  if (!positionData) return;

  const tokenId = BigInt(positionData.tokenId);
  displayInfo(`Position NFT #${tokenId}`);

  // Step 1: Check ownership
  console.log('\n🔍 Checking position ownership...');
  const owner = await publicClient.readContract({
    address: CONTRACTS.POSITION_MANAGER,
    abi: POSITION_MANAGER_ABI,
    functionName: 'ownerOf',
    args: [tokenId],
  });

  if (owner.toLowerCase() !== account.address.toLowerCase()) {
    console.error(`❌ You don't own this position NFT`);
    console.log(`Owner: ${owner}`);
    console.log(`Your address: ${account.address}`);
    return;
  }
  console.log('✅ Position ownership confirmed');

  // Step 2: Get position info
  console.log('\n📊 Fetching position details...');
  
  const [poolKeyAndInfo, currentLiquidity] = await Promise.all([
    publicClient.readContract({
      address: CONTRACTS.POSITION_MANAGER,
      abi: POSITION_MANAGER_ABI,
      functionName: 'getPoolAndPositionInfo',
      args: [tokenId],
    }),
    publicClient.readContract({
      address: CONTRACTS.POSITION_MANAGER,
      abi: POSITION_MANAGER_ABI,
      functionName: 'getPositionLiquidity',
      args: [tokenId],
    }),
  ]);

  const [poolKey] = poolKeyAndInfo;
  
  // Use position data from file instead of decoding (which is unreliable)
  const positionInfo = {
    tickLower: positionData.tickLower!,
    tickUpper: positionData.tickUpper!,
  };

  console.log('\nPosition Details:');
  console.log(`Pool: ${poolKey.currency0}/${poolKey.currency1}`);
  console.log(`Fee: ${poolKey.fee / 10000}%`);
  console.log(`Tick Range: [${positionInfo.tickLower}, ${positionInfo.tickUpper}]`);
  console.log(`Current Liquidity: ${currentLiquidity.toString()}`);
  
  // Validate tick values from file
  if (!positionData.tickLower || !positionData.tickUpper) {
    displayError('Position tick values not found in .position.json');
    throw new Error('Position tick values missing from saved data');
  }

  if (currentLiquidity === 0n) {
    displayWarning('Position has no liquidity to remove');
    return;
  }

  // Get pool state for V4 SDK
  displayInfo('Fetching pool state...');
  const poolId = positionData.poolId as `0x${string}`;
  
  let slot0, poolLiquidity;
  const results = await Promise.all([
    publicClient.readContract({
      address: CONTRACTS.STATE_VIEW,
      abi: STATE_VIEW_ABI,
      functionName: 'getSlot0',
      args: [poolId],
    }),
    publicClient.readContract({
      address: CONTRACTS.STATE_VIEW,
      abi: STATE_VIEW_ABI,
      functionName: 'getLiquidity',
      args: [poolId],
    }),
  ]);
  
  // Unpack the results properly
  slot0 = {
    sqrtPriceX96: results[0][0],
    tick: results[0][1],
    protocolFee: results[0][2],
    lpFee: results[0][3],
  };
  poolLiquidity = results[1];
  
  displaySuccess('Pool state fetched successfully');

  // Create Token instances
  const { ETH, USDC } = getTokens(130, CONTRACTS);
  const token0 = poolKey.currency0 === '0x0000000000000000000000000000000000000000' ? ETH : USDC;
  const token1 = poolKey.currency0 === '0x0000000000000000000000000000000000000000' ? USDC : ETH;

  // Create Pool instance
  const pool = new Pool(
    token0,
    token1,
    Number(poolKey.fee),
    Number(poolKey.tickSpacing),
    poolKey.hooks,
    slot0.sqrtPriceX96.toString(),
    poolLiquidity.toString(),
    slot0.tick
  );

  // Create Position instance
  const position = new Position({
    pool,
    tickLower: positionInfo.tickLower,
    tickUpper: positionInfo.tickUpper,
    liquidity: currentLiquidity.toString(),
  });

  // Calculate removal parameters
  const percentageToRemove = 0.5; // 50% - Remove half of the liquidity
  const { liquidityToRemove, liquidityPercentage } = calculateLiquidityToRemove(
    currentLiquidity,
    percentageToRemove
  );

  displayInfo(`Preparing to remove ${(percentageToRemove * 100).toFixed(0)}% of liquidity...`);
  console.log(`  Liquidity to remove: ${liquidityToRemove.toString()}`);
  console.log(`  Remaining liquidity: ${currentLiquidity - liquidityToRemove}`);

  // Step 8: Configure remove options
  const slippageTolerance = new Percent(50, 10_000); // 0.5% slippage
  const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour

  const removeOptions: RemoveLiquidityOptions = {
    // CommonOptions
    slippageTolerance,
    deadline: deadline.toString(),
    hookData: '0x',

    // ModifyPositionSpecificOptions
    tokenId: tokenId.toString(),

    // RemoveLiquiditySpecificOptions
    liquidityPercentage,
    burnToken: false, // Keep NFT even if removing all liquidity
  };

  // Generate calldata using V4PositionManager
  displayInfo('Generating transaction with V4 SDK...');
  const { calldata, value } = V4PositionManager.removeCallParameters(position, removeOptions);

  console.log('Transaction details:');
  console.log(`- Value: ${formatEther(BigInt(value))} ETH`);
  console.log(`- Slippage tolerance: ${(Number(slippageTolerance.numerator.toString()) / Number(slippageTolerance.denominator.toString()) * 100).toFixed(2)}%`);
  
  // Calculate expected amounts based on position
  const amount0Expected = position.amount0;
  const amount1Expected = position.amount1;
  console.log(`- Expected amounts out:`)
  console.log(`  - ${token0.symbol}: ${token0.isNative ? formatEther(BigInt(amount0Expected.quotient.toString())) : formatTokenAmount(BigInt(amount0Expected.quotient.toString()), token0.decimals, token0.symbol)}`);
  console.log(`  - ${token1.symbol}: ${token1.isNative ? formatEther(BigInt(amount1Expected.quotient.toString())) : formatTokenAmount(BigInt(amount1Expected.quotient.toString()), token1.decimals, token1.symbol)}`);

  // Get balances before
  const [ethBefore, usdcBefore] = await Promise.all([
    publicClient.getBalance({ address: account.address }),
    publicClient.readContract({
      address: CONTRACTS.USDC!,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [account.address],
    }),
  ]);

  // Execute transaction
  displayInfo('Executing transaction...');
  
  const txHash = await walletClient.writeContract({
    account,
    address: CONTRACTS.POSITION_MANAGER,
    abi: POSITION_MANAGER_ABI,
    functionName: 'multicall',
    args: [[calldata as `0x${string}`]],
    value: BigInt(value),
    chain: unichain,
  });

  console.log(`  Transaction sent: ${txHash}`);
  
  const receipt = await publicClient.waitForTransactionReceipt({
    hash: txHash,
  });

  displaySuccess('Transaction confirmed!');
  console.log(`  Gas used: ${receipt.gasUsed.toString()}`);

  // Verify results
  displayInfo('Verifying results...');
  
  const [ethAfter, usdcAfter, newLiquidity] = await Promise.all([
    publicClient.getBalance({ address: account.address }),
    publicClient.readContract({
      address: CONTRACTS.USDC!,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [account.address],
    }),
    publicClient.readContract({
      address: CONTRACTS.POSITION_MANAGER,
      abi: POSITION_MANAGER_ABI,
      functionName: 'getPositionLiquidity',
      args: [tokenId],
    }),
  ]);

  console.log('\nResults:');
  console.log('  Tokens received:');
  const ethReceived = ethAfter - ethBefore + receipt.effectiveGasPrice * receipt.gasUsed;
  const usdcReceived = usdcAfter - usdcBefore;
  console.log(`    - ETH: ${formatEther(ethReceived)}`);
  console.log(`    - USDC: ${formatTokenAmount(usdcReceived, 6, 'USDC')}`);
  
  // Calculate and display penalty
  const token0IsETH = poolKey.currency0 === '0x0000000000000000000000000000000000000000';
  const ethExpected = token0IsETH ? position.amount0.quotient : position.amount1.quotient;
  const usdcExpected = token0IsETH ? position.amount1.quotient : position.amount0.quotient;
  
  // Since we're removing 50%, expected amounts should be half of position amounts
  const expectedEthForRemoval = BigInt(ethExpected.toString()) * BigInt(liquidityPercentage.numerator.toString()) / BigInt(liquidityPercentage.denominator.toString());
  const expectedUsdcForRemoval = BigInt(usdcExpected.toString()) * BigInt(liquidityPercentage.numerator.toString()) / BigInt(liquidityPercentage.denominator.toString());
  
  console.log('\n💸 Penalty Analysis (LiquidityPenaltyHook):');
  if (expectedEthForRemoval > 0n) {
    const penalty = expectedEthForRemoval - ethReceived;
    const penaltyPercentage = Number(penalty) * 100 / Number(expectedEthForRemoval);
    console.log(`  Expected ETH: ${formatEther(expectedEthForRemoval)}`);
    console.log(`  Received ETH: ${formatEther(ethReceived)}`);
    console.log(`  Penalty: ${formatEther(penalty)} ETH (${penaltyPercentage.toFixed(1)}%)`);
  }
  if (expectedUsdcForRemoval > 0n) {
    const penalty = expectedUsdcForRemoval - usdcReceived;
    const penaltyPercentage = Number(penalty) * 100 / Number(expectedUsdcForRemoval);
    console.log(`  Expected USDC: ${formatTokenAmount(expectedUsdcForRemoval, 6, 'USDC')}`);
    console.log(`  Received USDC: ${formatTokenAmount(usdcReceived, 6, 'USDC')}`);
    console.log(`  Penalty: ${formatTokenAmount(penalty, 6, 'USDC')} (${penaltyPercentage.toFixed(1)}%)`);
  }
  
  console.log(`\n  Remaining liquidity: ${newLiquidity.toString()}`);
  console.log(`  Reduction: ${((1 - Number(newLiquidity) / Number(currentLiquidity)) * 100).toFixed(1)}%`);

  displaySuccess('Successfully removed liquidity using V4 SDK!');
  printTransactionLink(receipt.transactionHash, 130);
}

main().catch(console.error);