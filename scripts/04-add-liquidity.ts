#!/usr/bin/env bun
/**
 * V4 Add Liquidity with Permit2
 * Complete implementation following Uniswap V4 SDK documentation
 */

import { parseEther, formatEther, type Address } from 'viem';
import { join } from 'path';
import { writeFileSync } from 'fs';
import { loadConfig } from './utils/config.js';
import { unichain } from './utils/clients.js';
import { STATE_VIEW_ABI, POSITION_MANAGER_ABI, ERC20_ABI, PERMIT2_ABI, PERMIT2_TYPES } from './utils/abis.js';
import { getTokens, formatTokenAmount } from './utils/tokens.js';
import {
  printHeader,
  displayBalances,
  displaySuccess,
  displayError,
  displayInfo,
  displayTransactionResult,
  displayWarning,
} from './utils/display.js';
import { printTransactionLink } from './utils/errorHandling.js';

const __dirname = new URL('.', import.meta.url).pathname;
import { Pool, Position, V4PositionManager, type MintOptions } from '@uniswap/v4-sdk';
import { Percent, type Currency } from '@uniswap/sdk-core';
import { nearestUsableTick } from '@uniswap/v3-sdk';

// Load all configuration
const config = loadConfig('unichain');
const { account, publicClient, walletClient, contracts: CONTRACTS, poolInfo } = config;

