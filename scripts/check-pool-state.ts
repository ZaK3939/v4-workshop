#!/usr/bin/env bun
/**
 * Check V4 Pool State
 * Reads and displays the current state of a Uniswap V4 pool
 */

import { formatEther } from 'viem';
import { loadConfig } from './utils/config.js';
import { STATE_VIEW_ABI } from './utils/abis.js';
import { printHeader, displayInfo, displaySuccess, displayError, displayWarning } from './utils/display.js';

// Load all configuration (no need for account/wallet client for read-only operations)
const config = loadConfig('unichain', false); // false = don't show validation warnings
const { publicClient, contracts: CONTRACTS, poolInfo } = config;

// Pool details from config
const POOL_DETAILS = {
  POOL_ID: poolInfo.POOL_ID as `0x${string}`,
  CURRENCY0: poolInfo.CURRENCY0,
  CURRENCY1: poolInfo.CURRENCY1,
  FEE: poolInfo.FEE,
  HOOK: poolInfo.HOOKS,
};

async function main() {
  printHeader('Check Uniswap V4 Pool State');
  
  displayInfo('Network: Unichain');
  console.log();
  console.log('Pool Details:');
  console.log(`  Pool ID: ${POOL_DETAILS.POOL_ID}`);
  console.log(`  Currency0 (ETH): ${POOL_DETAILS.CURRENCY0}`);
  console.log(`  Currency1 (USDC): ${POOL_DETAILS.CURRENCY1}`);
  console.log(`  Fee: ${POOL_DETAILS.FEE / 10000}% (${POOL_DETAILS.FEE} bps)`);
  console.log(`  Hook: ${POOL_DETAILS.HOOK}`);
  console.log();

  displayInfo('Fetching pool state from PoolManager...');
  
  // Get slot0 and liquidity from PoolManager
  const [slot0PM, liquidityPM] = await Promise.all([
    publicClient.readContract({
      address: CONTRACTS.STATE_VIEW,
      abi: STATE_VIEW_ABI,
      functionName: 'getSlot0',
      args: [POOL_DETAILS.POOL_ID],
    }).catch(err => {
      console.error('Failed to fetch slot0 from PoolManager:', err);
      throw new Error('Cannot read pool state from PoolManager');
    }),
    publicClient.readContract({
      address: CONTRACTS.STATE_VIEW,
      abi: STATE_VIEW_ABI,
      functionName: 'getLiquidity',
      args: [POOL_DETAILS.POOL_ID],
    }).catch(err => {
      console.error('Failed to fetch liquidity from PoolManager:', err);
      throw new Error('Cannot read pool liquidity from PoolManager');
    }),
  ]);

  // Also try StateView (sometimes more reliable)
  displayInfo('Fetching pool state from StateView...');
  
  const [slot0SV, liquiditySV] = await Promise.all([
    publicClient.readContract({
      address: CONTRACTS.STATE_VIEW,
      abi: STATE_VIEW_ABI,
      functionName: 'getSlot0',
      args: [POOL_DETAILS.POOL_ID],
    }).catch(err => {
      console.error('Failed to fetch slot0 from StateView:', err);
      throw new Error('Cannot read pool state from StateView');
    }),
    publicClient.readContract({
      address: CONTRACTS.STATE_VIEW,
      abi: STATE_VIEW_ABI,
      functionName: 'getLiquidity',
      args: [POOL_DETAILS.POOL_ID],
    }).catch(err => {
      console.error('Failed to fetch liquidity from StateView:', err);
      throw new Error('Cannot read liquidity from StateView');
    }),
  ]);

  // Both should have the same data, but prefer StateView
  const slot0 = slot0SV;
  const liquidity = liquiditySV;

  printHeader('Pool State Results', 40);

  if (!slot0 || slot0[0] === 0n) {
    displayError('Pool is NOT initialized');
    console.log('  The pool needs to be initialized before it can be used.');
    return;
  }

  displaySuccess('Pool is initialized!');
  
  const sqrtPriceX96 = slot0[0];
  const tick = slot0[1];
  const protocolFee = slot0[2];
  const lpFee = slot0[3];

  console.log('\nPrice Information:');
  console.log(`  sqrtPriceX96: ${sqrtPriceX96}`);
  console.log(`  Current tick: ${tick}`);
  
  // Calculate price from sqrtPriceX96
  // Price = (sqrtPriceX96 / 2^96)^2
  const Q96 = 2n ** 96n;
  const sqrtPrice = Number(sqrtPriceX96) / Number(Q96);
  const price = sqrtPrice ** 2;
  
  // Adjust for decimals (ETH: 18, USDC: 6)
  const adjustedPrice = price * 10 ** (18 - 6);
  const inversePrice = 1 / adjustedPrice;
  
  console.log('\nExchange Rate:');
  console.log(`  1 ETH = ${adjustedPrice.toFixed(2)} USDC`);
  console.log(`  1 USDC = ${inversePrice.toFixed(8)} ETH`);

  console.log('\nLiquidity:');
  console.log(`  Current liquidity: ${liquidity}`);
  console.log(`  Liquidity (formatted): ${formatEther(liquidity || 0n)}`);

  console.log('\nFee Information:');
  console.log(`  LP fee: ${lpFee} (${lpFee / 10000}%)`);
  console.log(`  Protocol fee: ${protocolFee}`);

  // Additional calculations
  const tickSpacing = 60; // Standard for 0.3% fee
  const tickBase = 1.0001;
  const priceAtTick = tickBase ** tick;
  
  console.log('\nAdditional Info:');
  console.log(`  Tick spacing: ${tickSpacing}`);
  console.log(`  Price at tick (1.0001^${tick}): ${priceAtTick.toFixed(6)}`);
  
  // Check if pool has any liquidity
  if (!liquidity || liquidity === 0n) {
    displayWarning('Pool has no liquidity!');
    console.log('  You need to add liquidity before swapping.');
  } else {
    displaySuccess('Pool has liquidity and is ready for swaps!');
  }
}

main().catch(console.error);