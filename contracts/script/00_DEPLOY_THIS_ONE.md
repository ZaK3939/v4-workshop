# 🚨 Uniswap V4 Workshop デプロイメントガイド

## 🎯 このワークショップの目的

Uniswap V4のHookをデプロイし、実際に動作するプールを作成して、Hook機能を理解することが目的です。

## 📋 実行手順（必ずこの順番で！）

### 🔧 準備

```bash
# 1. contracts ディレクトリに移動
cd contracts

# 2. 環境変数を読み込む
source .env

# 3. デプロイヤーアドレスを設定（重要！）
export ETH_FROM=$(cast wallet address --private-key $PK)

# 4. 確認
echo "Deployer: $ETH_FROM"
echo "RPC: $UNICHAIN_RPC"
```

### 1️⃣ Step 1: Hook のデプロイ

```bash
forge script script/01_DeployAndSave.s.sol \
    --rpc-url $UNICHAIN_RPC \
    --private-key $PK \
    --broadcast \
    --legacy \
    --ffi \
    -vvv
```

**何が起きるか:**
- `LiquidityPenaltyHook` がデプロイされます
- Hook アドレスが `script/.deployment.env` に保存されます
- このHookはJIT（Just-In-Time）攻撃を防ぐ機能を持っています

### 2️⃣ Step 2: Pool の作成

```bash
forge script script/02_CreatePool.s.sol \
    --rpc-url $UNICHAIN_RPC \
    --private-key $PK \
    --broadcast \
    --legacy \
    -vvv
```

**何が起きるか:**
- Step 1でデプロイしたHookを使用してETH/USDCプールを作成
- Pool情報が `script/.pool.env` に保存されます
- V3 TWAPから初期価格を取得します

### 3️⃣ Step 3: 情報の確認と表示

```bash
forge script script/03_ShowPoolInfo.s.sol
```

**表示される情報:**
- デプロイされたHookアドレス
- 作成されたPool ID
- Hookで有効化されている機能:
  - `afterAddLiquidity` - 流動性追加後の処理
  - `afterRemoveLiquidity` - 流動性削除後の処理
  - `afterAddLiquidityReturnDelta` - 流動性追加後のdelta返却
  - `afterRemoveLiquidityReturnDelta` - 流動性削除後のdelta返却
- Uniswap探索ページへのリンク

## 🎉 完了後の確認

1. **Uniswap Explorerで確認**
   - Step 3で表示されたリンクをクリック
   - プールの詳細が表示されることを確認

2. **Hookの動作確認**
   - 流動性を追加/削除してみる
   - LiquidityPenaltyHookが正しく動作することを確認

## ⚠️ トラブルシューティング

### "insufficient funds" エラー
```bash
# Unichainのfaucetから資金を取得
# https://unichain.org/faucet
```

### "ETH_FROM not set" エラー
```bash
# 必ず実行してください
export ETH_FROM=$(cast wallet address --private-key $PK)
```

### ファイル書き込みエラー
```bash
# foundry.tomlに以下が含まれているか確認
fs_permissions = [{ access = "read-write", path = "./"}]
```

## 📚 理解を深めるために

- **LiquidityPenaltyHook**: JIT攻撃（流動性を一時的に追加してすぐに削除する攻撃）を防ぐ
- **Hook Permission Bits**: Hookアドレスに権限情報がエンコードされている
- **Pool Key**: currency0, currency1, fee, tickSpacing, hooksの組み合わせでプールを一意に識別

## 🔗 参考リンク

- [Uniswap V4 Documentation](https://docs.uniswap.org/contracts/v4/overview)
- [Hook Examples](https://github.com/Uniswap/v4-core/tree/main/src/test)
- [Unichain Faucet](https://unichain.org/faucet)