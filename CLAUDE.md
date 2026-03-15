# Morph Project

Morph 生态和 AI Agent 研究项目。

## 项目结构

- `web/` — Next.js 网站（部署在 Vercel）
- `morph-skill/` — Morph 链交互工具（Python CLI）
- `skills/etherscan/` — Etherscan API 工具（拉合约、读链上数据、contract call）
- `contracts/` — 智能合约源码
  - `erc4337/` — ERC-4337 Account Abstraction 合约（EntryPoint、BasePaymaster、SimpleAccount 等）
  - `eip8004/` — EIP-8004 Agent 身份/声誉合约 ABI
- `research/4337/` — ERC-4337 & Biconomy 调研报告

## Morph Skill

与 Morph L2 链交互的 CLI 工具，支持钱包、浏览器查询、DEX swap、跨链桥、Agent 身份、Alt-Fee 等。

### 用法

```bash
python3 morph-skill/scripts/morph_api.py <command> [options]
```

### 命令速查

| 模块 | 命令 |
|------|------|
| **Wallet** | `create-wallet`, `balance`, `token-balance`, `transfer`, `transfer-token`, `tx-receipt` |
| **Explorer** | `address-info`, `address-txs`, `address-tokens`, `tx-detail`, `token-search`, `contract-info`, `token-transfers`, `token-info`, `token-list` |
| **Agent** | `agent-register`, `agent-wallet`, `agent-metadata`, `agent-reputation`, `agent-feedback`, `agent-reviews` |
| **DEX** | `dex-quote`, `dex-send` |
| **Bridge** | `bridge-chains`, `bridge-tokens`, `bridge-quote`, `bridge-balance`, `bridge-login`, `bridge-swap`, `bridge-order` |
| **Alt-Fee** | `altfee-tokens`, `altfee-token-info`, `altfee-estimate`, `altfee-send` |

详细用法见 `morph-skill/SKILL.md` 或各 skill 下的 SKILL.md。

### 安全规则

- **必须在执行 send/transfer/swap 命令前确认用户意图**
- 私钥仅用于本地签名，不会发送到任何 API
- 金额使用人类可读单位（`0.1` = 0.1 ETH，不是 wei）

## Etherscan Skill

查询 Ethereum 及 EVM 链（通过 Etherscan V2 API），支持拉合约 ABI/源码、contract call、查余额/交易等。

### 用法

```bash
python3 skills/etherscan/etherscan_api.py <command> [options]
# 跨链查询加 -n 参数
python3 skills/etherscan/etherscan_api.py -n polygon balance --address 0x...
```

### 命令速查

| 模块 | 命令 |
|------|------|
| **Contract** | `get-abi`, `get-source`, `contract-creation` |
| **Read Contract** | `call` (ABI 编码), `eth-call` (raw calldata) |
| **Account** | `balance`, `multi-balance`, `txlist`, `token-txs` |
| **Token** | `token-supply`, `token-balance` |
| **Network** | `block-number`, `gas-price` |
| **Logs** | `get-logs` |

详细用法见 `skills/etherscan/SKILL.md`。

## 链信息

| 网络 | Chain ID | RPC |
|------|----------|-----|
| Morph 主网 | 2818 | `https://rpc-quicknode.morph.network` |
| Morph Hoodi 测试网 | 2910 | `https://rpc-hoodi.morph.network` |

## 关键合约

| 合约 | 地址 |
|------|------|
| EntryPoint v0.6.0 | `0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789` |
| IdentityRegistry (EIP-8004) | `0x672c7c7A9562B8d1e31b1321C414b44e3C75a530` |
| ReputationRegistry (EIP-8004) | `0x23AA2fD5D0268F0e523385B8eF26711eE820B4B5` |
