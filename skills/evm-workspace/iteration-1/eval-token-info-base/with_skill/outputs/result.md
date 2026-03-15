# Base 链 Token 信息查询结果

## Token 基本信息

| 字段 | 值 |
|------|-----|
| 合约地址 | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| 名称 (name) | USD Coin |
| 符号 (symbol) | USDC |
| 精度 (decimals) | 6 |
| 总供应量 (totalSupply) | 4,347,410,987.3748 USDC |

## Base 链 Gas 价格

| 字段 | 值 |
|------|-----|
| Gas Price (wei) | 6,000,000 |
| Gas Price (gwei) | 0.01 |

## 使用的命令

```bash
python3 skills/evm/evm_api.py -c base token-info --token 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
python3 skills/evm/evm_api.py -c base gas-price
```

## 说明

- 该 Token 是 Base 链上的原生 USDC（由 Circle 发行），精度为 6 位
- 当前 Base 链 gas 价格极低（0.01 gwei），体现了 L2 的低成本优势
- 所有数据均通过链上 RPC 直接读取，查询时间：2026-03-13
