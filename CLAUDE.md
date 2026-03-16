# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Morph L2 ERC-4337 Agent Wallet 项目。包含 Agent Wallet 前端（Biconomy Smart Account + Session Keys）、Python CLI 链交互工具、Solidity 参考合约和调研文档。

线上地址: https://web-ten-blond-30.vercel.app

## Project Structure

- `web/` — Next.js 16 前端（Wagmi + Viem + Biconomy SDK），部署在 Vercel
  - `src/app/agent/` — Agent Wallet 主页面（唯一页面）
  - `src/components/AgentWalletSession.tsx` — 核心组件（Smart Account + Session Keys + Agent 执行）
  - `src/lib/contracts.ts` — 合约地址、Bundler URL 配置
  - `src/lib/wagmi.ts` — Wagmi 配置，Morph 主网/测试网链参数
  - `tests/` — Playwright 测试（mock MetaMask，17 个用例）
- `skills/etherscan/` — Etherscan V2 API CLI（跨链合约/账户查询）
- `skills/evm/` — 直接 RPC 链交互 CLI（无需 API key，15 条链）
- `skills/4337/` — ERC-4337 Account Abstraction CLI（Morph 主网专用）
- `contracts/erc4337/` — ERC-4337 v0.8 合约源码（EntryPoint、SimpleAccount 等）
- `contracts/eip8004/` — EIP-8004 Agent 身份/声誉合约 ABI (JSON)
- `research/` — 调研报告、功能分析文档、测试脚本

## Common Commands

### Web (Next.js)

```bash
cd web && npm install
npm run dev      # 开发服务器
npm run build    # 生产构建
npm run lint     # ESLint
npx playwright test  # 运行 Playwright 测试
```

### Deploy

```bash
cd web && vercel --prod --yes
```

### Python CLI Skills

```bash
# Etherscan API
python3 skills/etherscan/etherscan_api.py <command> [options]

# EVM 直接 RPC
python3 skills/evm/evm_api.py -c morph balance --address 0x...

# ERC-4337 专用
python3 skills/4337/aa_api.py contracts                    # 列出已部署合约
python3 skills/4337/aa_api.py account-address --owner 0x...  # 计算 Smart Account 地址
python3 skills/4337/aa_api.py balance --address 0x...       # 查询余额
python3 skills/4337/aa_api.py agent-info --agent-id 1       # 查询 Agent 身份
python3 skills/4337/aa_api.py agent-reputation --agent-id 1  # 查询声誉
```

Python skills 无外部依赖（标准库 + urllib）。

## Architecture

### Web App

单页面 Agent Wallet (`/agent`)，4 个 Tab：

1. **Setup** — 连接 MetaMask → 自动检测链（非 Morph 显示切链按钮）→ 创建 Biconomy SmartAccountV2 → 充值 ETH
2. **Sessions** — 创建 Session Key（链上 UserOp）：配置目标合约、函数白名单、过期时间
3. **Agent** — 用 Session Key 自主执行交易（无需 owner 签名），权限由链上 Session Key Manager 合约强制验证
4. **Security** — Smart Account 余额、活跃 Session 列表、已部署合约地址

技术栈：`@biconomy/account` v4.5.7 (Legacy V2) → EntryPoint v0.6.0 → Biconomy Bundler

关键文件：
- `web/src/components/AgentWalletSession.tsx` — 所有逻辑（~600 行）
- `web/src/lib/contracts.ts` — 合约地址 + Bundler URL
- `web/src/lib/wagmi.ts` — Morph 链定义
- `web/src/components/Providers.tsx` — Wagmi + React Query 包装

路径别名：`@/*` → `web/src/*`

### Session Key 工作原理

```
Owner 创建 Session（链上）:
  SDK 生成 session key EOA → 定义 policy → 发送 UserOp 启用 SessionKeyManager 模块 → 写入 Merkle Root

Agent 使用 Session（链下签名 + 链上验证）:
  session key 签名 UserOp + 附带 merkle proof → Bundler 提交 → EntryPoint → SessionKeyManager 验证权限 → 执行/拒绝
```

### Python CLI Skills

三个独立的单文件 CLI 工具，共享设计模式：子命令架构、JSON 输出。

- **etherscan_api.py** — Etherscan V2 API，16 条 EVM 链
- **evm_api.py** — 直接 RPC 调用，15 条链（含 Morph）
- **aa_api.py** — ERC-4337 专用，Morph 主网。Smart Account 地址计算、余额、nonce、gas 估算、Agent 身份查询

### Solidity Contracts

参考合约源码，**无 Hardhat/Foundry 构建配置**。
- `contracts/erc4337/core/EntryPoint.sol` — 核心编排合约（958 行），三阶段执行：验证→执行→结算
- `contracts/erc4337/accounts/SimpleAccount.sol` — ECDSA 单 owner 账户实现
- `contracts/erc4337/accounts/SimpleAccountFactory.sol` — CREATE2 确定性部署
- `contracts/erc4337/core/NonceManager.sol` — 并行 nonce 通道（192-bit key + 64-bit sequence）
- `contracts/erc4337/core/StakeManager.sol` — deposit（流动）vs stake（锁定）管理
- `contracts/erc4337/core/BasePaymaster.sol` — Paymaster 框架（validatePaymasterUserOp + postOp）

## Chain Info

| 网络 | Chain ID | RPC |
|------|----------|-----|
| Morph 主网 | 2818 | `https://rpc-quicknode.morph.network` |
| Morph Hoodi 测试网 | 2910 | `https://rpc-hoodi.morph.network` |

## Key Contracts (Morph Mainnet)

| 合约 | 地址 |
|------|------|
| EntryPoint v0.6.0 | `0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789` |
| SmartAccount Factory V2 | `0x000000a56Aaca3e9a4C479ea6b6CD0DbcB6634F5` |
| ECDSA Ownership Module | `0x0000001c5b32F37F5beA87BDD5374eB2Ac54eA8e` |
| Session Key Manager V1 | `0x000002FbFfedd9B33F4E7156F2DE8D48945E7489` |
| Batched Session Router | `0x00000D09967410f8C76752A104c9848b57ebba55` |
| ABI Session Validation | `0x000006bC2eCdAe38113929293d241Cf252D91861` |
| Verifying Paymaster V1.1 | `0x00000f79b7faf42eebadba19acc07cd08af44789` |
| Token Paymaster | `0x00000f7365cA6C59A2C93719ad53d567ed49c14C` |

## API Keys

- **Bundler API Key** — 内置在代码中（`nJPK7B3ru.dd7f7861-190d-41bd-af80-6877f74b8f44`），公开安全，仅标识项目路由
- **Paymaster API Key** — 可选，通过 `NEXT_PUBLIC_BICONOMY_PAYMASTER_KEY` 环境变量配置（Vercel 设置），泄露有资金风险
- Biconomy Bundler 仅支持 Morph 主网（2818），不支持测试网（2910）

## Testing

```bash
cd web
npx playwright test                          # 运行全部测试
npx playwright test tests/full-flow.spec.ts  # 完整流程测试（mock MetaMask，17 用例）
npx playwright test tests/wallet-flow.spec.ts # 钱包连接测试
```

测试使用注入式 mock MetaMask provider，覆盖：钱包连接/断开、链切换、Smart Account 创建、Tab 导航、Session 表单、移动端响应式、零 JS 错误。

## Safety Rules

- **必须在执行 send/transfer/swap/bridge 命令前确认用户意图**
- 私钥仅用于本地签名，不会发送到任何 API
- 金额使用人类可读单位（`0.1` = 0.1 ETH，不是 wei）
- Paymaster API Key 不可硬编码在代码中
