---
name: evm
version: 1.0.0
description: General-purpose EVM chain interaction skill — query balances, read contracts, send transactions, check tokens across Ethereum, Polygon, BSC, Arbitrum, Base, and 10+ other EVM chains via direct JSON-RPC. Use this skill whenever the user wants to interact with any EVM-compatible blockchain (check balance, transfer ETH/tokens, call smart contracts, look up transactions, resolve ENS names, read storage slots), even if they don't specify which chain — default is Ethereum mainnet.
---

# EVM Skill — Multi-Chain RPC Toolkit

> Interact with any EVM chain directly via JSON-RPC. No API key needed.
> All commands output JSON. All amounts use human-readable units.

## Quick Start

```bash
python3 skills/evm/evm_api.py <command> [options]

# Specify chain with -c (default: ethereum)
python3 skills/evm/evm_api.py -c polygon balance --address 0x...
python3 skills/evm/evm_api.py -c arbitrum gas-price
```

## When to Use This vs Other Skills

| Need | Use |
|------|-----|
| Query/transact on Ethereum, Polygon, BSC, Arbitrum, Base, etc. | **This skill** |
| Need contract ABI/source code from Etherscan | `etherscan` skill |
| Morph-specific features (DEX, bridge, agent identity, alt-fee) | `morph-skill` |
| General RPC on Morph chain | **This skill** with `-c morph` |

## Supported Chains

Use `-c <chain>` to switch. Run `chains` to see all with their RPC endpoints.

| Chain | Symbol | Chain ID |
|-------|--------|----------|
| `ethereum` (default) | ETH | 1 |
| `polygon` | MATIC | 137 |
| `bsc` | BNB | 56 |
| `arbitrum` | ETH | 42161 |
| `optimism` | ETH | 10 |
| `base` | ETH | 8453 |
| `avalanche` | AVAX | 43114 |
| `linea` | ETH | 59144 |
| `scroll` | ETH | 534352 |
| `zksync` | ETH | 324 |
| `fantom` | FTM | 250 |
| `gnosis` | xDAI | 100 |
| `mantle` | MNT | 5000 |
| `celo` | CELO | 42220 |
| `morph` | ETH | 2818 |
| `sepolia` | ETH | 11155111 |

Override any chain's RPC via env: `EVM_RPC_ETHEREUM=https://your-rpc.com`

---

## Commands

### Chain Info

#### `chains`
List all supported chains with RPC endpoints.
```bash
python3 skills/evm/evm_api.py chains
```

#### `chain-info`
Get chain details and latest block number.
```bash
python3 skills/evm/evm_api.py -c polygon chain-info
```

### Network

#### `block-number`
```bash
python3 skills/evm/evm_api.py block-number
python3 skills/evm/evm_api.py -c bsc block-number
```

#### `gas-price`
```bash
python3 skills/evm/evm_api.py gas-price
python3 skills/evm/evm_api.py -c arbitrum gas-price
```

#### `block`
Get block details by number or "latest".
```bash
python3 skills/evm/evm_api.py block --block latest
python3 skills/evm/evm_api.py block --block 19000000
```

### Wallet

#### `create-wallet`
Generate a new key pair locally. No network call.
```bash
python3 skills/evm/evm_api.py create-wallet
```

#### `balance`
Get native token balance (ETH, MATIC, BNB, etc.).
```bash
python3 skills/evm/evm_api.py balance --address 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045
python3 skills/evm/evm_api.py -c polygon balance --address 0xAddr
```

#### `nonce`
Get transaction count (nonce) for an address.
```bash
python3 skills/evm/evm_api.py nonce --address 0xAddr
```

#### `transfer`
Send native token. Amount is in human units (e.g. `0.1` = 0.1 ETH).
```bash
python3 skills/evm/evm_api.py -c polygon transfer --to 0xRecipient --amount 0.5 --private-key 0xKey
```

#### `transfer-token`
Send ERC-20 tokens. Automatically detects token decimals.
```bash
python3 skills/evm/evm_api.py transfer-token --token 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 --to 0xRecipient --amount 100 --private-key 0xKey
```

### Transaction

