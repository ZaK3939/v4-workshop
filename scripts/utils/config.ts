/**
 * Common configuration loader for all scripts
 * Provides a single source of truth for contract addresses, pool info, and clients
 */

import { getContractAddresses, loadPoolEnv, validatePoolConfiguration } from './deployment.js';
import { getClients, unichain, UNICHAIN_RPC } from './clients.js';

export interface ScriptConfig {
  // Network info
  network: string;
  chainId: number;
  rpcUrl: string;
  
  // Clients
  account: ReturnType<typeof getClients>['account'];
  publicClient: ReturnType<typeof getClients>['publicClient'];
  walletClient: ReturnType<typeof getClients>['walletClient'];
  
  // Contract addresses
  contracts: ReturnType<typeof getContractAddresses>;
  
  // Pool configuration
  poolInfo: ReturnType<typeof loadPoolEnv>;
  
  // Validation results
  validation: ReturnType<typeof validatePoolConfiguration>;
}

/**
 * Load all configuration needed for scripts
 * @param network - Network name (default: 'unichain')
 * @param showValidation - Whether to show validation warnings (default: true)
 * @returns Complete configuration object
 */
export function loadConfig(network: string = 'unichain', showValidation: boolean = true): ScriptConfig {
  // Get clients
  const { account, publicClient, walletClient } = getClients();
  
  // Load contract addresses
  const contracts = getContractAddresses(network);
  
  // Load pool info
  const poolInfo = loadPoolEnv();
  
  // Validate configuration
  const validation = validatePoolConfiguration();
  
  // Show validation warnings if requested
  if (showValidation && !validation.isValid) {
    console.log('⚠️  Pool configuration issues detected:');
    validation.issues.forEach(issue => console.log(`   - ${issue}`));
    console.log();
  }
  
  return {
    network,
    chainId: unichain.id,
    rpcUrl: UNICHAIN_RPC,
    account,
    publicClient,
    walletClient,
    contracts,
    poolInfo,
    validation,
  };
}

// Re-export commonly used items for convenience
export { unichain, UNICHAIN_RPC } from './clients.js';
export * from './deployment.js';
export * from './abis.js';