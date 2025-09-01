# Uniswap V4 Hook System Complete Guide

## Overview

The Uniswap V4 hook system is a powerful mechanism for customizing pool behavior. It determines which specific hooks to invoke by inspecting the least significant 14 bits of the hook contract's address.

## 14 Types of Hooks and Their Usage

### 1. Hook Permission System

V4 provides a total of 14 hook flags: 10 core hook functions and 4 delta-returning flags:

```solidity
// Hook flags (least significant bits of address)
BEFORE_INITIALIZE_FLAG = 1 << 13        // 0010 0000 0000 0000
AFTER_INITIALIZE_FLAG = 1 << 12         // 0001 0000 0000 0000
BEFORE_ADD_LIQUIDITY_FLAG = 1 << 11     // 0000 1000 0000 0000
AFTER_ADD_LIQUIDITY_FLAG = 1 << 10      // 0000 0100 0000 0000
BEFORE_REMOVE_LIQUIDITY_FLAG = 1 << 9   // 0000 0010 0000 0000
AFTER_REMOVE_LIQUIDITY_FLAG = 1 << 8    // 0000 0001 0000 0000
BEFORE_SWAP_FLAG = 1 << 7               // 0000 0000 1000 0000
AFTER_SWAP_FLAG = 1 << 6                // 0000 0000 0100 0000
BEFORE_DONATE_FLAG = 1 << 5             // 0000 0000 0010 0000
AFTER_DONATE_FLAG = 1 << 4              // 0000 0000 0001 0000
BEFORE_SWAP_RETURNS_DELTA_FLAG = 1 << 3 // 0000 0000 0000 1000
AFTER_SWAP_RETURNS_DELTA_FLAG = 1 << 2  // 0000 0000 0000 0100
AFTER_ADD_LIQUIDITY_RETURNS_DELTA_FLAG = 1 << 1  // 0000 0000 0000 0010
AFTER_REMOVE_LIQUIDITY_RETURNS_DELTA_FLAG = 1 << 0 // 0000 0000 0000 0001
```

### 2. Detailed Usage Examples for Each Hook

#### 2.1 Core Hook Functions (10 Types)

##### 2.1.1 Initialize Hooks

**beforeInitialize**
- **Purpose**: Validation and configuration before pool initialization
- **Use Cases**: 
  - Allow only specific token pairs
  - Set initial fee rates
  - Whitelist control

**afterInitialize**
- **Purpose**: Additional setup after pool initialization
- **Use Cases**: 
  - Automatic initial liquidity addition
  - Event logging
  - External system notifications

##### 2.1.2 Liquidity Hooks

**beforeAddLiquidity / afterAddLiquidity**
- **Purpose**: Control and track liquidity additions
- **Use Cases**:
  - JIT attack prevention (LiquidityPenaltyHook)
  - KYC verification for liquidity providers
  - Custom fee collection
  - Min/max liquidity limits

**beforeRemoveLiquidity / afterRemoveLiquidity**
- **Purpose**: Control liquidity removal
- **Use Cases**:
  - Early withdrawal penalties
  - Lock-up period enforcement
  - Fee redistribution

##### 2.1.3 Swap Hooks

**beforeSwap / afterSwap**
- **Purpose**: Control and monitor swaps
- **Use Cases**:
  - MEV protection (AntiSandwichHook)
  - Dynamic fee adjustment
  - Trade volume limits
  - Limit order execution (LimitOrderHook)

##### 2.1.4 Donate Hooks

**beforeDonate / afterDonate**
- **Purpose**: Handle pool donations
- **Use Cases**:
  - Minimum donation amounts
  - Donor rewards
  - Donation tracking and recording

#### 2.2 Delta-Returning Flags (4 Types)

**beforeSwapReturnDelta / afterSwapReturnDelta**
- **Purpose**: Dynamic swap amount adjustment
- **Use Cases**:
  - Custom price curve implementation
  - Dynamic fee calculation
  - Swap amount modification

**afterAddLiquidityReturnDelta / afterRemoveLiquidityReturnDelta**
- **Purpose**: Balance adjustment after liquidity operations
- **Use Cases**:
  - Custom fee implementation
  - Rebate systems
  - Automatic liquidity reward distribution

## 3. Detailed Implementation Examples

### 3.1 LiquidityPenaltyHook (JIT Attack Prevention)

