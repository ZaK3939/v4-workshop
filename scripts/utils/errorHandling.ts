/**
 * Common error handling utilities for V4 scripts
 */

interface ErrorPattern {
  pattern: string;
  message: string;
}

const commonErrorPatterns: ErrorPattern[] = [
  {
    pattern: 'insufficient funds',
    message: '💡 Make sure you have enough ETH for the operation plus gas'
  },
  {
    pattern: 'ERC721: owner query',
    message: '💡 The position NFT does not exist or you don\'t own it'
  },
  {
    pattern: 'Price slippage check',
    message: '💡 Too much slippage - try increasing slippage tolerance or reducing amount'
  },
  {
    pattern: '0x8b063d73', // V4TooLittleReceived
    message: '💡 V4TooLittleReceived - output amount is less than minimum specified'
  },
  {
    pattern: 'Delta_InvalidCallerNotLocker',
    message: '💡 Invalid caller - operation must be called through V4 router'
  },
  {
    pattern: 'Hook_NotImplemented',
    message: '💡 Hook does not implement required function'
  },
  {
    pattern: 'Pool_InvalidSqrtRatio',
    message: '💡 Invalid price range - check tick bounds'
  },
  {
    pattern: 'execution reverted',
    message: '💡 Transaction failed - check parameters, liquidity, or hook conditions'
  }
];

export function handleTransactionError(error: unknown, context?: string): void {
  if (!(error instanceof Error)) {
    console.error('\n❌ Unknown error occurred');
    return;
  }

  const errorMessage = error.message || '';
  
  // Check for common patterns
  for (const { pattern, message } of commonErrorPatterns) {
    if (errorMessage.includes(pattern)) {
      console.log(`\n${message}`);
      if (context) {
        console.log(`Context: ${context}`);
      }
      return;
    }
  }

  // Generic error message
  console.error('\n❌ Transaction failed:', errorMessage.slice(0, 200));
  if (context) {
    console.log(`Context: ${context}`);
  }
}


/**
 * Extract quote amount from V4 Quoter revert data
 */
function extractQuoteAmountFromRevertData(revertData: string): bigint | null {
  const data = revertData.slice(2); // Remove 0x
  
  // V4 Quoter constants
  const WRAPPED_ERROR_SELECTOR = '90bfb865';
  const QUOTE_RESULT_SELECTOR = 'b47b2fb1';
  
  // Check if it's a WrappedError with QUOTE_RESULT
  if (!data.startsWith(WRAPPED_ERROR_SELECTOR)) return null;
  
  // Look for QUOTE_RESULT selector
  const quoteResultIndex = data.indexOf(QUOTE_RESULT_SELECTOR);
  if (quoteResultIndex === -1) return null;
  
  // Extract the amount - it's encoded after the selector
  // Skip selector (8 chars) and offset (64 chars) to get to the actual amount
  try {
    const amountStart = quoteResultIndex + 8 + 64;
    const amountHex = data.slice(amountStart, amountStart + 64);
    if (amountHex.length === 64) {
      return BigInt('0x' + amountHex);
    }
  } catch (e) {
    console.log('Failed to extract amount from position');
  }
  
  return null;
}

/**
 * Extract quote amount from V4 Quoter revert
 */
export function extractQuoteFromRevert(error: any): bigint {
  const errorMessage = error.message || error.toString();
  console.log('\n🔍 Looking for revert data in error message...');
  console.log('Full error message:', errorMessage);
  
  // V4 Quoter returns results through revert data
  let revertData: string | null = null;
  
  // Pattern 1: Direct revert data property
  if (error.data) {
    revertData = error.data;
  }
  // Pattern 1.5: Check error.cause.data (viem pattern)
  else if (error.cause && error.cause.data) {
    revertData = error.cause.data;
  }
  // Pattern 2: Look for revert data in message (use the same pattern as reference)
  else {
    const revertDataMatch = errorMessage.match(/UnexpectedRevertBytes\(bytes revertData\)\s*\((0x[0-9a-fA-F]+)\)/);
    if (revertDataMatch && revertDataMatch[1]) {
      revertData = revertDataMatch[1];
      console.log('Found revert data via UnexpectedRevertBytes pattern:', revertData);
    } else {
      // Fallback patterns
      const patterns = [
        /revert data: (0x[0-9a-fA-F]+)/,
        /data="(0x[0-9a-fA-F]+)"/,
        /revertData\s*=\s*(0x[0-9a-fA-F]+)/
      ];
      
      for (const pattern of patterns) {
        const match = errorMessage.match(pattern);
        if (match && match[1]) {
          revertData = match[1];
          console.log('Found revert data via pattern:', pattern, 'data:', revertData);
          break;
        }
      }
    }
  }
  
  if (!revertData) {
    throw new Error('No revert data found in error. Cannot extract quote.');
  }

  console.log('Processing revert data:', revertData.slice(0, 50) + '...');
  
  const amount = extractQuoteAmountFromRevertData(revertData);
  if (!amount) {
    throw new Error('Quote extraction failed - no valid amount found in revert data');
  }
  
  return amount;
}

/**
 * Pretty print transaction hash with explorer link
 */
export function printTransactionLink(hash: string, chainId: number): void {
  const explorerUrls: Record<number, string> = {
    130: 'https://uniscan.io/tx', // Unichain
    1: 'https://etherscan.io/tx',
    11155111: 'https://sepolia.etherscan.io/tx',
  };

  const explorerUrl = explorerUrls[chainId] || explorerUrls[130];
  console.log(`\n📝 Transaction: ${explorerUrl}/${hash}`);
}