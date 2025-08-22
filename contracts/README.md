# Uniswap V4 Hooks Workshop - Contracts

このディレクトリには、Uniswap V4 Hooksワークショップで使用するスマートコントラクトが含まれています。

## 📦 含まれるHook

### 1. LiquidityPenaltyHook
- **目的**: JIT（Just-In-Time）流動性提供攻撃からLPを保護
- **機能**: 流動性追加後、一定期間内に削除する場合にペナルティを課す
- **設定可能パラメータ**: `blockNumberOffset`（ペナルティ期間）

### 2. AntiSandwichHook
- **目的**: サンドイッチ攻撃を防ぐ
- **機能**: ブロック開始時の価格より有利な約定を禁止
- **注意**: `zeroForOne`方向のスワップのみ保護

### 3. LimitOrderHook
- **目的**: 指値注文機能を実装
- **機能**: 特定価格での自動約定、部分約定のサポート
- **操作**: `placeOrder`, `cancelOrder`, `withdraw`

## 🚀 デプロイ方法

### 環境設定

```bash
# .envファイルを作成
cp .env.example .env

# 必要な環境変数を設定
# - UNICHAIN_SEPOLIA_RPC
# - PK (デプロイ用の秘密鍵)
```

### 簡単デプロイ（推奨）

すべてを自動化した1コマンドデプロイ：

```bash
# 環境変数を読み込み
source .env

# デプロイ実行（ビルド、デプロイ、保存、ABI同期を自動実行）
bun run contracts:deploy
```

このコマンドは以下を自動的に実行します：
1. コントラクトのビルド
2. HookMinerを使用したデプロイ
3. デプロイ結果の自動保存
4. ABIの同期

### 手動デプロイ

個別にステップを実行したい場合：

```bash
# ビルド
forge build

# デプロイ
forge script script/DeployHooksWithMiner.s.sol --rpc-url $UNICHAIN_SEPOLIA_RPC --private-key $PK --broadcast

# デプロイ結果を保存
bun run contracts:deploy:save
```

## 🔧 Hook権限ビット

各Hookは特定の権限ビットを必要とします：

- **LiquidityPenaltyHook**: 
  - `AFTER_ADD_LIQUIDITY`
  - `AFTER_REMOVE_LIQUIDITY`
  - `AFTER_ADD_LIQUIDITY_RETURNS_DELTA`
  - `AFTER_REMOVE_LIQUIDITY_RETURNS_DELTA`

- **AntiSandwichHook**:
  - `BEFORE_SWAP`
  - `AFTER_SWAP`
  - `AFTER_SWAP_RETURNS_DELTA`

- **LimitOrderHook**:
  - `AFTER_INITIALIZE`
  - `AFTER_SWAP`

## 📝 PoolManagerアドレス

**Unichain Sepolia**: `0x2000d755f9e4F3c77E0C9dfb6f84a609E2A0f0fd`

## 🛠️ ビルドとテスト

```bash
# ビルド
forge build

# テスト実行
forge test

# ガスレポート
forge test --gas-report
```

## ⚠️ 注意事項

1. **EVM Version**: Cancunが必要（transient storageを使用）
2. **Solidity Version**: 0.8.24以上
3. **Hook Address**: CREATE2で生成されるアドレスは権限ビットを満たす必要がある

## 🔗 関連リンク

- [Uniswap V4 Documentation](https://docs.uniswap.org/contracts/v4/overview)
- [OpenZeppelin Uniswap Hooks](https://github.com/OpenZeppelin/uniswap-hooks)
- [V4 Test Interface](https://github.com/uniswapfoundation/v4-test-interface)

## 📦 依存関係のインストール

```bash
# Bunを使用
bun install

# またはnpmを使用
npm install
```

## 🧪 テストの実行

```bash
# 全てのテストを実行
forge test

# 詳細な出力
forge test -vvv

# 特定のテストのみ実行
forge test --match-test test_LiquidityPenalty
```

## 📜 ライセンス

このプロジェクトはMITライセンスの下で公開されています。