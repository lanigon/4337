# vitalik.eth Multi-Chain Balance Query

## ENS Resolution

| ENS Name | Address |
|-----------|---------|
| vitalik.eth | `0xd8da6bf26964af9d7eed9e03e53415d37aa96045` |

## ETH Balances

| Chain | Balance | Symbol |
|-------|---------|--------|
| Ethereum Mainnet | 32.146371 | ETH |
| Arbitrum | 0.059995 | ETH |

## ERC-20 Token Balances (Ethereum Mainnet)

| Token | Contract | Balance |
|-------|----------|---------|
| USDC | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` | 75,552.264331 USDC |

## Commands Used

```bash
# 1. Resolve ENS name
python3 skills/evm/evm_api.py ens-resolve --name vitalik.eth

# 2. ETH balance on Ethereum mainnet
python3 skills/evm/evm_api.py balance --address 0xd8da6bf26964af9d7eed9e03e53415d37aa96045

# 3. ETH balance on Arbitrum
python3 skills/evm/evm_api.py -c arbitrum balance --address 0xd8da6bf26964af9d7eed9e03e53415d37aa96045

# 4. USDC balance on Ethereum mainnet
python3 skills/evm/evm_api.py token-balance --token 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 --address 0xd8da6bf26964af9d7eed9e03e53415d37aa96045
```

---

*Query timestamp: 2026-03-13*
