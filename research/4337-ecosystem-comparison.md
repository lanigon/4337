# ERC-4337 生态对比：Base vs Polygon vs Morph

> 2026-03-17 调研

---

## 1. 三条链的 AA 方案对比

| | Coinbase / Base | Polygon | Morph |
|---|---|---|---|
| **策略** | 全栈自研 | $250M 收购 Sequence | 依赖第三方 (Biconomy) |
| **AA 标准** | 标准 ERC-4337 | Sequence（非标准 4337） | ERC-4337 (Biconomy Legacy V2) |
| **Smart Account** | CoinbaseSmartWallet（自研开源） | Sequence Smart Contract Wallet | Biconomy SmartAccountV2 |
| **Bundler** | Coinbase 自建 | Sequence Relayer | Biconomy（已宕机 + deprecated） |
| **Paymaster** | Coinbase 自建（送 0.25 ETH credits） | Sequence 代付（USDC） | 无服务 |
| **Session Key** | 无（用 Passkey） | Sequence Smart Sessions | Biconomy SessionKeyManager |
| **Agent 工具** | AgentKit + x402 | Agent CLI + ERC-8004 + x402 | 无官方工具 |
| **自主可控** | 完全 | 完全 | 完全依赖第三方 |
| **稳定性** | 高（Coinbase 运维） | 高（Polygon + Sequence） | 低（Biconomy 已全面宕机） |

---

## 2. Coinbase / Base 的 4337 基础设施

### 2.1 架构

```
用户
  ↓ Passkey 登录（指纹/面部）
CoinbaseSmartWallet (ERC-4337)
  ↓ UserOp
Coinbase Bundler (官方)
  ↓ handleOps()
EntryPoint v0.6.0
  ↓
Base L2 执行
```

### 2.2 链上合约

| 合约 | 地址 | 说明 |
|------|------|------|
| CoinbaseSmartWallet Implementation | `0x000100abaad02f1cfC8Bbe32bD5a564817339E72` | 钱包逻辑合约 |
| CoinbaseSmartWalletFactory | `0x0BA5ED0c6AA8c49038F819E587E2633c4A9F428a` | CREATE2 工厂 |
| EntryPoint v0.6.0 | `0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789` | 标准 EntryPoint |

> 通过 Safe Singleton Factory 部署到 248 条 EVM 链，地址统一。**Morph 上也已部署。**

### 2.3 链下服务

| 服务 | 端点 | 说明 |
|------|------|------|
| Bundler + Paymaster (测试网) | `https://api.developer.coinbase.com/rpc/v1/base-sepolia/<api_key>` | 免费 |
| Bundler + Paymaster (主网) | `https://api.developer.coinbase.com/rpc/v1/base/<api_key>` | 免费 |
| API Key | Coinbase Developer Platform 注册 | 免费，自动送 0.25 ETH gas credits |

### 2.4 SDK

```bash
# 前端 SDK
npm install @base-org/account

# 或 CDN
<script src="https://unpkg.com/@base-org/account/dist/base-account.min.js"></script>
```

支持的 Smart Account 类型（Coinbase Bundler 全兼容）：
- SimpleAccount（标准 4337 参考实现）
- Safe（多签钱包）
- Kernel（ZeroDev）
- CoinbaseSmartWallet（Coinbase 自研）

支持的 SDK（5 种都能配合使用）：
- Alchemy `aa-core`
- Pimlico `permissionless.js`
- ZeroDev `@zerodev/sdk`
- Wagmi
- Viem

### 2.5 核心功能

- **Passkey 登录** — 指纹/面部识别，不需要 MetaMask
- **USDC 一键支付** — `window.base.pay({ amount, to })`
- **Gasless 交易** — Paymaster 赞助，开发者送 0.25 ETH credits
- **跨链统一地址** — 9 条主网链同一个 Smart Account 地址
- **x402 微支付** — Agent 按请求付费调 API，不需要 API key
- **AgentKit** — AI Agent 开发框架，与 LangChain 等集成

### 2.6 文档链接

