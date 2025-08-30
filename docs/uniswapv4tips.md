# Uniswap v4 Hooks Implementation Patterns Complete Guide

## Security Patterns ★★★

### 1. onlyPoolManager Modifier: The Most Critical Access Control ★★★

#### Background and Problem

If anyone can call hook functions, it creates risks of state inconsistencies and fund theft. Malicious actors could manipulate the hook's state or drain funds by calling sensitive functions directly.

#### Solution Approach

Use the `onlyPoolManager` modifier to allow calls only from the PoolManager contract. This ensures that hook functions are called in the correct context and sequence.

#### Implementation Points

- Check `msg.sender` against the PoolManager address
- Apply to all hook callback functions
- Use custom errors for clear failure notifications
- No exceptions - even internal helper functions that modify state should be protected

#### Related Code

- [`contracts/src/base/BaseHook.sol`](../contracts/src/base/BaseHook.sol#L66-L69)
  - L66-69: Modifier definition with custom error
  - L109: Usage example in beforeInitialize
- [`contracts/src/LimitOrderHook.sol`](../contracts/src/LimitOrderHook.sol#L420)
  - L420: Required usage in unlockCallback

### 2. Cross-Pool State Isolation: Essential Pattern for Multi-Pool Hooks ★★★

#### Background and Problem

When a single hook is used by multiple pools, mixed states can cause serious bugs or security vulnerabilities. A malicious pool could potentially manipulate or access another pool's data.

#### Solution Approach

Use double mapping structure with PoolId as the primary key. This creates complete isolation between each pool's state, preventing any cross-contamination.

#### Implementation Points

- `mapping(PoolId => mapping(...))` pattern ens
- No data can leak between pools
- Minimal gas cost increase (one additional SLOAD)
- Consider using structs to group related pool data

#### Related Code

- [`contracts/src/LiquidityPenaltyHook.sol`](../contracts/src/LiquidityPenaltyHook.sol#L79)
  - L79: `_lastAddedLiquidityBlock` - Per-pool block numbers
  - L84: `_withheldFees` - Per-pool withheld fees

### 3. Tick Iteration DoS Risk ★★★

#### Background and Problem

During large price movements, iterating through all affected ticks can consume unlimited gas. In pools with 1-tick spacing, a 10% price movement could require iterating through thousands of ticks, causing out-of-gas errors or enabling DoS attacks.

#### Solution Approach

Implement iteration limits and consider alternative data structures. The current implementation lacks these protections, serving as a cautionary example.

#### Implementation Points

- Different loop directions for price increases/decreases
- Need for maximum tick count limits (e.g., MAX_TICKS = 1000)
- Consider using events or off-chain indexing for large ranges
- Memory usage optimization to prevent stack too deep errors

#### Related Code

- [`contracts/src/AntiSandwichHook.sol`](../contracts/src/AntiSandwichHook.sol#L99-L117)
  - L99-117: Tick iteration - Example of DoS vulnerability
  - No upper bound on iterations in current implementation

### 4. Zero Liquidity Checks: Often Overlooked but Critical Validation ★★☆

#### Background and Problem

Operations with zero liquidity lead to division by zero errors, invalid transactions, and potential DoS attack vectors. Users might waste gas on failed transactions, or attackers might intentionally trigger these conditions.

#### Solution Approach

Always check for zero before operations. Use appropriate custom errors to notify users clearly about the specific issue.

#### Implementation Points

- Consistent checks across multiple locations
- Specific error messages for different zero conditions
- Early validation to prevent gas waste
- Consider whether zero should revert or return early

#### Related Code

- [`contracts/src/LiquidityPenaltyHook.sol`](../contracts/src/LiquidityPenaltyHook.sol#L164)
  - L164: Pool liquidity zero check before donation
  - L64: `NoLiquidityToReceiveDonation` custom error
- [`contracts/src/LimitOrderHook.sol`](../contracts/src/LimitOrderHook.sol#L247)
  - L247, L336, L401: Zero checks in each operation

### 5. Unlock Pattern: Safe Callback-Based Execution ★★☆

#### Background and Problem

Complex interactions with PoolManager need to be executed safely and atomically. Direct calls could leave the pool in an inconsistent state if transactions partially fail.

#### Solution Approach

Use `poolManager.unlock` to release the lock, process within callback, then automatically re-lock on completion. This ensures all operations complete atomically or revert entirely.

#### Implementation Points

- Specify operation type with CallbackData structure
- Type-safe return value handling with abi.decode
- Atomicity guarantee - all or nothing execution
- Reentrancy protection built into the pattern

#### Related Code

- [`contracts/src/LimitOrderHook.sol`](../contracts/src/LimitOrderHook.sol#L292-L301)
  - L292-301: Unlock usage in placeOrder with return value decoding
  - L420-428: Branching logic in unlockCallback

## JIT/MEV Protection Patterns ★★★

### 6. JIT Attack Defense in Uniswap v4: Innovative Time-Based Penalty Approach ★★★

#### Background and Problem

JIT (Just-in-Time) attacks involve adding liquidity immediately before large swaps to capture fees, then withdrawing immediately after. This parasitic behavior steals revenue from long-term liquidity providers who take on more risk and damages the DEX ecosystem's sustainability.

#### Solution Approach

Implement a time-based penalty system. Apply a linearly decaying penalty to fees when liquidity is removed within a specified period (`blockNumberOffset`) after addition. The penalty starts at 100% and decays to 0% over the protection period.

#### Implementation Points

- Temporary fee withholding mechanism stores fees in the hook
- Linear decay function: `penalty = fees * (1 - elapsedBlocks / offset)`
- Penalties are donated to current in-range LPs, benefiting long-term providers
- Typical offset values: 10-100 blocks (2-20 minutes on Ethereum)

#### Related Code

- [`contracts/src/LiquidityPenaltyHook.sol`](../contracts/src/LiquidityPenaltyHook.sol#L234-L251)
  - L234-251: `_calculateLiquidityPenalty` - Linear decay penalty calculation with overflow protection
  - L100-122: `_afterAddLiquidity` - Fee withholding during JIT protection period
  - L136-180: `_afterRemoveLiquidity` - Penalty application and donation logic

### 7. Asymmetric MEV Prevention Design: Why Protect Only Buy Direction ★★★

#### Background and Problem

In sandwich attacks, attackers trade before and after victims to extract value. The typical pattern is: attacker buys (pushes price up) → victim buys (at inflated price) → attacker sells (captures profit). However, protecting all directions impairs legitimate price discovery.

#### Solution Approach

Fix only buy direction (!zeroForOne) at beginning-of-block price while sell direction uses normal xy=k curve. This breaks the sandwich attack economics while maintaining some price discovery. Note: The code comment incorrectly states zeroForOne is protected, but implementation protects !zeroForOne.

#### Implementation Points

- Save complete pool state on first swap of each block
- Apply fixed price only to buy direction (token1 → token0)
- Calculate difference between market and fixed price
- Donate differences to pool LPs as compensation

#### Related Code

- [`contracts/src/AntiSandwichHook.sol`](../contracts/src/AntiSandwichHook.sol#L147-L171)
  - L147-171: `_getTargetUnspecified` - Direction-based processing branch
  - L154-164: `Pool.swap` - Simulation with beginning-of-block state
- [`contracts/src/AntiSandwichHookImpl.sol`](../contracts/src/AntiSandwichHookImpl.sol#L12-L22)
  - L12-22: `_afterSwapHandler` - Fee collection handling

## State Management Patterns ★★★

### 8. Transient Storage (EIP-1153) Revolution in DeFi ★★★

#### Background and Problem

Regular storage has high gas costs (SSTORE: 20,000 gas). Storing temporary data needed only within transactions is inefficient and expensive. Additionally, persistent storage creates reentrancy risks and requires explicit cleanup.

#### Solution Approach

Utilize EIP-1153's Transient Storage (TSTORE/TLOAD). Data is automatically cleared at transaction end with significantly reduced gas costs (~100 gas). This provides natural reentrancy protection and eliminates state pollution risks.

#### Implementation Points

- State passing between beforeSwap→afterSwap without persistent storage
- Immediate reset prevents state pollution between swaps
- Natural resistance to reentrancy attacks
- No need for explicit cleanup in modifiers or try/catch blocks

#### Related Code

- [`contracts/src/fee/BaseDynamicAfterFee.sol`](../contracts/src/fee/BaseDynamicAfterFee.sol#L63-L86)
  - L63-86: `_transientTargetUnspecifiedAmount` - Read/write helper functions
  - L98-111: `_beforeSwap` - Temporary storage of target values
  - L133-144: `_afterSwap` - Immediate reset pattern for safety

### 9. Position.calculatePositionKey: Collision-Free Position Management ★★☆

#### Background and Problem

Need to distinguish different users' positions or same user's multiple positions in the same tick range. Simple concatenation could lead to collisions or require complex string manipulation.

#### Solution Approach

Hash 4 parameters (sender, tickLower, tickUpper, salt) with keccak256. This creates a deterministic, collision-resistant 32-byte identifier. Collision probability is effectively zero (2^256 possible values).

#### Implementation Points

- Deterministic calculation enables off-chain computation
- Salt parameter allows multiple positions per user in same range
- Fixed 32-byte key length for consistent gas costs
- Order of parameters matters for consistency

#### Related Code

- [`contracts/src/LiquidityPenaltyHook.sol`](../contracts/src/LiquidityPenaltyHook.sol#L109)
  - L109: Key calculation on liquidity addition
  - L145: Same key used for liquidity removal
  - Salt parameter provides flexibility for position management

### 10. Efficient Slot0 Packing: Design Philosophy in 256 Bits ★★☆

#### Background and Problem

Storing pool's main state variables separately requires multiple SLOADs (3,000 gas each). Accessing price, tick, and fees individually would cost 12,000 gas minimum.

#### Solution Approach

Pack 4 critical values into one 256-bit slot. Retrieve all information with single SLOAD (3,000 gas). Careful bit allocation ensures no precision loss.

#### Implementation Points

- sqrtPriceX96: 160 bits - Square root of price in Q64.96 format
- tick: 24 bits - Current tick (supports ±8 million range)
- protocolFee: 24 bits - Protocol fee in hundredths of basis points
- lpFee: 24 bits - LP fee with same precision
- 24 bits unused for future extensions

#### Related Code

- [`contracts/src/AntiSandwichHook.sol`](../contracts/src/AntiSandwichHook.sol#L94)
  - L94: `Slot0.wrap(poolManager.extsload(...))` - Direct storage reading
  - L119-120: `poolManager.getFeeGrowthGlobals` - Additional state retrieval

## Type Safety Patterns ★★☆

### 11. OrderIdLibrary: Type Safety with Custom Types ★★☆

#### Background and Problem

Using uint256 directly risks confusing IDs for different purposes. A function expecting an OrderId might accidentally receive a PoolId, causing silent failures. Compile-time type checking doesn't help with primitive types.

#### Solution Approach

Utilize Solidity 0.8.8's custom type feature. Define `type OrderId is uint232` for strong typing. This creates compile-time guarantees without runtime overhead.

#### Implementation Points

- Explicit type conversion required (wrap/unwrap) prevents accidents
- Type confusion bugs caught at compile time
- Zero runtime gas cost - purely compile-time feature
- Can add type-specific methods like `equals` or `increment`

#### Related Code

- [`contracts/src/LimitOrderHook.sol`](../contracts/src/LimitOrderHook.sol#L24-L42)
  - L24-42: `OrderIdLibrary` - Custom type definition
  - L32-34: `equals` - Type-safe comparison function
  - L37-41: `unsafeIncrement` - Overflow-tolerant increment with unchecked

### 12. SafeCast: Secure Type Conversions ★★☆

#### Background and Problem

Type conversion overflow/underflow causes unexpected behavior or security vulnerabilities. Converting int256(-1) to uint256 yields 2^256-1, not an error. Silent failures make debugging difficult.

#### Solution Approach

SafeCast library verifies values fit during conversion. Reverts with clear errors on overflow/underflow. Provides explicit, safe conversion methods for all common cases.

#### Implementation Points

- Shrinking conversions like uint256→uint128 check upper bits
- Sign conversions like int→uint check for negative values
- Explicit error handling with descriptive revert reasons
- Gas overhead is minimal compared to potential bug costs

#### Related Code

- [`contracts/src/LiquidityPenaltyHook.sol`](../contracts/src/LiquidityPenaltyHook.sol#L244)
  - L244: `SafeCast.toUint128` - Fee amount conversion with overflow check
  - L54: Using declaration - `using SafeCast for uint256`

### 13. BalanceDelta Elegance: Dual-Token Management Pattern ★☆☆

#### Background and Problem

DEXs always handle two tokens simultaneously. Managing them separately leads to verbose code, repeated logic, and increased chance of errors. Need to ensure amounts for both tokens are handled consistently.

#### Solution Approach

BalanceDelta type manages two token deltas in one struct. Operator overloading enables intuitive operations. This ensures both token amounts are always handled together.

#### Implementation Points

- Natural notation for addition/subtraction operations
- Concise sign reversal implementation
- Easy decomposition to amount0/amount1 when needed
- Prevents accidentally forgetting to handle one token

#### Related Code

- [`contracts/src/LiquidityPenaltyHook.sol`](../contracts/src/LiquidityPenaltyHook.sol#L151)
  - L151: `totalFees = feeDelta + withheldFees` - Natural addition
  - L170: `liquidityPenalty - withheldFees` - Subtraction operation
  - L175: `toBalanceDelta(-amount0, -amount1)` - Sign reversal

## Token Handling Patterns ★★☆

### 14. CurrencySettler Pattern: Safe Token Settlement Implementation ★★☆

#### Background and Problem

Token transfers require different handling for ERC20, native tokens, and ERC-6909. Each has unique interfaces and edge cases. Need unified interface to prevent errors and reduce code duplication.

#### Solution Approach

CurrencySettler library provides abstraction through `take` (receive) and `settle` (pay) operations. Handles all token types with consistent interface while respecting their unique requirements.

#### Implementation Points

- Native token handling with msg.value and sync
- ERC-6909 burn/mint support for virtual balances
- Early return for zero amounts (some tokens revert on zero transfer)
- Distinguish between transfers from hook vs external addresses

#### Related Code

- [`contracts/src/utils/CurrencySettler.sol`](../contracts/src/utils/CurrencySettler.sol#L31-L51)
  - L31-51: `settle` - Unified payment implementation
  - L39-42: Native token special handling with sync
  - L61-68: `take` - Unified receive implementation

### 15. ERC-6909: Managing Without Holding Real Tokens ★★☆

#### Background and Problem

Hooks holding large token amounts create security risks - they become honeypots for attackers. However, temporary custody is necessary for limit orders, fee collection, and other features.

#### Solution Approach

Use ERC-6909 (multi-token standard) for virtual accounting. PoolManager tracks virtual token ownership while hooks never hold actual tokens. Real transfers only occur on final settlement.

#### Implementation Points

- `mint` for virtual issuance, `burn` for virtual burning
- Actual token movement only on final `take` operation
- Gas-efficient batch management of multiple tokens
- Eliminates approval requirements between hook and PoolManager

#### Related Code

- [`contracts/src/LimitOrderHook.sol`](../contracts/src/LimitOrderHook.sol#L470-L478)
  - L470-478: Mint on order fill - virtual token issuance
  - L434-444: Burn→take on withdrawal - virtual to real conversion
  - L436-438: Fee mint on cancel - retaining fees virtually

### 16. Donate Function: Distributing Rewards to LPs Without Price Impact ★☆☆

#### Background and Problem

Need to fairly distribute collected fees (from MEV prevention or penalties) to LPs. Adding liquidity would change pool price. Direct transfers would require tracking individual LP shares.

#### Solution Approach

Use `poolManager.donate` to donate tokens to pool. Automatically distributes proportionally to existing LP shares based on their liquidity. No price impact as no liquidity is added.

#### Implementation Points

- Only LPs currently in range receive donations
- Reverts if pool has zero liquidity (no recipients)
- Can specify amount0/amount1 independently
- Updates fee growth globals for fair distribution

#### Related Code

- [`contracts/src/LiquidityPenaltyHook.sol`](../contracts/src/LiquidityPenaltyHook.sol#L166-L168)
  - L166-168: `poolManager.donate` - Penalty donation to LPs
  - L164: Liquidity check - Ensure donation recipients exist

## Advanced Implementation Patterns ★★☆

### 17. Implementing Limit Orders on DEX: Leveraging Single-Tick Liquidity ★★★

#### Background and Problem

Traditional AMMs don't support limit orders - users can only trade at market price. Need CEX-like trading experience on DEX without centralized order matching or off-chain components.

#### Solution Approach

Utilize Uniswap v4's out-of-range liquidity characteristics. Place liquidity in single-tick ranges (minimum width) to guarantee execution at specific price. The pool's price discovery mechanism becomes the order matching engine.

#### Implementation Points

- Single tick-width liquidity only (e.g., tick 1000 to 1010)
- One-sided token deposits: sell orders deposit token0, buy orders deposit token1
- Automatic execution when price crosses the tick - no keeper needed
- Multiple users' orders aggregate into single tick for gas efficiency

#### Related Code

- [`contracts/src/LimitOrderHook.sol`](../contracts/src/LimitOrderHook.sol#L477-L516)
  - L477-516: `_handlePlaceCallback` - Adding single-tick liquidity
  - L557-594: `_fillOrder` - Automatic execution on price crossing
  - L246-315: `placeOrder` - User-facing order creation interface

### 18. Pool.swap Simulation: Calculate Results Without Changing State ★★☆

#### Background and Problem

AntiSandwichHook needs to know trading results at beginning-of-block price without modifying the actual pool. Need accurate price calculations for determining fees or protective measures.

#### Solution Approach

Use saved checkpoint state with `Pool.swap` library function to calculate theoretical values. Execute as pure function on memory state, leaving actual pool unchanged.

#### Implementation Points

- Calculate entirely in memory state
- No modifications to actual pool storage
- Accurate price and fee calculations
- Can simulate multiple scenarios efficiently

#### Related Code

- [`contracts/src/AntiSandwichHook.sol`](../contracts/src/AntiSandwichHook.sol#L154-L164)
  - L154-164: `Pool.swap` - Simulation with checkpoint state
  - L87: `_lastCheckpoint.state` - Using saved state structure

### 19. Fee and Principal Separation: Protecting LP Fairness ★★☆

#### Background and Problem

In limit orders, users canceling orders might steal fees earned by others. If fees aren't properly tracked, a user could place and quickly cancel orders to skim accumulated fees.

#### Solution Approach

Distribute fees to remaining order placers on cancel. Only the last canceler receives fees too. Track checkpoints to ensure users only receive fees earned after their participation.

#### Implementation Points

- `removingAllLiquidity` flag determines fee distribution
- Fee minting process separates fees from principal
- principalDelta calculation method switches based on context
- Checkpoint system prevents fee skimming attacks

#### Related Code

- [`contracts/src/LimitOrderHook.sol`](../contracts/src/LimitOrderHook.sol#L532-L550)
  - L532-550: Fee distribution logic with conditional routing
  - L541-545: Fee mint for remaining order placers
  - L547-549: Last order receives all remaining fees

## Gas Optimization Patterns ★★☆

### 20. Proper Use of unchecked Blocks: Safe Gas Optimization ★★☆

#### Background and Problem

Since Solidity 0.8, arithmetic operations have automatic overflow checks, increasing gas costs by ~35 gas per operation. These checks are wasteful when overflow is impossible due to prior validations.

#### Solution Approach

When overflow is provably impossible, use `unchecked` blocks to skip redundant checks. Always document why overflow cannot occur with inline comments.

#### Implementation Points

- Mandatory precondition verification before unchecked block
- Document safety rationale in comments for auditors
- 20-30% gas savings on arithmetic operations
- Never use for user inputs or unpredictable values

#### Related Code

- [`contracts/src/LiquidityPenaltyHook.sol`](../contracts/src/LiquidityPenaltyHook.sol#L253-L263)
  - L253-263: `_calculateLiquidityPenalty` - Calculation with verified preconditions
  - L157: Precondition - `current - last < offset` guarantee prevents overflow

### 21. Early Return Pattern: Basic Gas Optimization ★☆☆

#### Background and Problem

Continuing processing when conditions aren't met wastes gas on unnecessary computation and storage reads. Deep nesting also makes code harder to audit.

#### Solution Approach

Check conditions early and skip unnecessary processing. Order checks from cheapest to most expensive. This saves gas and improves code readability.

#### Implementation Points

- Perform cheapest checks first (e.g., boolean flags before storage reads)
- End processing with early return
- Reduce nesting depth for better readability
- Consider gas refunds from storage cleanup

#### Related Code

- [`contracts/src/fee/BaseDynamicAfterFee.sol`](../contracts/src/fee/BaseDynamicAfterFee.sol#L139-L141)
  - L139-141: applyTarget check before expensive operations
- [`contracts/src/utils/CurrencySettler.sol`](../contracts/src/utils/CurrencySettler.sol#L33)
  - L33, L65: Early return for amount=0 cases

### 22. Error Design Philosophy: From revert Messages to Custom Errors ★☆☆

#### Background and Problem

`require(condition, "Error message")` stores strings on-chain, costing significant gas for deployment (~200 gas per character). Error types are also unclear and can't carry additional data.

#### Solution Approach

Define specific error types with custom errors. These compile to 4-byte selectors and can include parameters for debugging. Saves gas while improving error handling.

#### Implementation Points

- Only 4-byte selector stored on-chain
- Type-safe error handling in try/catch blocks
- ~2,000 gas savings per revert
- Can include relevant values for debugging

#### Related Code

- [`contracts/src/LiquidityPenaltyHook.sol`](../contracts/src/LiquidityPenaltyHook.sol#L56-L64)
  - L56-64: Error definitions with descriptive names
  - L90, L164: Usage examples with specific contexts
- [`contracts/src/LimitOrderHook.sol`](../contracts/src/LimitOrderHook.sol#L151-L163)
  - L151-163: Five different error types for different failure modes

## Utility Patterns ★★☆

### 23. Hook Address Mining: Creative Use of CREATE2 ★★☆

#### Background and Problem

In Uniswap v4, hook permissions (which callbacks can be used) are determined by the lower 14 bits of the contract address. Need to find addresses with specific bit patterns before deployment.

#### Solution Approach

Utilize CREATE2's deterministic address generation. Brute-force salt values to find addresses with required bit patterns. Pre-calculate addresses before deployment.

#### Implementation Points

- Maximum 160,000 iterations to find suitable salt
- Calculate addresses before deployment for gas estimation
- Balance between search time and deployment flexibility
- Can target specific permission combinations

#### Related Code

- [`contracts/src/utils/HookMiner.sol`](../contracts/src/utils/HookMiner.sol#L23-L41)
  - L23-41: `find` - Salt brute-force implementation
  - L35-38: Bitmask check - 14-bit permission verification
  - L48-56: `computeAddress` - CREATE2 address formula

### 24. StateLibrary: Efficient Pool State Access ★☆☆

#### Background and Problem

Accessing various pool state variables through individual getter functions is inefficient. Multiple external calls increase gas costs and latency.

#### Solution Approach

StateLibrary provides abstraction for low-level access. Can read storage slots directly when multiple values are needed. Maintains type safety while improving efficiency.

#### Implementation Points

- Calculate slots with `_getPoolStateSlot`
- Direct read with `extsload` for raw data
- Maintain type safety with proper casting
- Batch related reads when possible

#### Related Code

- [`contracts/src/AntiSandwichHook.sol`](../contracts/src/AntiSandwichHook.sol#L94)
  - L94: Direct Slot0 reading for efficiency
  - L121: Liquidity retrieval using library
- [`contracts/src/LimitOrderHook.sol`](../contracts/src/LimitOrderHook.sol#L665)
  - L665: `getSlot0` usage example

### 25. Actions Constants: Standardizing Multicall Operations ★☆☆

#### Background and Problem

Need to execute multiple operations in one transaction for better UX and gas efficiency. Operation types need unified management across different contracts.

#### Solution Approach

Actions constants define all operations numerically. Routers interpret these constants to execute corresponding operations. Enables flexible operation composition.

#### Implementation Points

- Numerical operation identification for gas efficiency
- Extensible design for future operations
- Gas-efficient dispatch with single byte comparison
- Consistent across all periphery contracts

#### Related Code

- [`contracts/src/libraries/Actions.sol`](../contracts/src/libraries/Actions.sol#L10-L42)
  - L10-19: Liquidity operations
  - L21-25: Swap operations
  - L29-42: Settlement operations

## Special Implementation Patterns ★☆☆

### 26. Tick Rounding Pitfalls: Special Handling for Negative Numbers ★★☆

#### Background and Problem

Ticks represent price range boundaries. Incorrect rounding of negative ticks causes invalid ranges or price calculation errors. Standard division rounds toward zero, but tick math requires rounding toward negative infinity.

#### Solution Approach

For negative ticks, round toward negative infinity (smaller values). Regular division rounds toward zero, requiring special adjustment for negative remainders.

#### Implementation Points

- Check `tick % tickSpacing != 0` for remainder
- Subtract 1 from compressed value for negative remainders
- Ensures price consistency across positive and negative ranges
- Critical for limit order and range position calculations

#### Related Code

- [`contracts/src/LimitOrderHook.sol`](../contracts/src/LimitOrderHook.sol#L727-L732)
  - L727-732: `getTickLower` - Negative tick handling
  - L730: Conditional check - If negative and not divisible

### 27. FullMath Library: Essential Precision Calculations for DeFi ★★☆

#### Background and Problem

In `a * b / c` calculations, `a * b` might overflow uint256 even when final result fits. Example: calculating fee shares where intermediate multiplication exceeds 2^256.

#### Solution Approach

FullMath.mulDiv uses 512-bit intermediate values internally. Prevents overflow while maintaining precision. Based on Remco Bloemen's implementation.

#### Implementation Points

- Handles multiplication internally with 512-bit precision
- Performs division in same operation for accuracy
- Balances gas efficiency with mathematical correctness
- Critical for fee calculations and price conversions

#### Related Code

- [`contracts/src/LiquidityPenaltyHook.sol`](../contracts/src/LiquidityPenaltyHook.sol#L254-L258)
  - L254-258: Usage in penalty calculation
  - Numerator: `feeDelta * (offset - elapsed)`
  - Denominator: `offset`

### 28. TickMath: Price and Tick Conversions ★☆☆

#### Background and Problem

Uniswap v4 represents prices as ticks (powers of 1.0001). Frequent conversion between sqrtPriceX96 format and ticks needed. Naive implementation would be gas-expensive.

#### Solution Approach

TickMath library provides optimized conversion using bit manipulation and precomputed constants. Logarithm calculations optimized for EVM.

#### Implementation Points

- `getTickAtSqrtPrice`: price→tick using binary search
- `getSqrtPriceAtTick`: tick→price using bit shifts
- MIN_TICK/MAX_TICK boundary validation
- Gas-optimized for common price ranges

#### Related Code

- [`contracts/src/LimitOrderHook.sol`](../contracts/src/LimitOrderHook.sol#L746-L749)
  - L746-749: Usage in `getTick` function
  - Calculate current tick from sqrt price

### 29. exactInput vs exactOutput: Asymmetric Fee Application Logic ★☆☆

#### Background and Problem

Swaps have two types: "specify input amount" and "specify output amount", requiring different fee application methods to preserve user's specified amount.

#### Solution Approach

Uniswap v4 uses `amountSpecified` sign to distinguish swap types:

- **Negative value (< 0)**: exactInput - specifying input amount (e.g., "sell 1 ETH")
- **Positive value (> 0)**: exactOutput - specifying output amount (e.g., "buy 1000 USDC")

Fees are always applied to the "unspecified" side:

- exactInput: Fees reduce output amount
- exactOutput: Fees increase input amount

#### Implementation Points

```solidity
// Determine swap type from sign
bool exactInput = params.amountSpecified < 0;

// Identify unspecified currency
// zeroForOne: token0→token1 swap direction
// amountSpecified < 0: exactInput (input specified)
// When both are true/false together, token1 is unspecified (output)
(Currency unspecified, int128 unspecifiedAmount) =
    (params.amountSpecified < 0 == params.zeroForOne)
    ? (key.currency1, delta.amount1())  // token1 is unspecified
    : (key.currency0, delta.amount0()); // token0 is unspecified
```

#### Concrete examples:

- **exactInput + zeroForOne (ETH→USDC, sell 1 ETH)**

  - `amountSpecified = -1e18` (negative)
  - `zeroForOne = true`
  - unspecified = USDC (output side)
  - Fees reduce USDC output

- **exactOutput + !zeroForOne (USDC→ETH, buy 1 ETH)**
  - `amountSpecified = 1e18` (positive)
  - `zeroForOne = false`
  - unspecified = USDC (input side)
  - Fees increase USDC input

#### Related Code

- [`contracts/src/fee/BaseDynamicAfterFee.sol`](../contracts/src/fee/BaseDynamicAfterFee.sol#L151)
  - L151: `bool exactInput = params.amountSpecified < 0` - Sign-based determination
  - L147-149: Unspecified currency and amount identification
  - L161-175: Different fee calculations for exactInput/exactOutput

### 30. Salt Strategy: When to Use, When Not to Use ★☆☆

#### Background and Problem

Same user wanting multiple positions in same tick range needs identifiers. Different use cases require different position management strategies.

#### Solution Approach

- Individual management: Use unique salt per position
- Hook management: Use salt=0 for unified management
- Allows flexible position identification strategies

#### Implementation Points

- LimitOrderHook uses salt=0 for all users (hook manages collectively)
- Regular LPs use arbitrary salt values for individual positions
- Salt ensures position key uniqueness
- Consider salt generation strategies for different use cases

#### Related Code

- [`contracts/src/LimitOrderHook.sol`](../contracts/src/LimitOrderHook.sol#L491)
  - L491: `salt: 0` - Hook unified management
  - L109, L145: calculatePositionKey using salt parameter

### 31. Currency Type Ordering: Why Currencies Have Size Relationships ★☆☆

#### Background and Problem

Same token pair with different ordering would create different pools, fragmenting liquidity. Need canonical ordering for pool uniqueness.

#### Solution Approach

Compare token addresses numerically, always setting smaller address as currency0. This creates deterministic, unique pool identification.

#### Implementation Points

- Address numerical comparison (addresses are 160-bit integers)
- Ensures pool uniqueness regardless of input order
- Canonical ordering simplifies pool discovery
- Consistent with Uniswap v2/v3 patterns

#### Related Code

- Implicitly used within Currency library
- PoolKey struct enforces currency0 < currency1

### 32. Hook Permission Design: Utilizing Address Bitmasks ★★☆

#### Background and Problem

Managing which callbacks each hook can use through traditional access control would be gas-intensive and inflexible.

#### Solution Approach

Use lower 14 bits of hook address as permission flags. Each bit represents permission for specific callback. Permissions are inherent to the address itself.

#### Implementation Points

- Each bit corresponds to specific callback permission
- Pre-calculate addresses with HookMiner for desired permissions
- Gas-efficient permission checking with single AND operation
- Immutable permissions prevent runtime tampering

#### Related Code

- [`contracts/src/utils/HookMiner.sol`](../contracts/src/utils/HookMiner.sol#L10)
  - L10: `FLAG_MASK = 0x3FFF` - 14-bit mask constant
  - L35-38: Permission check logic with bitmask
- [`contracts/src/base/BaseHook.sol`](../contracts/src/base/BaseHook.sol#L99-L101)
  - L99-101: `validateHookAddress` - Deploy-time verification

### 33. HookFee Event: Standardized Fee Tracking ★★☆

#### Background and Problem

Hooks collect fees through various mechanisms (MEV protection, dynamic fees, etc.), but tracking these fees across different hooks was inconsistent. Need standardized event emission for off-chain monitoring and accounting.

#### Solution Approach

Define standardized `HookFee` event in `IHookEvents` interface. All hooks that collect fees emit this event with consistent parameters, enabling unified fee tracking across the ecosystem.

#### Implementation Points

```solidity
event HookFee(
    bytes32 indexed poolId,
    address indexed sender,
    uint128 feeAmount0,
    uint128 feeAmount1
);
```
