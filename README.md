# Uniswap V4 Workshop - EDCON 2025

This repository is a monorepo for the Uniswap V4 Hooks workshop. It includes smart contracts, V4 SDK integration, Indexer, and Dashboard.

## 🎯 Workshop Overview

In this workshop, you'll deploy and test Uniswap V4's innovative "Hooks" feature, experiencing the complete Hook development lifecycle (development → deployment → testing → analysis).

**Duration**: 35-55 minutes  
**Target Audience**: Developers with basic Solidity knowledge

## 🎯 Workshop Goals

This workshop will help you achieve:

1. Understanding how Uniswap V4 Hooks work
2. Experiencing proper address deployment using HookMiner
3. Mastering pool operations with V4 SDK
4. Verifying JIT attack prevention with LiquidityPenaltyHook
5. Learning analysis methods using Envio indexer

## 📅 Timetable

| Time      | Section             | Content                                                                 |
| --------- | ------------------- | ----------------------------------------------------------------------- |
| 0-5 min   | Environment Setup   | Clone repository, install dependencies, configure environment variables |
| 5-15 min  | Hook Deployment     | Deploy LiquidityPenaltyHook using HookMiner                             |
| 15-25 min | Pool Creation       | Create pool with deployed Hook                                          |
| 25-40 min | Hands-on Operations | Add/remove liquidity and swap using V4 SDK                              |
| 40-45 min | Analysis & Summary  | Check results with Indexer and Dashboard, Q&A                           |

📚 **Full Workshop Script**: See [workshop-50min-script.md](docs/workshop-50min-script.md) for a detailed 50-minute workshop guide with complete explanations and code examples.

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Blockchain (Unichain)                           │
│  ・Hooks (LiquidityPenaltyHook, etc.)                               │
│  ・PoolManager, PositionManager                                     │
│  ・Universal Router                                                 │
└─────────────────────┬──────────────┬────────────────────────────────┘
                      │              │
                      │              │
              Event Monitoring    Transaction Execution
                      │              │
                      ▼              ▼
┌─────────────────────────────┐  ┌───────────────────────────────────┐
│     INDEXER (Envio)         │  │      V4 SDK Scripts               │
│  http://localhost:8080      │  │  ・04-add-liquidity.ts            │
│  ・Event Collection          │  │  ・05-swap-universal-router.ts    │
│  ・Data Persistence          │  │  ・06-remove-liquidity.ts         │
│    (PostgreSQL)             │  │  ・check-pool-state.ts            │
│  ・GraphQL API               │  │                                  │
└──────────────┬──────────────┘  └─────────────────┬─────────────────┘
               │                                   │
               │ GraphQL API                       │ Operations
               │                                   │
               ▼                                   │
┌─────────────────────────────┐                    │
│      DASHBOARD APP          │                    │
│   http://localhost:3000     │                    │
│  ・Display Statistics       │                    │
│  ・TVL Analysis             │                    │
│  ・Hook Behavior            │                    │
│    Visualization            │                    │
└──────────────┬──────────────┘                    │
               │                                   │
               │ Read-only                         │
               ▼                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  Users                                              │
