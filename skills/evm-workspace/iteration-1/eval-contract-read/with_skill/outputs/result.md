# Contract Read Evaluation: 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D

## Chain: Ethereum Mainnet

## Step 1: Contract Check (`get-code`)

- **Is contract:** Yes
- **Bytecode length:** 21,943 bytes

This address is the **Uniswap V2 Router 02**.

## Step 2: Read `factory()` → address

- **Result:** `0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f`

This is the Uniswap V2 Factory contract.

## Step 3: Read `WETH()` → address

- **Result:** `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2`

This is the canonical WETH (Wrapped Ether) contract on Ethereum mainnet.

## Commands Used

```bash
# 1. Check if address is a contract
python3 skills/evm/evm_api.py get-code --address 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D

# 2. Read factory()
python3 skills/evm/evm_api.py call --to 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D \
  --signature "factory()" --returns "address"

# 3. Read WETH()
python3 skills/evm/evm_api.py call --to 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D \
  --signature "WETH()" --returns "address"
```
