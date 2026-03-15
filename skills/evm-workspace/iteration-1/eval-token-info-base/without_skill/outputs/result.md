# Base Chain Token Info & Gas Price

## Token: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913

| Field | Value |
|-------|-------|
| **Name** | USD Coin |
| **Symbol** | USDC |
| **Decimals** | 6 |
| **Total Supply (raw)** | 4,347,410,987,374,823 (smallest unit) |
| **Total Supply (human)** | 4,347,410,987.374823 USDC |

## Base Chain Gas Price

| Field | Value |
|-------|-------|
| **Gas Price** | 6,000,000 wei |
| **Gas Price (Gwei)** | 0.006 Gwei |

## Method

- Data source: Base mainnet RPC (`https://mainnet.base.org`)
- Queried via direct `eth_call` and `eth_gasPrice` JSON-RPC calls
- The Etherscan V2 API (free tier) does not support Base chain, so RPC was used as fallback
- Query time: 2026-03-13
