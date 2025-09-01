# Uniswap V4 Hooks Contracts

Smart contracts for the Uniswap V4 Hooks Workshop demonstrating various hook implementations and patterns.

## Overview

This directory contains three example hooks that showcase different V4 capabilities:

- **LiquidityPenaltyHook**: JIT liquidity protection with time-based penalties
- **AntiSandwichHook**: MEV protection by fixing buy prices at block start
- **LimitOrderHook**: On-chain limit orders using single-tick liquidity

## Prerequisites

- **Foundry**: For smart contract compilation and deployment
- **TypeScript/Node.js**: For SDK scripts and frontend applications
- **Docker**: For running the indexer (PostgreSQL and Hasura)
- **Bun**: Package manager (recommended) or npm/yarn

## Key Concepts

- **Singleton Pattern**: All pools managed by a single PoolManager contract
- **Hook Permissions**: Address bits determine which callbacks hooks can use
- **Transient Storage**: EIP-1153 for gas-efficient temporary data
- **ERC-6909**: Multi-token standard for virtual balances

## Deployment

See the root README for deployment instructions. The main deployment script handles:
- Hook address mining for correct permission bits
- Pool creation with deployed hooks
- ABI synchronization for frontend apps

## Resources

- [Uniswap V4 Implementation Patterns Guide](../docs/uniswapv4tips.md) - Comprehensive patterns and best practices
- [Workshop Overview](../docs/overview.md) - Workshop structure and goals (Japanese)
- [Architecture Details](../docs/ARCHITECTURE.md) - System design documentation

## License

MIT