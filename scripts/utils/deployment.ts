import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { Address } from 'viem';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface DeploymentData {
  network: string;
  chainId: number;
  poolManager: Address;
  positionManager: Address;
  stateView: Address;
  universalRouter: Address;
  permit2: Address;
  quoter?: Address;
  usdc?: Address;
}

export interface PoolEnvData {
  POOL_ID: string;
  CURRENCY0: Address;
  CURRENCY1: Address;
  FEE: number;
  TICK_SPACING: number;
  HOOKS: Address;
  SQRT_PRICE_X96: string;
  TICK: number;
}

// Load deployment data from .deployment.env file (primary source)
export function loadDeploymentEnv(): Record<string, string> {
  const deploymentEnvPath = join(__dirname, '../../contracts/script/.deployment.env');
  
  if (!existsSync(deploymentEnvPath)) {
    throw new Error('Deployment file not found at: ' + deploymentEnvPath + '\nPlease run deployment scripts first');
  }
  
  const envData = readFileSync(deploymentEnvPath, 'utf8');
  const deployment: Record<string, string> = {};
  
  envData.split('\n').forEach(line => {
    if (line.includes('=')) {
      const [key, value] = line.split('=');
      deployment[key] = value;
    }
  });
  
  return deployment;
}

// Load deployment data from JSON file
export function loadDeploymentData(network: string = 'unichain'): DeploymentData {
  const deploymentPath = join(__dirname, `../../deployments/${network}.json`);
  
  if (!existsSync(deploymentPath)) {
    throw new Error(`Deployment file not found: ${deploymentPath}`);
  }
  
  const data = JSON.parse(readFileSync(deploymentPath, 'utf8'));
  return data as DeploymentData;
}

// Load pool configuration from .pool.env file
export function loadPoolEnv(): PoolEnvData {
  const poolEnvPath = join(__dirname, '../../contracts/script/.pool.env');
  
  if (!existsSync(poolEnvPath)) {
    throw new Error(`Pool env file not found: ${poolEnvPath}`);
  }
  
  const poolEnvData = readFileSync(poolEnvPath, 'utf8');
  const poolInfo: Record<string, string> = {};
  
  poolEnvData.split('\n').forEach(line => {
    if (line.includes('=')) {
      const [key, value] = line.split('=');
      poolInfo[key] = value;
    }
  });
  
  return {
    POOL_ID: poolInfo.POOL_ID,
    CURRENCY0: poolInfo.CURRENCY0 as Address,
    CURRENCY1: poolInfo.CURRENCY1 as Address,
    FEE: parseInt(poolInfo.FEE),
    TICK_SPACING: parseInt(poolInfo.TICK_SPACING),
    HOOKS: poolInfo.HOOKS as Address,
    SQRT_PRICE_X96: poolInfo.SQRT_PRICE_X96,
    TICK: parseInt(poolInfo.TICK),
  };
}


// Get all contract addresses for a network
export function getContractAddresses(network: string = 'unichain') {
  const deployment = loadDeploymentData(network);
  
  return {
    POOL_MANAGER: deployment.poolManager,
    POSITION_MANAGER: deployment.positionManager,
    STATE_VIEW: deployment.stateView,
    UNIVERSAL_ROUTER: deployment.universalRouter,
    PERMIT2: deployment.permit2,
    QUOTER: deployment.quoter,
    USDC: deployment.usdc,
  };
}

// Check if pool configuration matches deployment
export function validatePoolConfiguration(): {
  isValid: boolean;
  issues: string[];
} {
  const poolEnv = loadPoolEnv();
  const deploymentEnv = loadDeploymentEnv();
  const issues: string[] = [];
  
  // Check if hook address in pool matches deployed hooks from .deployment.env
  const deployedHooks = Object.entries(deploymentEnv)
    .filter(([key, value]) => key.endsWith('_HOOK') && value && value !== '0x0000000000000000000000000000000000000000')
    .map(([key, value]) => ({ name: key, address: value.toLowerCase() }));
  
  const hookAddresses = deployedHooks.map(h => h.address);
  if (!hookAddresses.includes(poolEnv.HOOKS.toLowerCase())) {
    issues.push(`Pool hook ${poolEnv.HOOKS} is not in .deployment.env. Available hooks: ${deployedHooks.map(h => `${h.name}=${h.address}`).join(', ')}`);
  }
  
  return {
    isValid: issues.length === 0,
    issues,
  };
}