```solidity
// Permission settings
Hooks.Permissions({
    afterAddLiquidity: true,              // Hold fees after liquidity addition
    afterRemoveLiquidity: true,           // Apply penalty on removal
    afterAddLiquidityReturnDelta: true,   // Dynamic fee adjustment
    afterRemoveLiquidityReturnDelta: true // Penalty return
})
```

**Operating Principle**:
1. Record block number when liquidity is added
2. Apply penalty for removals within configured period (blockNumberOffset)
3. Penalty decreases linearly over time
4. Collected penalties are distributed to other LPs

**Parameter Tuning**:
- `blockNumberOffset`: 10-100 blocks (adjust based on liquidity and asset type)
- Low liquidity pools: Higher values recommended
- High liquidity pools: Smaller values can be effective

### 3.2 AntiSandwichHook (MEV Protection)

```solidity
// Permission settings
Hooks.Permissions({
    beforeSwap: true,           // Check checkpoint before swap
    afterSwap: true,            // Update state after swap
    afterSwapReturnDelta: true  // Apply price restrictions
})
```

**Operating Principle**:
1. Save price at block start as checkpoint
2. Swaps within same block cannot execute at better price than start price
3. zeroForOne direction uses normal xy=k curve
4. !zeroForOne direction executes at fixed price

**Considerations**:
- MEV resistance reduces arbitrage
- Block start price may deviate from market price
- Watch gas consumption during large price movements

### 3.3 LimitOrderHook (Pseudo Limit Orders)

```solidity
// Permission settings
Hooks.Permissions({
    afterInitialize: true,  // Set tickLowerLast after initialization
    afterSwap: true        // Execute orders after swap
})
```

**Operating Principle**:
1. Place liquidity at tick outside current price
2. Execute order when price crosses tick
3. Hook holds funds after execution
4. Users can withdraw later

**Usage**:
- `placeOrder`: Place order
- `cancelOrder`: Cancel unfilled order
- `withdraw`: Withdraw filled order

## 4. Hook Combination Patterns

### 4.1 Basic Protection System

```solidity
// JIT Protection + MEV Protection
contract ProtectedPool {
    // Integrate LiquidityPenaltyHook and AntiSandwichHook features
    function getHookPermissions() returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeSwap: true,
            afterSwap: true,
            afterAddLiquidity: true,
            afterRemoveLiquidity: true,
            afterSwapReturnDelta: true,
            afterAddLiquidityReturnDelta: true,
            afterRemoveLiquidityReturnDelta: true,
            // others false
        });
    }
}
```

### 4.2 Advanced Trading System

```solidity
// Limit Orders + Dynamic Fees
contract AdvancedTradingHook {
    // Fee adjustment based on market conditions and limit order functionality
    function getHookPermissions() returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            afterInitialize: true,
            beforeSwap: true,
            afterSwap: true,
            beforeSwapReturnDelta: true,
            // others false
        });
    }
}
```

## 5. Implementation Considerations

### 5.1 Hook Fees and Data Standards

#### Hook Fee Collection Patterns

Hooks can collect fees through multiple mechanisms, each with specific use cases:

**1. Dynamic Hook Fees (afterSwapReturnDelta)**
```solidity
// Example: Collect 0.1% fee on swaps
function afterSwap(
    address sender,
    PoolKey calldata key,
    SwapParams calldata params,
    BalanceDelta delta,
    bytes calldata hookData
) external returns (bytes4, int128) {
    // Calculate fee on unspecified amount
    int128 fee = calculateFee(delta);
    
    // Return negative fee to collect from swapper
    return (this.afterSwap.selector, -fee);
}
```

**2. Virtual Balance Management (ERC-6909)**
```solidity
// Hooks accumulate fees as virtual balances
// Users can later withdraw accumulated fees
currency.take(poolManager, recipient, amount, true); // true = claims (mint)
currency.settle(poolManager, payer, amount, true);  // true = burn
```

**3. Fee Distribution via Donation**
```solidity
// Distribute collected fees to LPs
poolManager.donate(key, amount0, amount1, hookData);
```

#### Hook Data Standards

