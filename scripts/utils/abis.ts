import { parseAbi } from 'viem';

// V4 State View ABI
export const STATE_VIEW_ABI = parseAbi([
  'function getSlot0(bytes32 poolId) external view returns (uint160 sqrtPriceX96, int24 tick, uint32 protocolFee, uint32 lpFee)',
  'function getLiquidity(bytes32 poolId) external view returns (uint128)',
]);

// V4 Position Manager ABI
export const POSITION_MANAGER_ABI = parseAbi([
  'function multicall(bytes[] calldata data) external payable returns (bytes[] memory)',
  'function ownerOf(uint256 tokenId) external view returns (address owner)',
  'struct PoolKey { address currency0; address currency1; uint24 fee; int24 tickSpacing; address hooks; }',
  'function getPoolAndPositionInfo(uint256 tokenId) external view returns (PoolKey poolKey, uint256 info)',
  'function getPositionLiquidity(uint256 tokenId) external view returns (uint128 liquidity)',
  'event PositionMinted(uint256 indexed tokenId, address indexed owner)',
]);

// V4 Quoter ABI (corrected with uint128)
export const QUOTER_ABI = [
  {
    inputs: [{ internalType: 'contract IPoolManager', name: '_poolManager', type: 'address' }],
    stateMutability: 'nonpayable',
    type: 'constructor',
  },
  { inputs: [{ internalType: 'PoolId', name: 'poolId', type: 'bytes32' }], name: 'NotEnoughLiquidity', type: 'error' },
  { inputs: [], name: 'NotPoolManager', type: 'error' },
  { inputs: [], name: 'NotSelf', type: 'error' },
  { inputs: [{ internalType: 'uint256', name: 'amount', type: 'uint256' }], name: 'QuoteSwap', type: 'error' },
  { inputs: [], name: 'UnexpectedCallSuccess', type: 'error' },
  {
    inputs: [{ internalType: 'bytes', name: 'revertData', type: 'bytes' }],
    name: 'UnexpectedRevertBytes',
    type: 'error',
  },
  {
    inputs: [
      {
        components: [
          {
            components: [
              { internalType: 'Currency', name: 'currency0', type: 'address' },
              { internalType: 'Currency', name: 'currency1', type: 'address' },
              { internalType: 'uint24', name: 'fee', type: 'uint24' },
              { internalType: 'int24', name: 'tickSpacing', type: 'int24' },
              { internalType: 'contract IHooks', name: 'hooks', type: 'address' },
            ],
            internalType: 'struct PoolKey',
            name: 'poolKey',
            type: 'tuple',
          },
          { internalType: 'bool', name: 'zeroForOne', type: 'bool' },
          { internalType: 'uint128', name: 'exactAmount', type: 'uint128' },
          { internalType: 'bytes', name: 'hookData', type: 'bytes' },
        ],
        internalType: 'struct IV4Quoter.QuoteExactSingleParams',
        name: 'params',
        type: 'tuple',
      },
    ],
    name: 'quoteExactInputSingle',
    outputs: [
      { internalType: 'uint256', name: 'amountOut', type: 'uint256' },
      { internalType: 'uint256', name: 'gasEstimate', type: 'uint256' },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

// Universal Router ABI
export const UNIVERSAL_ROUTER_ABI = parseAbi([
  'function execute(bytes commands, bytes[] inputs, uint256 deadline) external payable',
]);

// ERC20 ABI
export const ERC20_ABI = parseAbi([
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function balanceOf(address account) external view returns (uint256)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function decimals() external view returns (uint8)',
]);

// Permit2 ABI
export const PERMIT2_ABI = parseAbi([
  'function allowance(address owner, address token, address spender) external view returns (uint256 amount, uint256 expiration, uint256 nonce)',
]);

// Permit2 type definitions for signing
export const PERMIT2_TYPES = {
  PermitBatch: [
    { name: 'details', type: 'PermitDetails[]' },
    { name: 'spender', type: 'address' },
    { name: 'sigDeadline', type: 'uint256' }
  ],
  PermitDetails: [
    { name: 'token', type: 'address' },
    { name: 'amount', type: 'uint256' },
    { name: 'expiration', type: 'uint256' },
    { name: 'nonce', type: 'uint256' }
  ]
} as const;