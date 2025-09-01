/**
 * Token utilities for V4 scripts
 */

import { Token, Ether } from '@uniswap/sdk-core';
import type { Address } from 'viem';

export interface TokenPair {
  ETH: Ether;
  USDC: Token;
}

/**
 * Get standard token instances for the chain
 */
export function getTokens(chainId: number, contracts: { USDC?: Address }): TokenPair {
  return {
    ETH: Ether.onChain(chainId),
    USDC: new Token(
      chainId,
      contracts.USDC!,
      6,
      'USDC',
      'USD Coin'
    )
  };
}



/**
 * Format token amount for display
 */
export function formatTokenAmount(amount: bigint, decimals: number, symbol?: string): string {
  const divisor = BigInt(10 ** decimals);
  const whole = amount / divisor;
  const fraction = amount % divisor;
  
  // Format with proper decimal places
  const fractionStr = fraction.toString().padStart(decimals, '0');
  const trimmed = fractionStr.replace(/0+$/, ''); // Remove trailing zeros
  
  const formatted = trimmed.length > 0 
    ? `${whole}.${trimmed.slice(0, 6)}` // Max 6 decimal places
    : whole.toString();
    
  return symbol ? `${formatted} ${symbol}` : formatted;
}