async function main() {
  printHeader('Add Liquidity to V4 Pool with Permit2');

  displayInfo(`Network: Unichain`);
  displayInfo(`Wallet: ${account.address}`);
  displayInfo(`Pool ID: ${poolInfo.POOL_ID}`);

  // Create token instances
  const { ETH, USDC } = getTokens(unichain.id, CONTRACTS);

  // Token order is always ETH/USDC (ETH is token0)
  const token0 = ETH;
  const token1 = USDC;

  // Step 2: Fetch current pool state
  console.log('📊 Fetching pool state...');

  const poolId = poolInfo.POOL_ID as `0x${string}`;

  const [slot0, liquidity] = await Promise.all([
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

  const sqrtPriceX96Current = slot0[0];
  const currentTick = slot0[1];
  const currentLiquidity = liquidity;

  console.log(`Current tick: ${currentTick}`);
  console.log(`Current liquidity: ${formatEther(currentLiquidity)}`);

  // Step 3: Create Pool instance
  // Use data from StateView (slot0) instead of poolInfo
  const fee = Number(slot0[3]); // lpFee from slot0
  const tickSpacing = poolInfo.TICK_SPACING; // From pool configuration

  const pool = new Pool(
    token0 as Currency,
    token1 as Currency,
    fee,
    tickSpacing,
    poolInfo.HOOKS as Address,
    sqrtPriceX96Current.toString(),
    currentLiquidity.toString(),
    currentTick,
  );

  // Display current price from tick
  const currentPrice = pool.token0Price;
  console.log(`Current price: 1 ${token0.symbol} = ${currentPrice.toSignificant(6)} ${token1.symbol}`);

  // Step 4: Calculate tick range
  // Create a range that includes the current tick
  // tickLower should be at/near MIN_TICK, tickUpper should be above current tick
  
  const MIN_TICK = -887272;
  
  // Calculate the lowest valid tick aligned to tickSpacing
  const tickLower = nearestUsableTick(MIN_TICK, tickSpacing);
  // Make sure tickUpper is above current tick to include it in the range
  const tickUpper = nearestUsableTick(currentTick + 10000, tickSpacing);

  console.log(`\n📊 Tick calculation:`);
  console.log(`Current tick: ${currentTick}`);
  console.log(`Tick range: [${tickLower}, ${tickUpper}]`);
  console.log(`Range width: ${tickUpper - tickLower} ticks`);

  // Step 5: Calculate token amounts using V4 SDK
  // First, specify how much ETH we want to provide
  const desiredEthAmount = parseEther('0.0001'); // 0.0001 ETH
  
  // Create a position with the desired ETH amount to find required USDC
  const tempPosition = Position.fromAmount0({
    pool,
    tickLower,
    tickUpper,
    amount0: desiredEthAmount.toString(),
    useFullPrecision: true,
  });

  // Get the actual amounts needed
  const ethAmount = BigInt(tempPosition.amount0.quotient.toString());
  const usdcAmount = BigInt(tempPosition.amount1.quotient.toString());

  console.log(`\n💰 Required amounts for position:`);
  console.log(`  ETH (token0): ${formatEther(ethAmount)}`);
  console.log(`  USDC (token1): ${formatTokenAmount(usdcAmount, 6, 'USDC')}`);
  
  // Display position liquidity
  console.log(`  Position liquidity: ${tempPosition.liquidity.toString()}`);

  // Check balances
  console.log();
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

  if (ethBalance < ethAmount || usdcBalance < usdcAmount) {
    displayError('Insufficient balance');
    process.exit(1);
  }

  // Step 7: Use the position we already calculated
  const position = tempPosition;

  // Show price range analysis
  console.log(`\n📈 Price range analysis:`);
  console.log(`  Current tick: ${currentTick}`);
  console.log(`  Position range: [${tickLower}, ${tickUpper}]`);
  if (currentTick >= tickLower && currentTick <= tickUpper) {
    console.log(`  Current price is IN RANGE`);
    console.log(`  Position will earn fees while price is between ticks ${tickLower} and ${tickUpper}`);
  } else {
    console.log(`  Current price is OUT OF RANGE`);
    console.log(`  Position will only earn fees when price enters the range`);
  }

  // Step 8: Setup Permit2 for gasless approval
  const currentBlock = await publicClient.getBlock();
  const deadline = Number(currentBlock.timestamp) + 20 * 60; // 20 minutes

  const mintOptions: MintOptions = {
    recipient: account.address,
    slippageTolerance: new Percent(50, 10_000), // 0.5%
    deadline: deadline.toString(),
    useNative: ETH,
    hookData: '0x',
  };

  // Check if we need to setup Permit2
  console.log('\n🔐 Setting up Permit2...');

  // Only need permit for USDC (non-native token)
  const [, , nonce] = (await publicClient.readContract({
    address: CONTRACTS.PERMIT2,
    abi: PERMIT2_ABI,
    functionName: 'allowance',
    args: [account.address, CONTRACTS.USDC as Address, CONTRACTS.POSITION_MANAGER],
  })) as [bigint, bigint, bigint];

  const permitDetails = [
    {
      token: CONTRACTS.USDC as Address,
      amount: BigInt(2) ** BigInt(160) - BigInt(1),
      expiration: BigInt(deadline),
      nonce: nonce,
    },
  ];

  const permitData = {
    details: permitDetails,
    spender: CONTRACTS.POSITION_MANAGER,
    sigDeadline: BigInt(deadline),
  };

  // Sign permit
  console.log('✍️  Signing permit...');
  const signature = await walletClient.signTypedData({
    account,
    domain: {
      name: 'Permit2',
      chainId: unichain.id,
      verifyingContract: CONTRACTS.PERMIT2 as Address,
    },
    types: PERMIT2_TYPES,
    primaryType: 'PermitBatch',
    message: permitData,
  });

  mintOptions.batchPermit = {
    owner: account.address,
    permitBatch: {
      details: permitDetails.map((d) => ({
        token: d.token,
        amount: d.amount.toString(),
        expiration: d.expiration.toString(),
        nonce: d.nonce.toString(),
      })),
      spender: permitData.spender,
      sigDeadline: permitData.sigDeadline.toString(),
    },
    signature,
  };

  // Step 9: Generate transaction calldata
  console.log('\n📝 Generating transaction...');
  const { calldata, value } = V4PositionManager.addCallParameters(position, mintOptions);

  console.log(`Transaction value: ${formatEther(BigInt(value))} ETH`);

  // Step 10: Execute transaction
  console.log('\n🚀 Executing transaction...');

  const txHash = await walletClient.writeContract({
    account,
    address: CONTRACTS.POSITION_MANAGER,
    abi: POSITION_MANAGER_ABI,
    functionName: 'multicall',
    args: [[calldata as `0x${string}`]],
    value: BigInt(value),
    chain: unichain,
  });

  console.log('📤 Transaction sent:', txHash);

  const receipt = await publicClient.waitForTransactionReceipt({
    hash: txHash,
  });

  console.log('✅ Transaction confirmed!');

  // Extract token ID from events
  let tokenId: string | null = null;

  // Look for Transfer event (mint)
  for (const log of receipt.logs) {
    if (
      log.address.toLowerCase() === CONTRACTS.POSITION_MANAGER.toLowerCase() &&
      log.topics[0] === '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef' && // Transfer event
      log.topics[1] === '0x0000000000000000000000000000000000000000000000000000000000000000'
    ) {
      // from address(0) = mint
      tokenId = BigInt(log.topics[3]!).toString();
      break;
    }
  }

  if (tokenId) {
    displaySuccess('Position NFT minted!');
    displayTransactionResult(receipt.transactionHash, 'Liquidity added successfully', {
      'Token ID': tokenId,
      'Pool ID': poolId.slice(0, 10) + '...',
      'Tick Range': `[${tickLower}, ${tickUpper}]`,
    });

    // Save position data for future use
    const positionData = {
      tokenId,
      poolId,
      tickLower,
      tickUpper,
      timestamp: Date.now(),
      txHash: receipt.transactionHash,
    };

    writeFileSync(join(__dirname, '.position.json'), JSON.stringify(positionData, null, 2));
    displayInfo('Position data saved to .position.json');
  } else {
    displayWarning('Could not extract token ID from transaction');
  }

  // Verify position by fetching updated pool state
  displayInfo('Verifying position...');

  const [, newLiquidity] = await Promise.all([
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

  const liquidityAdded = newLiquidity - currentLiquidity;
  console.log(`  Liquidity added: ${formatEther(liquidityAdded)}`);
  console.log(`  New total liquidity: ${formatEther(newLiquidity)}`);

  printTransactionLink(receipt.transactionHash, unichain.id);
}

main().catch(console.error);
