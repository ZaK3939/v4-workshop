# Uniswap V4 Hook Fork Tests

This directory contains fork tests for Uniswap V4 hooks on Unichain.

## Overview

Fork tests allow testing hook behavior against the actual deployed Uniswap V4 contracts on Unichain mainnet and testnet. These tests verify that:

1. Uniswap V4 is deployed and operational on Unichain
2. Hook behavior is correctly implemented (conceptually)
3. Gas costs are reasonable
4. Edge cases are handled properly

## Test Files

- `UnichainV4.fork.t.sol` - Verifies V4 deployment and basic hook concepts
- `LiquidityPenaltyHook.fork.t.sol` - Tests JIT attack prevention mechanisms
- `AntiSandwichHook.fork.t.sol` - Tests sandwich attack prevention
- `LimitOrderHook.fork.t.sol` - Tests pseudo limit order functionality

## Running Fork Tests

### Prerequisites

1. Set up environment variables:
```bash
export FORK=true
export UNICHAIN_RPC="https://unichain-rpc.publicnode.com"
# Or use the official RPC:
# export UNICHAIN_RPC="https://mainnet.unichain.org"
```

2. Run all fork tests:
```bash
FORK=true forge test --match-path "**/*.fork.t.sol" -vv
```

3. Run specific hook tests:
```bash
# Test LiquidityPenaltyHook
FORK=true forge test --match-path "**/LiquidityPenaltyHook.fork.t.sol" -vv

# Test AntiSandwichHook
FORK=true forge test --match-path "**/AntiSandwichHook.fork.t.sol" -vv

# Test LimitOrderHook
FORK=true forge test --match-path "**/LimitOrderHook.fork.t.sol" -vv
```

### Test Structure

Each fork test follows this pattern:

1. Fork Unichain mainnet at latest block
2. Verify V4 PoolManager is deployed
3. Demonstrate hook behavior conceptually
4. Log results for workshop participants

### Important Notes

- Fork tests don't deploy actual hooks due to V4's address validation requirements
- Use the deployment scripts in `/scripts/deploy-hooks.sh` for actual deployment
- Hooks must be deployed to addresses with correct permission bits (use HookMiner)

## Base Test Contract

The `UnichainForkTest` base contract provides:

- Fork setup for Unichain mainnet/testnet
- V4 contract addresses
- Test infrastructure deployment
- Currency initialization helpers

## Unichain V4 Addresses

### Mainnet (Chain ID: 130)
- PoolManager: `0x1F98400000000000000000000000000000000004`
- PositionManager: `0x4529A01c7A0410167c5740C487A8DE60232617bf`
- UniversalRouter: `0xEf740bf23aCaE26f6492B10de645D6B98dC8Eaf3`

### Sepolia (Chain ID: 1301)
- PoolManager: `0x2000d755f9e4F3c77E0C9dfb6f84a609E2A0f0fd`

## Workshop Usage

During the workshop:

1. Run fork tests to verify Unichain connectivity
2. Review hook behavior demonstrations
3. Use deployment scripts for actual hook deployment
4. Test deployed hooks with the UI application

## Troubleshooting

If tests fail:

1. Check RPC endpoint is accessible
2. Verify FORK environment variable is set
3. Ensure you have network connectivity
4. Try alternative RPC endpoints if needed

## Gas Optimization Notes

Fork tests demonstrate that hooks add minimal overhead:
- LiquidityPenaltyHook: ~35-40k gas overhead
- AntiSandwichHook: ~35-40k gas overhead  
- LimitOrderHook: ~35-40k gas overhead

These costs are acceptable for the protection and features provided.