└─────────────────────────────────────────────────────────────────────┘
```

### 🔨 Foundry Deployment Flow

The smart contract deployment process uses Foundry's scripting capabilities:

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Developer Machine                            │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │                      Foundry Scripts                       │     │
│  │  01_DeployAndSave.s.sol → Deploy hooks with HookMiner      │     │
│  │  02_CreatePool.s.sol    → Create pools with deployed hooks │     │
│  │  03_ShowPoolInfo.s.sol  → Display deployment information   │     │
│  └──────────────────────┬─────────────────────────────────────┘     │
│                         │                                           │
│  ┌──────────────────────▼─────────────────────────────────────┐     │
│  │                   HookMiner                                │     │
│  │  ・Calculate deterministic addresses based on permissions  │     │
│  │  ・Find salt for CREATE2 deployment                        │     │
│  │  ・Encode hook flags in address (last 20 bits)             │     │
│  └──────────────────────┬─────────────────────────────────────┘     │
│                         │                                           │
│  ┌──────────────────────▼─────────────────────────────────────┐     │
│  │              CREATE2 Deployer                              │     │
│  │  ・Deploy hooks at calculated addresses                    │     │
│  │  ・Ensure permission bits match address                    │     │
│  │  ・Save deployment info to .env files                      │     │
│  └──────────────────────┬─────────────────────────────────────┘     │
└─────────────────────────┼───────────────────────────────────────────┘
                          │ Deploy & Initialize
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     Unichain Blockchain                             │
│  ・Deployed Hooks at deterministic addresses                        │
│  ・Initialized Pools with hook integration                          │
│  ・Ready for V4 SDK interaction                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Key Deployment Steps:**

1. **Environment Setup**

   ```bash
   cd contracts
   source .env
   export ETH_FROM=$(cast wallet address --private-key $PK)d
   ```

2. **Hook Deployment** (01_DeployAndSave.s.sol)

   - Uses HookMiner to calculate addresses
   - Deploys via CREATE2 for deterministic addresses
   - Saves addresses to `scripts/.deployment.env`

3. **Pool Creation** (02_CreatePool.s.sol)

   - Reads deployed hook addresses
   - Creates pools with proper hook integration
   - Saves pool info to `scripts/.pool.env`

4. **Verification** (03_ShowPoolInfo.s.sol)
   - Displays all deployment information
   - Confirms hook permissions and pool configuration

## 🪝 What are Uniswap V4 Hooks?

### V4's Innovative Architecture

Uniswap V4 adopts a "singleton" architecture where all pools are managed by a single PoolManager contract. This enables:

- **Improved Gas Efficiency**: Optimized multi-hop swaps between pools
- **Customizability**: Free extension of pool behavior through Hooks
- **Capital Efficiency**: Temporary borrowing via flash accounting

### Hook Features

Hooks are custom logic executed at specific points in a pool's lifecycle:

```
┌─────────────────┐
│   User Action   │
└────────┬────────┘
         │
    ┌────▼─────┐     ┌──────────────┐
    │ Pool     ├────►│ Hook Contract│
    │ Manager  │◄────┤ (Your Logic) │
    └──────────┘     └──────────────┘