#### `tx`
Get transaction details by hash.
```bash
python3 skills/evm/evm_api.py tx --hash 0xTxHash
```

#### `tx-receipt`
Get transaction receipt (status, gas used, logs count).
```bash
python3 skills/evm/evm_api.py tx-receipt --hash 0xTxHash
```

### Token (ERC-20)

#### `token-info`
Get name, symbol, decimals, total supply — all from on-chain data.
```bash
python3 skills/evm/evm_api.py token-info --token 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
```

#### `token-balance`
Get ERC-20 balance. Auto-detects decimals and symbol.
```bash
python3 skills/evm/evm_api.py token-balance --token 0xdAC17F958D2ee523a2206206994597C13D831ec7 --address 0xAddr
```

### Contract

#### `call`
Call a named function (read-only). Encodes arguments automatically.
```bash
# balanceOf
python3 skills/evm/evm_api.py call --to 0xdAC17F958D2ee523a2206206994597C13D831ec7 \
  --signature "balanceOf(address)" --args 0xAddr --returns "uint256"

# name()
python3 skills/evm/evm_api.py call --to 0xdAC17F958D2ee523a2206206994597C13D831ec7 \
  --signature "name()" --returns "string"

# ownerOf (ERC-721)
python3 skills/evm/evm_api.py call --to 0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D \
  --signature "ownerOf(uint256)" --args 1 --returns "address"
```

#### `eth-call`
Raw eth_call with pre-encoded calldata.
```bash
python3 skills/evm/evm_api.py eth-call --to 0xContract --data 0xCalldata
```

#### `get-code`
Check if an address is a contract and get bytecode length.
```bash
python3 skills/evm/evm_api.py get-code --address 0xAddr
```

#### `get-storage`
Read a specific storage slot from a contract.
```bash
python3 skills/evm/evm_api.py get-storage --address 0xContract --slot 0
python3 skills/evm/evm_api.py get-storage --address 0xContract --slot 0x3
```

### Event Logs

#### `get-logs`
Get event logs. Defaults to last 1000 blocks if no range specified.
```bash
python3 skills/evm/evm_api.py get-logs --address 0xContract --topic0 0xEventSigHash --limit 10
python3 skills/evm/evm_api.py get-logs --address 0xContract --from-block 19000000 --to-block 19001000
```

### ENS (Ethereum only)

#### `ens-resolve`
Resolve an ENS name to its Ethereum address.
```bash
python3 skills/evm/evm_api.py ens-resolve --name vitalik.eth
```

---

## Common Workflows

**Check a wallet across chains:**
```bash
python3 skills/evm/evm_api.py balance --address 0xAddr
python3 skills/evm/evm_api.py -c polygon balance --address 0xAddr
python3 skills/evm/evm_api.py -c arbitrum balance --address 0xAddr
```

**Investigate a token:**
```
token-info → token-balance → call (custom read functions)
```

**Check if address is a contract:**
```
get-code → call (if contract) → get-storage (inspect state)
```

**Send tokens safely:**
```
balance (verify funds) → transfer or transfer-token → tx-receipt (confirm)
```

**Resolve ENS then query:**
```
ens-resolve → balance / token-balance / tx
```

---

## Domain Knowledge

- All RPC endpoints are public and free — no API key required
- Rate limits vary by provider; if you hit limits, set a custom RPC via `EVM_RPC_<CHAIN>` env var
- `call` command requires `eth_abi` and `eth_utils` packages
- `transfer` / `transfer-token` / `create-wallet` require `eth_account` package
- ENS resolution works on Ethereum mainnet only
- `get-logs` without `--from-block` defaults to last 1000 blocks to avoid huge responses
- For Morph-specific features (DEX swap, bridge, agent identity), use `morph-skill` instead

## Safety Rules

1. **Confirm with the user before any send command** (`transfer`, `transfer-token`) — show recipient, amount, chain, and token before signing
2. All amounts are in human-readable units — `0.1` means 0.1 ETH, not wei
3. Private keys are only used locally for signing, never sent to any API
4. For large amounts, suggest the user verify the recipient address character by character
5. `create-wallet` is purely local — no network call
