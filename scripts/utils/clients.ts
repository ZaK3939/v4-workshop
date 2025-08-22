import { 
  createWalletClient, 
  createPublicClient, 
  http,
  type PublicClient,
  type WalletClient,
  type Account
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { defineChain } from 'viem';
import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load environment variables
dotenv.config({ path: join(__dirname, '../../contracts/.env') });

// Get environment variables
export const PRIVATE_KEY = process.env.PK;
export const UNICHAIN_RPC = process.env.UNICHAIN_RPC || 'https://mainnet.unichain.org';

// Define Unichain
export const unichain = defineChain({
  id: 130,
  name: 'Unichain',
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: {
      http: [UNICHAIN_RPC],
    },
  },
  blockExplorers: {
    default: { name: 'Explorer', url: 'https://unichain.org' },
  },
});

// Create account from private key
export function getAccount(): Account {
  if (!PRIVATE_KEY) {
    console.error('❌ Missing PK environment variable');
    process.exit(1);
  }
  
  return privateKeyToAccount(PRIVATE_KEY.startsWith('0x') ? PRIVATE_KEY as `0x${string}` : `0x${PRIVATE_KEY}` as `0x${string}`);
}

// Create public client
export function getPublicClient(): PublicClient {
  return createPublicClient({
    chain: unichain,
    transport: http(UNICHAIN_RPC),
  });
}

// Create wallet client
export function getWalletClient(account?: Account): WalletClient {
  const acc = account || getAccount();
  
  return createWalletClient({
    account: acc,
    chain: unichain,
    transport: http(UNICHAIN_RPC),
  });
}

// Get all clients at once
export function getClients() {
  const account = getAccount();
  const publicClient = getPublicClient();
  const walletClient = getWalletClient(account);
  
  return {
    account,
    publicClient,
    walletClient,
  };
}