# vitalik.eth Multi-Chain Balance Query

**Address:** `0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045` (vitalik.eth)

**Query Date:** 2026-03-13

## ETH Balances

| Network | Balance (ETH) | Balance (Wei) |
|---------|--------------|---------------|
| Ethereum Mainnet | 32.146371 | 32146371406626702618 |
| Arbitrum | 0.059995 | 59994863739028677 |

## ERC-20 Token Balances (Ethereum Mainnet)

| Token | Contract | Balance |
|-------|----------|---------|
| USDC | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` | 75,552.264331 USDC |

## Tool Used

```bash
# Ethereum ETH balance
python3 skills/etherscan/etherscan_api.py -n ethereum balance --address 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045

# Arbitrum ETH balance
python3 skills/etherscan/etherscan_api.py -n arbitrum balance --address 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045

# Ethereum USDC balance
python3 skills/etherscan/etherscan_api.py -n ethereum token-balance --address 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 --contract 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 --decimals 6
```