```

**14 Extension Points**:

- `beforeInitialize` / `afterInitialize`
- `beforeAddLiquidity` / `afterAddLiquidity`
- `beforeRemoveLiquidity` / `afterRemoveLiquidity`
- `beforeSwap` / `afterSwap`
- `beforeDonate` / `afterDonate`
- Delta return flags (for fee and swap amount adjustments)

## 📦 Three Hooks Covered in the Workshop

### 1. LiquidityPenaltyHook - JIT Attack Prevention

**Problem**: Just-In-Time (JIT) Attacks

- Attackers add liquidity just before large swaps
- They immediately remove liquidity after capturing swap fees
- This steals revenue from long-term liquidity providers

**Solution**: Time-based Penalty

```solidity
penalty = fees * (1 - (currentBlock - lastAddedBlock) / blockNumberOffset)
```

Imposes penalties on early liquidity removal, decreasing over time (0% after 10 blocks).

### 2. AntiSandwichHook - MEV Protection

Prevents sandwich attacks by limiting price manipulation within blocks. Checkpoints prices at the start of each block and prevents trades at advantageous prices within the same block.

### 3. LimitOrderHook - Pseudo Limit Orders

Enables on-chain limit orders that automatically execute when specific prices are reached.

## 🚀 Quick Start

### 1. Setup Environment Variables

```bash
# Or manually create each .env file
cp contracts/.env.example contracts/.env
cp apps/indexer/.env.example apps/indexer/.env
```

**Required settings for contracts/.env**:

- `PK`: Private key for deployment (never commit this!)
- `ETHERSCAN_API_KEY`: For contract verification

**Required settings for apps/indexer/.env**:

- `ENVIO_API_TOKEN`: Envio API token (optional)
  - Not required for local development only
  - Required for production or when using the development console (https://envio.dev/console)
  - Create tokens at https://envio.dev/app/api-tokens

### 2. Install Dependencies

```bash
# Install using Bun
bun install
```

### 3. Setup and Start Indexer (First Time Only)

```bash
# Setup indexer
cd apps/indexer
pnpm install  # Indexer requires pnpm
bun run codegen
bun run dev
```

### 4. Start Dashboard

```bash
# In a new terminal, start Dashboard (http://localhost:3000)
cd apps/dashboard
pnpm install
bun run dev
```

**Note**:

- The indexer requires Docker Desktop to be running
- GraphQL endpoint will be available at http://localhost:8080/v1/graphql once the indexer is ready
- For subsequent runs, you can simply use `bun run dev` in the indexer directory

## 📁 Project Structure

```
uniswap-v4-workshop/
├── contracts/        # Uniswap V4 Hooks smart contracts
│   ├── src/         # Hook implementations (LiquidityPenaltyHook, etc.)
│   └── script/      # Deployment and operation scripts
├── scripts/         # V4 SDK integration scripts
│   ├── utils/       # Common utilities
│   ├── 04-add-liquidity.ts      # Add liquidity
│   ├── 05-swap-universal-router.ts # Execute swaps
│   └── 06-remove-liquidity.ts    # Remove liquidity
├── apps/
│   ├── indexer/     # Blockchain indexer (Envio)
│   └── dashboard/   # Analytics dashboard (Next.js)
├── deployments/     # Contract addresses by network
└── docs/           # Workshop documentation
```

## 🛠️ Available Commands

```bash
# Contract-related
bun run contracts:build       # Build contracts
bun run v4:deploy            # Deploy hooks with HookMiner
bun run v4:pool              # Create pool with deployed hook
bun run v4:info              # Show pool information

# V4 SDK operations
bun run v4:check             # Check pool state
bun run v4:add               # Add liquidity (create Position NFT)
bun run v4:swap              # Execute swap via Universal Router
bun run v4:remove            # Remove liquidity

# Application startup
bun run indexer          # Start indexer (requires Docker)
bun run dashboard            # Start dashboard
```

### Script Details

**Foundry Scripts**:

```solidity
// v4:deploy (01_DeployAndSave.s.sol) - Hook Deployment
- Deploy at proper address using HookMiner
- Deterministic address generation via CREATE2
- Save deployment results to .deployment.env

// v4:pool (02_CreatePool.s.sol) - Pool Creation
- Create pool using deployed Hook
- ETH/USDC pair, 0.3% fee setting
- Save pool information to .pool.env

// v4:info (03_ShowPoolInfo.s.sol) - Display Pool Information
- Display Hook address and enabled permissions
- Pool ID and current price
- Generate explorer links
```

**V4 SDK Scripts**:

```typescript
// v4:check (check-pool-state.ts) - Check Pool State
- Display current price, liquidity, and fees
- Verify Hook address and settings

// v4:add (04-add-liquidity.ts) - Add Liquidity
- Create Position NFT
- Gasless approval via Permit2
- Provide liquidity to specified price range

// v4:swap (05-swap-universal-router.ts) - Execute Swap
- Quote via V4 Quoter (revert data processing)
- Build actions with V4Planner
- Execute via Universal Router

// v4:remove (06-remove-liquidity.ts) - Remove Liquidity
- Withdraw liquidity from Position NFT
- Handle LiquidityPenaltyHook penalties
- Support partial or complete removal
```

## 🔧 Hook-Specific Deployment Process

The most unique aspect of V4 Hooks is that **permission information is encoded in the address itself**:

```
Hook Address: 0x0050E651C7b8662f4E17C589B6387db8f7488503
                                                    ^^^^
         Lowest bits (right side) represent permissions