- Account Abstraction 概述: https://docs.base.org/chain/account-abstraction
- Smart Wallet 快速开始: https://docs.base.org/identity/smart-wallet/quick-start
- Smart Wallet 合约源码: https://github.com/coinbase/smart-wallet
- Bundler + Paymaster 示例: https://github.com/coinbase/paymaster-bundler-examples
- AgentKit: https://github.com/coinbase/agentkit
- x402 协议: https://www.x402.org/

---

## 3. Polygon 的 AA 基础设施

### 3.1 架构

```
AI Agent
  ↓ polygon-agent CLI
Sequence Smart Contract Wallet
  ↓ Session-scoped transaction
Sequence Relayer（非标准 4337 Bundler）
  ↓ Meta-transaction
Polygon PoS 执行
```

> Polygon 没有使用标准 ERC-4337 流程。虽然文档提到 ERC-4337，但实际产品用的是 Sequence 的 AA 方案。

### 3.2 核心组件

**Sequence 钱包基础设施（$250M 收购）：**
- Smart Contract Wallet — 多签智能合约钱包
- Relayer — 类似 Bundler 但不走 EntryPoint，直接 meta-transaction
- Indexer — 余额/交易历史查询
- Smart Sessions — 权限隔离，per-app session scope

**Polygon 自建工具：**
- Agent CLI (`@polygonlabs/agent-cli`) — AI Agent 链上操作工具
- Trails — DEX 聚合 + 跨链桥接路由层
- ERC-8004 — Agent 身份 + 声誉标准（联合 MetaMask、Google、Coinbase 起草）

### 3.3 Agent CLI

```bash
# 安装
npm install -g @polygonlabs/agent-cli

# 或作为 Claude Code skill
npx skills add https://github.com/0xPolygon/polygon-agent-cli
```

核心命令：
```bash
polygon-agent setup --name "MyAgent"          # 初始化
polygon-agent wallet create                   # 创建 session-scoped 钱包
polygon-agent fund                            # 充值
polygon-agent balances                        # 查余额
polygon-agent send --symbol USDC --to 0x... --amount 10 --broadcast
polygon-agent swap --from USDC --to USDT --amount 5 --broadcast
polygon-agent agent register --name "MyAgent" --broadcast   # ERC-8004 注册
polygon-agent agent reputation --agent-id 1                 # 查声誉
```

### 3.4 Session 钱包安全模型

```
CLI 端:
  ├── 生成 NaCl 密钥对
  ├── 启动 local HTTP server + cloudflared 隧道
  └── 构造审批 URL（带 spending limit、contract whitelist）

浏览器 Connector UI:
  ├── 用户连接 Sequence Ecosystem Wallet
  ├── 审批 session 权限
  └── NaCl sealed-box 加密 session 凭证回传

CLI 端:
  ├── 解密保存到 ~/.polygon-agent/wallets/
  └── AES-256-GCM 加密存储

安全特性:
  ├── 私钥永远不进 LLM context（防 prompt injection）
  ├── Per-token spending limit
  ├── Contract whitelist
  ├── 24h session 过期
  └── 默认 dry-run（--broadcast 才真发）
```

### 3.5 ERC-8004 Agent 身份

```
IdentityRegistry (0x8004A169...):
  ├── register(name) → 铸造 Agent NFT
  ├── 链上可验证身份
  └── 跨 Agent/服务可发现

ReputationRegistry (0x8004BAa1...):
  ├── feedback(agentId, score) → 提交评分
  ├── reputation(agentId) → 查询聚合声誉
  └── 支持按维度（tag）筛选
```

### 3.6 支付

- **全链路 USDC** — Agent 不需要持有 gas token，全部用 USDC 结算
- **Gas 抽象** — Sequence Relayer 代付 gas，从 USDC 扣除
- **x402 协议** — HTTP 402 微支付，按请求付费调 API

### 3.7 文档链接

- ERC-4337 概述: https://docs.polygon.technology/pos/concepts/transactions/eip-4337/
- Agent CLI 博客: https://polygon.technology/blog/polygon-launches-an-onchain-toolkit-built-for-the-agent-economy
- Agent CLI 源码: https://github.com/0xPolygon/polygon-agent-cli
- Agent CLI 文档: https://docs.polygon.technology/payment-services/agentic-payments/polygon-agent-cli/
- Sequence 文档: https://docs.sequence.xyz
- Sequence 钱包架构: https://polygon.technology/blog/how-sequence-makes-non-custodial-smart-wallets-practical-for-production-payments