According to the [Uniswap Foundation Hook Data Standards Guide](https://www.uniswapfoundation.org/blog/developer-guide-establishing-hook-data-standards-for-uniswap-v4):

**1. hookData Parameter Structure**
```solidity
// Recommended encoding for hookData
bytes memory hookData = abi.encode(
    address recipient,    // Who receives output/fees
    uint256 minOutput,   // Slippage protection
    bytes extraData      // Hook-specific data
);
```

**2. Event Standards**
```solidity
// Standard event format for hook operations
event HookFeeCollected(
    PoolId indexed poolId,
    address indexed collector,
    Currency indexed currency,
    uint256 amount,
    bytes hookData
);
```

**3. Fee Configuration Best Practices**
- Store fee rates in hook storage, not hookData
- Allow fee updates through governance/owner functions
- Emit events for all fee collections
- Document fee calculation methodology

#### Implementation Example: Dynamic Fee Hook

```solidity
contract DynamicFeeHook is BaseHook {
    using SafeCast for uint256;
    
    // Fee configuration
    mapping(PoolId => uint24) public hookFees; // in hundredths of bps
    
    function afterSwap(
        address sender,
        PoolKey calldata key,
        SwapParams calldata params,
        BalanceDelta delta,
        bytes calldata hookData
    ) external override returns (bytes4, int128) {
        // Decode hookData if needed
        (address feeRecipient) = hookData.length > 0 
            ? abi.decode(hookData, (address)) 
            : sender;
        
        // Calculate fee on unspecified amount
        (Currency unspecified, int128 unspecifiedAmount) = 
            (params.amountSpecified < 0 == params.zeroForOne)
            ? (key.currency1, delta.amount1())
            : (key.currency0, delta.amount0());
        
        // Apply fee rate
        uint24 feeRate = hookFees[key.toId()];
        int128 hookFee = -int128(uint128(
            uint256(uint128(unspecifiedAmount)) * feeRate / 1e6
        ));
        
        // Mint fee to recipient as ERC-6909
        if (hookFee < 0) {
            poolManager.mint(
                feeRecipient, 
                unspecified.toId(), 
                uint256(uint128(-hookFee))
            );
            
            emit HookFeeCollected(
                key.toId(),
                feeRecipient,
                unspecified,
                uint256(uint128(-hookFee)),
                hookData
            );
        }
        
        return (this.afterSwap.selector, hookFee);
    }
}
```

#### Real-World Fee Examples from Workshop Hooks

**1. LiquidityPenaltyHook - Time-based Fee Withholding**
```solidity
// Withholds fees for recent liquidity additions
// Penalties decrease linearly over blockNumberOffset period
function _afterAddLiquidity(...) returns (bytes4, BalanceDelta) {
    if (recentlyAdded) {
        _takeFeesToHook(key, positionKey, feeDelta);
        return (selector, feeDelta); // Hook keeps fees
    }
    return (selector, ZERO_DELTA); // User keeps fees
}
```

**2. AntiSandwichHook - Price Protection Fees**
```solidity
// Collects difference between market price and protected price
function _afterSwap(...) returns (bytes4, int128) {
    if (protectionActive) {
        int128 protectionFee = targetAmount - actualAmount;
        // Fee minted to hook as ERC-6909
        return (selector, protectionFee);
    }
}
```

**3. LimitOrderHook - Order Execution Fees**
```solidity
// Collects fees when orders are filled
function _fillOrder(...) {
    // Fees from filled orders accumulate in orderInfo
    orderInfo.currency0Total += amount0Fee;
    orderInfo.currency1Total += amount1Fee;
    // Distributed to remaining order placers on cancel
}
```

### 5.2 Handling msg.sender

Special handling is required to access the original msg.sender within hooks

- Details: https://docs.uniswap.org/contracts/v4/guides/accessing-msg.sender-using-hook

### 5.3 Handling ETH (Native Token)

Sweep processing is required when handling ETH in liquidity positions

**Important Vulnerability Example**:
- Details: https://x.com/electisec/status/1921211750185054216

### 6. Error Investigation Tools

**Using 4byte Directory for error selector investigation**:
- URL: https://www.4byte.directory/
- Search for bytes4 selector returned when error occurs
- Example: `0x7939f424` → `TransferFromFailed()`

Usage:
1. Extract first 4 bytes from transaction revert data
2. Search in 4byte Directory
3. Confirm error function signature

### 7. Common Issues

1. **HookAddressNotValid Error**
   - Cause: Address bit pattern doesn't match permissions
   - Solution: Recalculate correct address with HookMiner

2. **Gas Limit Error**
   - Cause: Hook processing too complex
   - Solution: Simplify processing or move off-chain

3. **Unexpected Behavior**
   - Cause: Misunderstanding hook execution order
   - Solution: Verify before and after processing flow

4. **Unknown Error**
   - Search error selector in [4byte Directory](https://www.4byte.directory/)
   - Understand error meaning and debug
