# Uniswap V4 SDK Usage Patterns

This document captures the key patterns and usage examples of Uniswap V4 SDK extracted from the UI application.

## Core Concepts

### 1. Pool Key Structure

V4 identifies pools using a unique key structure:

```typescript
interface PoolKey {
  currency0: string;  // Lower token address
  currency1: string;  // Higher token address
  fee: number;        // Fee tier (e.g., 3000 = 0.3%)
  tickSpacing: number; // Tick spacing for the pool
  hooks: string;      // Hook contract address
}
```

### 2. V4Planner - Building Transactions

V4Planner is the primary way to build swap transactions:

```typescript
import { V4Planner, Actions } from '@uniswap/v4-sdk';

// Create planner instance
const planner = new V4Planner();

// Build swap transaction
planner.addAction(Actions.SWAP_EXACT_IN_SINGLE, [
  poolKey,          // PoolKey struct
  true,             // zeroForOne (direction)
  amountIn,         // Input amount
  minAmountOut,     // Minimum output
  MAX_UINT256,      // Deadline
  recipient,        // Recipient address
  hookData || '0x', // Optional hook data
]);

// Settle input tokens
planner.addAction(Actions.SETTLE_ALL, [
  inputToken,
  maxAmount,
  false  // Not paying from contract
]);

// Take output tokens
planner.addAction(Actions.TAKE_ALL, [
  outputToken,
  minAmount
]);

// Finalize and get encoded data
const { actions, params } = planner.finalize();
```

### 3. Universal Router Integration

All V4 swaps go through the UniversalRouter:

```typescript
const universalRouterInterface = new ethers.Interface([
  'function execute(bytes calldata commands, bytes[] calldata inputs, uint256 deadline) external payable'
]);

const swapTx = await universalRouter.execute(
  '0x0b',           // V4_SWAP command
  [encodedParams],  // V4Planner output
  deadline,
  { value: ethValue }
);
```

### 4. Position Management

Adding liquidity using V4PositionManager:

```typescript
const calls = [
  encodeFunctionData({
    abi: V4PositionManagerABI,
    functionName: 'modifyLiquidities',
    args: [encodedParams, deadline]
  })
];

// Handle native ETH
if (isNativeToken) {
  calls.push(
    encodeFunctionData({
      abi: V4PositionManagerABI,
      functionName: 'sweep',
      args: [NATIVE_TOKEN_ADDRESS, recipient]
    })
  );
}

const multicallTx = await positionManager.multicall(calls);
```

### 5. Pool State Reading

Reading pool state through StateView contract:

```typescript
const stateViewInterface = new ethers.Interface([
  'function getSlot0(PoolKey memory poolKey) external view returns (uint160 sqrtPriceX96, int24 tick, uint32 protocolFee, uint32 lpFee)',
  'function getLiquidity(PoolKey memory poolKey) external view returns (uint128)',
  'function getPoolPrice(PoolKey memory poolKey, uint256 amountIn, bool zeroForOne) external view returns (uint256)'
]);

const slot0 = await stateView.getSlot0(poolKey);
const liquidity = await stateView.getLiquidity(poolKey);
```

### 6. Permit2 Integration

Batch token approvals using Permit2:

```typescript
const permitData = {
  details: [
    {
      token: token0,
      amount: amount0,
      expiration: MAX_UINT48,
      nonce: nonce0
    },
    {
      token: token1,
      amount: amount1,
      expiration: MAX_UINT48,
      nonce: nonce1
    }
  ],
  spender: positionManager.address,
  sigDeadline: deadline
};

const signature = await signer._signTypedData(
  permitDomain,
  permitTypes,
  permitData
);
```

## Contract Addresses

### Mainnet (Unichain)
- PoolManager: `0x1F98400000000000000000000000000000000004`
- Universal Router: `0x5C60712b43ddC773d82F5AFD59e88C9eDc7AE926`
- V4PositionManager: `0x5C60712b43ddC773d82F5AFD59e88C9eDc7AE926`
- StateView: `0x16F98400000000000000000000000000000000fC`
- Permit2: `0x000000000022D473030F116dDEE9F6B43aC78BA3`

### Testnet (Unichain Sepolia)
- PoolManager: `0x2000d755f9e4F3c77E0C9dfb6f84a609E2A0f0fd`
- Universal Router: `0x97C5c088644fA3F576D7993d8e3516cFA7361f3a`
- V4PositionManager: `0xEcFe3cC2c893df3faa1c06a0a0612cb8a0Aba0b2`
- StateView: `0x4e5F2b7B97e0667AD969dF4CDB93d64691ad8c23`
- Permit2: `0x000000000022D473030F116dDEE9F6B43aC78BA3`

## Common Utilities

### Native Token Handling
```typescript
const NATIVE_TOKEN_ADDRESS = '0x0000000000000000000000000000000000000000';

function isNativeToken(address: string): boolean {
  return address === NATIVE_TOKEN_ADDRESS || 
         address === '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
}
```

### Token Sorting
```typescript
function sortTokens(tokenA: string, tokenB: string): [string, string] {
  return BigInt(tokenA) < BigInt(tokenB) ? [tokenA, tokenB] : [tokenB, tokenA];
}
```

### Pool Key Validation
```typescript
function validatePoolKey(key: PoolKey): boolean {
  return BigInt(key.currency0) < BigInt(key.currency1);
}
```

## Hook Integration

Hooks modify pool behavior and are specified in the pool key:

```typescript
// Create pool with hook
const poolKey = {
  currency0: token0,
  currency1: token1,
  fee: 3000,
  tickSpacing: 60,
  hooks: hookAddress  // Your deployed hook contract
};

// Hook data can be passed in swaps
const hookData = ethers.AbiCoder.defaultAbiCoder().encode(
  ['uint256'], 
  [customValue]
);
```

## Error Handling

Common V4 errors to handle:
- `Pool not initialized` - Pool needs to be created first
- `Invalid pool key` - Tokens not sorted correctly
- `Hook validation failed` - Hook permissions don't match deployment
- `Insufficient liquidity` - Not enough liquidity for swap

## Testing Patterns

### Fork Testing
```typescript
// Use mainnet fork for testing
const provider = new ethers.JsonRpcProvider('http://localhost:8545');
```

### Test Token Deployment
```typescript
const testTokenFactory = new ethers.ContractFactory(
  TestERC20ABI,
  TestERC20Bytecode,
  signer
);
const token = await testTokenFactory.deploy('Test', 'TEST', 18);
```

## Migration from V3

Key differences from V3:
- Pool keys instead of pool addresses
- Singleton PoolManager instead of individual pools
- Hook integration for custom logic
- Transient storage for gas efficiency
- Direct swap specification (no routing)