```

Example: Lowest 14 bits of `0x...8503`

- Binary: `1000 0101 0000 0011`
- This indicates the following permissions:
  - bit 0 (0x1): AFTER_REMOVE_LIQUIDITY_RETURNS_DELTA
  - bit 1 (0x2): AFTER_ADD_LIQUIDITY_RETURNS_DELTA
  - bit 8 (0x100): AFTER_REMOVE_LIQUIDITY
  - bit 10 (0x400): AFTER_ADD_LIQUIDITY

### How HookMiner Works

1. **Permission Declaration**:

```solidity
function getHookPermissions() public pure returns (Hooks.Permissions memory) {
    return Hooks.Permissions({
        afterAddLiquidity: true,
        afterRemoveLiquidity: true,
        afterAddLiquidityReturnDelta: true,
        afterRemoveLiquidityReturnDelta: true,
        // ... all others false
    });
}
```

2. **Address Calculation**:

```solidity
// HookMiner finds the proper address using CREATE2
uint160 flags = Hooks.AFTER_ADD_LIQUIDITY_FLAG |
                Hooks.AFTER_REMOVE_LIQUIDITY_FLAG | ...;

(address hookAddress, bytes32 salt) = HookMiner.find(
    CREATE2_DEPLOYER,
    flags,
    bytecode,
    constructorArgs
);
```

3. **Validation**: Permissions are validated with validateHookAddress().

## 📊 Indexing with Envio

### Event Processing Flow

```
PoolManager → Event Emitted → Envio Indexer → PostgreSQL → GraphQL → Dashboard
```

### Key Events Tracked

1. **Initialize**: Pool creation (including Hook address)
2. **Swap**: Trade execution and Hook intervention
3. **ModifyLiquidity**: LP operations and penalty application
4. **Donate**: Fee donations

## 📚 Documentation

- [Workshop 45min Guide (日本語)](./docs/japanese/workshop-45min.md) - Complete workshop guide
- [Architecture Details](./docs/ARCHITECTURE.md)
- [Contracts README](./contracts/README.md)

## 🏆 Uniswap Related Grant

After completing the workshop, consider applying for the Unichain Hook Grant!

### Grant Overview

- **Organizers**: Uniswap Foundation & Atrium
- **Target**: Innovative Hooks running on Unichain
- **Categories**: DeFi Innovation, Liquidity Optimization, MEV Protection, New AMM Designs
- [Grants Info](https://www.uniswapfoundation.org/grants)

## 📚 Workshop Documentation

- [**Workshop 50-minute Script**](docs/workshop-50min-script.md) - Complete workshop guide with detailed explanations and code examples
- [Workshop Overview (Japanese)](docs/overview.md) - Workshop goals and structure in Japanese
- [Uniswap V4 Implementation Patterns](docs/uniswapv4tips.md) - Comprehensive patterns and best practices

## 🔗 Related Links

- [Uniswap V4 Documentation](https://docs.uniswap.org/contracts/v4/overview)
- [V4 SDK Documentation](https://docs.uniswap.org/sdk/v4/overview)
- [V4 Core Repository](https://github.com/Uniswap/v4-core)
- [OpenZeppelin Hooks](https://github.com/OpenZeppelin/uniswap-hooks)
- [Hooks Audit Report](https://blog.openzeppelin.com/openzeppelin-uniswap-hooks-v1.1.0-rc-1-audit)
- [Hook Data Standards Guide](https://www.uniswapfoundation.org/blog/developer-guide-establishing-hook-data-standards-for-uniswap-v4)
- [Unichain Documentation](https://docs.unichain.org)
- [Envio HyperSync Documentation](https://docs.envio.dev/docs/HyperSync/overview)
- [Envio Uniswap V3 Analytics](https://github.com/enviodev/uniswap-v3-analytics)
- [Envio Uniswap V4 Indexer](https://github.com/enviodev/uniswap-v4-indexer)
- [Japanese Community](https://t.me/uniswapjp)
- [Uniswap V4 Dojo](https://t.me/c/1793969856/1)

---

**Building the Future of DeFi with Uniswap V4**
