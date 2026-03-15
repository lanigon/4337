---
name: etherscan
version: 1.0.0
description: Etherscan API skill — fetch contract ABI/source, read on-chain data, query accounts, call contract functions across EVM chains
---

# Etherscan — AI Agent Skill

> Query Ethereum and EVM chains via Etherscan API.
> All commands output JSON. Supports multiple networks.

## Quick Start

```bash
python3 skills/etherscan/etherscan_api.py <command> [options]
```

API key is embedded. Override via `ETHERSCAN_API_KEY` env var if needed.

## Supported Networks

Use `--network <name>` to switch chains (default: `ethereum`):

| Network | Explorer |
|---------|----------|
| `ethereum` | etherscan.io |
| `sepolia` | sepolia.etherscan.io |
| `polygon` | polygonscan.com |
| `bsc` | bscscan.com |
| `arbitrum` | arbiscan.io |
| `optimism` | optimistic.etherscan.io |
| `base` | basescan.org |
| `avalanche` | snowtrace.io |

> Note: The same API key works across Etherscan-family explorers. For non-Etherscan explorers (like Morph's Blockscout), use `morph-explorer` skill instead.

---

## Commands

### Contract

#### `get-abi`
Fetch verified contract ABI. Use `--save` to write to file.
```bash
python3 skills/etherscan/etherscan_api.py get-abi --address 0xdAC17F958D2ee523a2206206994597C13D831ec7
python3 skills/etherscan/etherscan_api.py get-abi --address 0xdAC17F958D2ee523a2206206994597C13D831ec7 --save
```

#### `get-source`
Fetch verified contract source code, compiler info, proxy detection.
```bash
python3 skills/etherscan/etherscan_api.py get-source --address 0xdAC17F958D2ee523a2206206994597C13D831ec7
python3 skills/etherscan/etherscan_api.py get-source --address 0xdAC17F958D2ee523a2206206994597C13D831ec7 --save
```

#### `contract-creation`
Get who created the contract and the creation transaction hash.
```bash
python3 skills/etherscan/etherscan_api.py contract-creation --address 0xdAC17F958D2ee523a2206206994597C13D831ec7
```

### Read Contract (eth_call)

#### `call`
Call a named contract function (read-only). Encodes arguments automatically.
```bash
# balanceOf for USDT
python3 skills/etherscan/etherscan_api.py call \
  --to 0xdAC17F958D2ee523a2206206994597C13D831ec7 \
  --signature "balanceOf(address)" \
  --args 0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8 \
  --returns "uint256"

# name() for an ERC-20
python3 skills/etherscan/etherscan_api.py call \
  --to 0xdAC17F958D2ee523a2206206994597C13D831ec7 \
  --signature "name()" \
  --returns "string"

# totalSupply()
python3 skills/etherscan/etherscan_api.py call \
  --to 0xdAC17F958D2ee523a2206206994597C13D831ec7 \
  --signature "totalSupply()" \
  --returns "uint256"

# ownerOf(uint256) for ERC-721
python3 skills/etherscan/etherscan_api.py call \
  --to 0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D \
  --signature "ownerOf(uint256)" \
  --args 1 \
  --returns "address"
```

#### `eth-call`
Raw eth_call with hex-encoded calldata (for when you already have the encoded data).
```bash
python3 skills/etherscan/etherscan_api.py eth-call \
  --to 0xdAC17F958D2ee523a2206206994597C13D831ec7 \
  --data 0x70a08231000000000000000000000000BE0eB53F46cd790Cd13851d5EFf43D12404d33E8
```

### Account

#### `balance`
Get ETH balance.
```bash
python3 skills/etherscan/etherscan_api.py balance --address 0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8
```

#### `multi-balance`
Get ETH balance for multiple addresses at once.
```bash
python3 skills/etherscan/etherscan_api.py multi-balance --addresses 0xAddr1,0xAddr2,0xAddr3
```

#### `txlist`
Get transaction history for an address.
```bash
python3 skills/etherscan/etherscan_api.py txlist --address 0xAddr --limit 20 --sort desc
```

#### `token-txs`
Get ERC-20 token transfer events. Optionally filter by token contract.
```bash
python3 skills/etherscan/etherscan_api.py token-txs --address 0xAddr --limit 10
python3 skills/etherscan/etherscan_api.py token-txs --address 0xAddr --contract 0xTokenAddr
```

### Token

#### `token-supply`
Get total supply of an ERC-20 token.
```bash
python3 skills/etherscan/etherscan_api.py token-supply --contract 0xdAC17F958D2ee523a2206206994597C13D831ec7 --decimals 6
```

#### `token-balance`
Get ERC-20 token balance for an address.
```bash
python3 skills/etherscan/etherscan_api.py token-balance --contract 0xdAC17F958D2ee523a2206206994597C13D831ec7 --address 0xAddr --decimals 6
```

### Transaction

#### `tx-receipt`
Get transaction receipt (status, gas used, logs count).
```bash
python3 skills/etherscan/etherscan_api.py tx-receipt --hash 0xTxHash
```

### Network Info

#### `block-number`
Get latest block number.
```bash
python3 skills/etherscan/etherscan_api.py block-number
```

#### `gas-price`
Get current gas price in Gwei.
```bash
python3 skills/etherscan/etherscan_api.py gas-price
```

### Event Logs

#### `get-logs`
Get event logs by contract address and optional topic filter.
```bash
python3 skills/etherscan/etherscan_api.py get-logs --address 0xContract --topic0 0xEventSigHash --limit 20
```

---

## Common Workflows

**Pull a contract's ABI and read its state:**
```
get-abi → call (read functions)
```

**Investigate a wallet:**
```
balance → txlist → token-txs
```

**Check a token:**
```
get-source → token-supply → token-balance
```

**Cross-chain query (e.g. check same contract on Arbitrum):**
```bash
python3 skills/etherscan/etherscan_api.py -n arbitrum balance --address 0xAddr
```

---

## Domain Knowledge

- Etherscan API rate limit: 5 calls/sec on free tier
- `call` command requires `eth_abi` and `eth_utils` packages (already installed for morph-skill)
- For Morph chain queries, use `morph-explorer` skill (Blockscout API), not this skill
- The `--save` flag on `get-abi` and `get-source` writes to current working directory
- Proxy contracts: `get-source` will show `proxy: "1"` and `implementation` address if detected