---

## 4. Morph 的现状

### 4.1 已有的

```
链上合约:
  ✅ EntryPoint v0.6.0 + v0.7.0（官方标准，所有 EVM 链都有）
  ✅ Biconomy SmartAccountV2 全套（9 个合约）
  ✅ CoinbaseSmartWallet + Factory（CREATE2 自动部署）
  ✅ ERC-8004 IdentityRegistry + ReputationRegistry

链下服务:
  ❌ Bundler — Biconomy 已全面宕机 + deprecated
  ❌ Paymaster — 无服务
  ❌ 官方 AA 工具 — 无
```

### 4.2 缺少的

| 缺失 | Base 怎么解决的 | Polygon 怎么解决的 |
|------|----------------|-------------------|
| Bundler 服务 | Coinbase 自建 | Sequence Relayer |
| Paymaster 服务 | Coinbase 自建 + 免费 credits | Sequence 代付 |
| Agent 工具 | AgentKit | Agent CLI |
| 身份系统 | Passkey | ERC-8004 |
| 支付协议 | x402 | x402 + USDC |

### 4.3 可选方案

**方案 A：找替代 Bundler（最快）**
```
保留现有 Biconomy 合约
  → 换 Pimlico / Alchemy 的 Bundler（需确认是否支持 Morph）
  → 改一个 URL 就行
```

**方案 B：用 Coinbase 合约（已在 Morph 上）**
```
CoinbaseSmartWallet 已在 Morph 部署
  → 配 Pimlico Bundler
  → 用 Coinbase 的 SDK
  → 但 Coinbase Bundler 不一定支持 Morph
```

**方案 C：自建 Bundler（完全自主）**
```
用 eth-infinitism 开源 bundler
  → github.com/eth-infinitism/bundler
  → 自己跑节点，指向 Morph RPC
  → 配合任意 Smart Account 合约
  → 工作量大但不依赖任何第三方
```

**方案 D：付费让 Biconomy 升级（官方方案）**
```
$2500/月
  → Biconomy 部署 Nexus/MEE 合约
  → Biconomy 提供 Bundler + Paymaster 服务
  → 1 周集成
```

---

## 5. 4337 服务商全景

| 服务商 | Bundler | Paymaster | Smart Account | Session Key | 开源 |
|--------|:-------:|:---------:|:-------------:|:-----------:|:----:|
| **Coinbase** | ✅ 自建 | ✅ 免费 credits | CoinbaseSmartWallet | ❌ | ✅ |
| **Pimlico** | ✅ Alto | ✅ | 不提供（兼容所有） | ❌ | ✅ |
| **Alchemy** | ✅ Rundler | ✅ | Light Account | ❌ | ✅ |
| **Biconomy** | ⚠️ 宕机 | ⚠️ | SmartAccountV2 / Nexus | ✅ | ✅ |
| **ZeroDev** | 用别家 | ✅ | Kernel | ✅ | ✅ |
| **Stackup** | ✅ 自托管 | ✅ | 不提供 | ❌ | ✅ |
| **Sequence** | ✅ Relayer | ✅ | Sequence Wallet | ✅ | 部分 |

> Bundler 可以混搭任意 Smart Account（共享同一个 EntryPoint），但 Paymaster 和 Session Key 模块通常与特定 Smart Account 绑定。

---

## 6. ERC-4337 官方标准合约

全链统一地址（CREATE2 确定性部署）：

| 合约 | 地址 | 说明 |
|------|------|------|
| **EntryPoint v0.6.0** | `0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789` | 当前主流版本 |
| **EntryPoint v0.7.0** | `0x0000000071727De22E5E9d8BAf0edAc6f37da032` | 最新版本 |

> 这是 ERC-4337 标准唯一要求统一的合约。由 [eth-infinitism](https://github.com/eth-infinitism/account-abstraction) 部署和维护。所有 Bundler、所有 Smart Account、所有 Paymaster 共用同一个 EntryPoint。
