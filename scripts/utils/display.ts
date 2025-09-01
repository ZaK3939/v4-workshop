/**
 * Display utilities for V4 scripts
 */

import { formatEther } from 'viem';
import type { PublicClient, Address } from 'viem';
import { ERC20_ABI } from './abis';

/**
 * Print a formatted header
 */
export function printHeader(title: string, width: number = 40): void {
  const separator = '='.repeat(width);
  console.log();
  console.log(separator);
  console.log(`  ${title}`);
  console.log(separator);
  console.log();
}


/**
 * Display account balances
 */
export async function displayBalances(
  publicClient: PublicClient,
  account: Address,
  contracts: { USDC?: Address }
): Promise<void> {
  const [ethBalance, usdcBalance] = await Promise.all([
    publicClient.getBalance({ address: account }),
    publicClient.readContract({
      address: contracts.USDC!,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [account],
    }),
  ]);

  console.log('Current balances:');
  console.log(`  ETH:  ${formatEther(ethBalance)}`);
  console.log(`  USDC: ${(Number(usdcBalance) / 1e6).toFixed(6)}`);
  console.log();
}


/**
 * Display transaction result
 */
export function displayTransactionResult(
  hash: string,
  description: string,
  details?: Record<string, any>
): void {
  console.log(`\n✅ ${description}`);
  console.log(`   Hash: ${hash}`);
  
  if (details) {
    Object.entries(details).forEach(([key, value]) => {
      console.log(`   ${key}: ${value}`);
    });
  }
}


/**
 * Display success message
 */
export function displaySuccess(message: string): void {
  console.log(`\n✅ ${message}`);
}

/**
 * Display error message
 */
export function displayError(message: string): void {
  console.log(`\n❌ ${message}`);
}

/**
 * Display warning message
 */
export function displayWarning(message: string): void {
  console.log(`\n⚠️  ${message}`);
}

/**
 * Display info message
 */
export function displayInfo(message: string): void {
  console.log(`\nℹ️  ${message}`);
}

