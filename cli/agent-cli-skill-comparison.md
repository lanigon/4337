# Agent CLI / Skill 对比分析：6 大公链项目

> 2026-03-24 调研 | 源码目录：`/cli/`

---

## 目录

1. [总览](#1-总览)
2. [架构对比](#2-架构对比)
3. [私钥安全处理](#3-私钥安全处理)
4. [钱包类型：Smart Account vs EOA](#4-钱包类型smart-account-vs-eoa)
5. [命令与功能覆盖](#5-命令与功能覆盖)
6. [独有功能](#6-独有功能)
7. [跨链能力](#7-跨链能力)
8. [AI Agent 集成方式](#8-ai-agent-集成方式)
9. [交易安全机制](#9-交易安全机制)
10. [API 与依赖](#10-api-与依赖)
11. [成熟度评估](#11-成熟度评估)
12. [对 Morph 4337 项目的启示](#12-对-morph-4337-项目的启示)

---

## 1. 总览

| 项目 | 维护方 | 语言 | 代码量 | 命令/工具数 | 链支持 | 钱包类型 |
|------|--------|------|--------|-------------|--------|----------|
| **Polygon Agent CLI** | Polygon Labs | TypeScript | 多模块 ~2000 行 | ~15 命令 | Polygon 为主 | Smart Account (Sequence) |
| **Bitget Agent Hub** | Bitget | TS + Python | monorepo ~3000 行 | 36 MCP tools | 32+ (market) / 8 (swap) | EOA (BIP-39) |
| **OKX OnchainOS** | OKX | TypeScript | Skill 包 | 11 Skills | 20+ | EOA + MPC |
| **Coinbase AgentKit** | Coinbase | TypeScript | ~300 行(可用) | 6 (5 个 stub) | 多链 (Viem) | EOA |
| **Coinbase Agentic Wallet** | Coinbase | Bash (awal CLI) | Skill 文件 | ~9 | Base + Morph | Smart Account (Biconomy) |
| **Morph Skill** | Morph | Python | 单文件 1382 行 | 30+ | 6 (bridge) | EOA |

**源码位置**：

```
cli/
├── polygon/          # 13 文件，TypeScript
├── bitget/           # 9 文件，TS + Python
├── okx/              # 8 文件，TypeScript
├── base-agentkit/    # 8 文件，TypeScript
├── base-agentic-wallet/  # 7 文件，Skill .md
└── morph/            # 11 文件，Python
```

---

## 2. 架构对比

### Polygon Agent CLI — 多模块 + Session 管理

```
index.ts (yargs 入口)
├── commands/
│   ├── setup.ts      → 生成 EOA + Builder 项目 + 加密存储
│   ├── wallet.ts     → Sequence session-scoped 钱包（create/import/list/remove）
│   ├── agent.ts      → ERC-8004 身份注册/声誉查询
│   └── operations.ts → send/swap/deposit/fund/x402-pay
├── lib/
│   ├── storage.ts    → AES-256-GCM 加密读写
│   ├── dapp-client.ts → Sequence DappClient 状态同步
│   ├── ethauth.ts    → EIP-712 签名 + Bearer token
│   └── utils.ts      → 随机名称生成
```

**特点**：模块化最好，职责分离清晰。双层钱包模型（Builder EOA + Sequence Smart Account）。

### Bitget Agent Hub — pnpm Monorepo

```
agent-hub/
├── bitget-client (bgc)     → CLI 工具，JSON 输出
├── bitget-skill            → 交易 Skill（BIP-39 钱包 + gasless swap）
├── bitget-skill-hub        → 5 个市场分析 Skill
└── bitget-mcp-server       → 原生 MCP server（36 tools）
```

**特点**：组件化程度最高，MCP server 是独立包，可单独部署。

### OKX OnchainOS — Skill 包集合

```
onchainos-skills/
└── skills/
    ├── okx-agentic-wallet    → 钱包 + 发送 + 合约调用
    ├── okx-wallet-portfolio  → 余额 + 持仓 + PnL
    ├── okx-security          → 风险检测 + 钓鱼检测 + 预执行
    ├── okx-dex-market        → 实时价格 + K 线
    ├── okx-dex-signal        → 鲸鱼/KOL 信号
    ├── okx-dex-trenches      → Meme 币扫描 + Bundle 检测
    ├── okx-dex-token         → Token 搜索 + 排名
    ├── okx-dex-swap          → 500+ 流动性源聚合
    ├── okx-onchain-gateway   → Gas 估算 + 模拟 + 广播
    ├── okx-x402-payment      → TEE x402 支付
    └── okx-audit-log         → 审计日志
```

**特点**：Skill 数量最多（11 个），覆盖面最广（从交易到情报到安全）。

### Coinbase AgentKit — 底层库

```
agentkit/
├── viemWalletProvider.ts   → Viem WalletClient 封装（唯一完整文件）
├── cdpWalletProvider.ts    → CDP SDK 钱包（stub）
├── transfer.ts             → 转账动作（stub）
├── deploy_contract.ts      → 部署合约（stub）
├── get_balance.ts          → 查余额（stub）
└── trade.ts                → 交易（stub）
```

**特点**：定位是库而非 CLI，需要上层框架（LangChain/CrewAI）包装。5/6 文件是 stub。

### Coinbase Agentic Wallet — Skill 文件 + awal CLI

```
base-agentic-wallet/
├── skills-auth-SKILL.md     → Email OTP 认证
├── skills-balance-SKILL.md  → 余额查询
├── skills-send-SKILL.md     → USDC 转账
├── skills-trade-SKILL.md    → Token swap（Base 网络）
└── SKILL.md                 → 主 Skill 入口
```

**特点**：纯文档驱动，通过 `npx awal@2.0.3 <command>` 调用外部 CLI。自身不包含实现代码。

### Morph Skill — 单文件 Python

```
morph/
├── scripts-morph_api.py     → 1382 行，全部逻辑
├── SKILL.md                 → 统一 Agent 参考
├── skills-morph-wallet-SKILL.md
├── skills-morph-explorer-SKILL.md
├── skills-morph-dex-SKILL.md
├── skills-morph-bridge-SKILL.md
└── skills-morph-altfee-SKILL.md
```

**特点**：零架构开销，一个文件做所有事。优点是部署极简，缺点是维护性差。

---

## 3. 私钥安全处理

### 安全等级排名

```
⭐⭐⭐⭐⭐ Polygon    — 加密存储 + 加密传输 + 时效管理
⭐⭐⭐⭐   Bitget     — 助记词持久化，私钥用完即弃
⭐⭐⭐⭐   Base Agentic — 本地加密 + Session Key 链上验证
⭐⭐⭐     AgentKit   — 内存持有，本地签名
⭐⭐⭐     OKX        — API Key 托管，沙箱 key 共享
⭐⭐       Morph      — CLI 参数明文传递
```

### 详细对比

#### Polygon（最安全）

```
存储层:
  ~/.polygon-agent/.encryption-key   → 32 字节随机密钥（mode 0o600）
  ~/.polygon-agent/builder.json      → AES-256-GCM 加密的 EOA 私钥
  ~/.polygon-agent/state/            → AES-256-GCM 加密的 session 状态

传输层:
  用户审批 → NaCl sealed-box 加密 → CLI 解密
  公钥 base64url 展示在审批 URL
  私钥 base64url 存在 requests/{rid}.json（2h 过期自动清理）

运行时:
  私钥只在内存中存在（签名时解密 → 签名 → 丢弃）
  所有目录 mode 0o700，文件 mode 0o600
```

#### Bitget（用完即弃模型）

```
存储层:
  助记词 → 安全持久化存储（具体加密方式未公开）
  私钥永不持久化

运行时:
  BIP-39 助记词 → BIP-44 推导私钥
  私钥写入 mktemp 临时文件
  签名工具读取 → 签名 → 立即删除临时文件
  整个生命周期: 推导 → 写临时文件 → 签名 → 删除（秒级）

安全特性:
  - 永不通过 CLI 参数传递私钥
  - 临时文件而非管道/参数（避免 ps aux 泄露）
  - EVM + Solana 双链私钥推导（同一助记词）
```

#### Morph（最弱）

```
传递方式:
  python3 morph_api.py transfer --private-key 0xABC123...

安全风险:
  1. shell history（~/.zsh_history）永久记录
  2. ps aux 进程列表实时可见
  3. 无加密存储机制
  4. 无临时文件中转

签名本身是安全的:
  eth_account.Account.from_key() → sign_transaction() → 本地签名
  但密钥在到达签名函数之前已经泄露在多个地方
```

### 修复建议（针对 Morph）

```
方案 1（最小改动）: 环境变量
  export MORPH_PRIVATE_KEY=0x...
  python3 morph_api.py transfer  # 自动从 env 读取

方案 2（推荐）: 加密文件存储（参考 Polygon）
  morph_api.py wallet import --private-key 0x...  # 一次性导入，加密存储
  morph_api.py transfer --wallet main              # 后续用名称引用

方案 3（最安全）: 用完即弃（参考 Bitget）
  morph_api.py wallet create  # 生成助记词，安全存储
  morph_api.py transfer       # 动态推导私钥，签名后丢弃
```

---

## 4. 钱包类型：Smart Account vs EOA

### Smart Account 路线（2 个项目）

#### Polygon — Sequence 智能合约钱包

```
架构:
  EOA (Builder) ──setup──→ Sequence Builder API → 获取 JWT + Access Key
                                                     ↓
  用户 ──wallet create──→ Sequence Ecosystem Wallet → 审批 session
                                                     ↓
                          Sequence Smart Account ←── session-scoped 权限

权限模型:
  ├── 合约白名单（--contract 0x...）
  ├── Token spending limit（--usdc-limit 50）
  ├── Native spending limit（--native-limit 1.0）
  └── 24h session 过期

交易执行:
  CLI → DappClient → Sequence Relayer（非 ERC-4337 Bundler）→ Polygon PoS

非标准 AA:
  不走 EntryPoint，不用 UserOp
  用 Sequence 自己的 meta-transaction 方案
  Relayer 代付 gas，从 USDC 扣除
```

#### Base Agentic — Biconomy SmartAccountV2

```
架构:
  awal auth login → 创建/恢复 Smart Account
                           ↓
  awal trade/send → Session Key 签名 → Biconomy Bundler → EntryPoint v0.6.0

权限模型:
  ├── SessionKeyManager 模块（链上 Merkle root）
  ├── ABI Session Validation Module（函数级白名单）
  ├── Batched Session Router（批量操作）
  └── Merkle proof 验证

标准 ERC-4337:
  EOA → SmartAccountV2 → SessionKeyManager → EntryPoint → 链上执行
```

### EOA 路线（4 个项目）

| 项目 | EOA 来源 | 签名方式 | 特殊能力 |
|------|----------|----------|----------|
| **Bitget** | BIP-39/44 助记词推导 | ECDSA (EVM) + Ed25519 (Solana) | EIP-7702 gasless swap |
| **OKX** | API Key 托管 / 可选 MPC | 服务端签名 | 交易预执行模拟 |
| **AgentKit** | Viem WalletClient | ECDSA 本地签名 | Gas 乘数配置 |
| **Morph** | CLI 参数传入 | eth_account 本地签名 | 0x7f alt-fee 签名 |

### Smart Account vs EOA 取舍

```
Smart Account 优势:
  ✅ 权限隔离 — Agent 只能在授权范围内操作
  ✅ 无需 owner 在线 — Session Key 自主执行
  ✅ 可升级/可恢复 — 合约逻辑可替换
  ✅ 批量操作 — 一笔交易多个 call
  ❌ 创建成本 — 需要链上部署（gas 费）
  ❌ 依赖基础设施 — Bundler/Paymaster/Relayer
  ❌ 复杂度 — Session Key 配置容易出错（AA23）

EOA 优势:
  ✅ 零部署成本 — 随时可用
  ✅ 无依赖 — 直接 RPC 广播
  ✅ 简单 — 签名→发送，两步完成
  ❌ 全权限 — 私钥泄露 = 全部资产丢失
  ❌ 无权限隔离 — Agent 拥有和 owner 完全相同的权限
  ❌ 不可恢复 — 私钥丢失 = 永久丢失
```

---

## 5. 命令与功能覆盖

### 功能矩阵

| 功能 | Polygon | Bitget | OKX | AgentKit | Agentic | Morph |
|------|:-------:|:------:|:---:|:--------:|:-------:|:-----:|
| **钱包创建** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **余额查询** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **ETH 转账** | ✅ | ✅ | ✅ | stub | ✅ | ✅ |
| **ERC20 转账** | ✅ | ✅ | ✅ | stub | ✅ | ✅ |
| **DEX Swap** | ✅ Trails | ✅ gasless | ✅ 500+源 | stub | ✅ Base | ✅ Bulbaswap |
| **跨链 Bridge** | ✅ Trails | ✅ 一步签名 | ✅ | ❌ | ✅ | ✅ Bulbaswap |
| **合约部署** | ❌ | ❌ | ❌ | stub | ❌ | ❌ |
| **合约调用** | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Explorer 查询** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ Blockscout |
| **Token 搜索** | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ |
| **K 线数据** | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **安全审计** | ❌ | ✅ 蜜罐/税率 | ✅ 钓鱼/预执行 | ❌ | ❌ | ❌ |
| **鲸鱼追踪** | ❌ | ❌ | ✅ KOL/Smart Money | ❌ | ❌ | ❌ |
| **DeFi 存款** | ✅ Aave/Morpho | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Agent 身份** | ✅ ERC-8004 | ❌ | ❌ | ❌ | ❌ | ❌ |
| **x402 支付** | ✅ | ✅ EIP-3009 | ✅ TEE | ❌ | ✅ | ❌ |
| **Alt-Fee (ERC20 gas)** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ 0x7f |
| **Tx 详情/回执** | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ |

---

## 6. 独有功能

### Polygon — Agent 经济基础设施

```
1. ERC-8004 Agent 身份:
   agent register --name "MyBot" --broadcast
   agent reputation --agent-id 1
   agent feedback --agent-id 1 --score 5

   → 链上 NFT 身份 + 声誉积分
   → 跨 Agent 可发现、可验证
   → 合约: IdentityRegistry (0x8004A169...) + ReputationRegistry (0x8004BAa1...)

2. DeFi Yield:
   deposit --pool aave-weth --amount 0.1 --broadcast
   deposit --pool morpho-usdc --amount 100 --broadcast

   → Aave v3 supply() + Morpho deposit()
   → APY 查询 + 自动 approve + deposit

3. x402 微支付:
   x402-pay --url https://api.example.com/data --max-amount 0.5
   → HTTP 402 自动协商 → USDC 支付 → 获取数据

4. Cloudflared 隧道:
   wallet create 时自动下载 cloudflared
   → 创建临时公网 URL 用于钱包审批回调
   → 超时/完成后自动关闭隧道
```

### Bitget — 交易情报 + Gasless

```
1. Gasless Swap (EIP-7702):
   → 零 native token 余额也能交易
   → Gas 从输入 token 中扣除
   → 适用于新钱包首次交易

2. Meme 币安全审计:
   token-security --chain base --address 0x...
   → 蜜罐检测（honeypot）
   → 买卖税率分析（buy/sell tax）
   → 代理合约检测（proxy contract）
   → Mint 权限检测
   → 风险等级评分

3. 开发者行为分析:
   token-dev --chain base --address 0x...
   → Rug pull 历史
   → LP 锁定状态
   → 迁移行为追踪

4. K 线数据:
   token-kline --chain base --address 0x... --interval 1h
   → OHLC + 买卖量分拆
   → 1m/5m/1h/4h/1d 周期
```

### OKX — 市场情报网络

```
1. Smart Money 追踪:
   dex-signal → 鲸鱼买入/卖出信号
   → KOL 持仓变化
   → 排行榜（PnL、胜率、ROI）

2. Meme Trenches 扫描:
   dex-trenches → pump.fun / four.meme 新币监控
   → Bundle 检测（夹子机器人识别）
   → 开发者声誉评分

3. 持仓人群聚类:
   dex-token → 持有者聚类分析
   → Top trader 行为模式
   → 资金流向可视化

4. 交易预执行:
   security → tx 模拟执行
   → 签名安全检查
   → DApp 钓鱼检测
   → 授权管理（revoke）

5. TEE x402 支付:
   x402-payment → 可信执行环境签名
   → 私钥隔离在 TEE 内
   → 比标准 EIP-3009 多一层硬件安全
```

### Morph — L2 原生能力

```
1. Alt-Fee 0x7f 交易:
   altfee-tokens    → 查询支持的 fee token（ID 1-5）
   altfee-estimate  → 计算所需 fee 数量
   altfee-send      → 用 ERC20 代替 ETH 付 gas

   技术细节:
   - Morph 自定义交易类型 0x7f
   - 自实现 RLP 编码器
   - 字段: [chainId, nonce, ..., feeTokenID, feeLimit, (v, r, s)]
   - TokenRegistry 合约: 0x5300000000000000000000000000000000000021
   - 费用计算: ceil((gasFeeCap × gasLimit + L1DataFee) × tokenScale / feeRate) × 1.1

2. Blockscout Explorer 全量接口:
   address-info / address-txs / address-tokens
   tx-detail / token-search / contract-info
   token-transfers / token-info / token-list

   → 9 个 Explorer 命令，其他项目都没有
   → 直接查链上数据，无需 Etherscan API key

3. 双 USDT/USDC 处理:
   USDT0  (0xe7cd...) vs USDT.e (0xc7D6...)
   USDC   (0xCfb1...) vs USDC.e (0xe34c...)

   → Agent 遇到歧义必须让用户选择
```

---

## 7. 跨链能力

| 项目 | 方案 | 支持链 | 一步操作 | 鉴权 |
|------|------|--------|----------|------|
| **Bitget** | 原生跨链 swap | 8+ (EVM + Solana) | ✅ 单次签名完成 | Token-based |
| **OKX** | DEX 聚合 500+ 源 | 20+ | ✅ | API Key |
| **Polygon** | Trails 意图路由 | 多链 | ✅ quote→commit→execute | Access Key |
| **Morph** | Bulbaswap Bridge | 6 (Morph/ETH/Base/BNB/Arb/Polygon) | ✅ bridge-swap | JWT (EIP-191) |
| **Base Agentic** | Bridge Skill | 2 (Base + Morph) | ❌ 手动多步 | JWT |
| **AgentKit** | 无原生跨链 | — | — | — |

### Morph Bridge 工作流

```
Step 1: bridge-login --private-key 0x...
  → EIP-191 签名: "Welcome to Bulba. ... Timestamp: {ts}"
  → 返回 JWT (24h 有效)

Step 2: bridge-quote --from-chain morph --from-token USDT.e \
                     --to-chain base --to-token USDC --amount 10
  → 返回: 报价、路由、最小输出、手续费

Step 3: bridge-swap --jwt <JWT> --private-key 0x... \
                    --from-chain morph --from-token USDT.e \
                    --to-chain base --to-token USDC --amount 10
  → 内部: make-order → 签名所有 tx → submit-order
  → 返回: orderId

Step 4: bridge-order --jwt <JWT> --order-id abc123
  → 返回: 订单状态（pending/completed/failed）
```

---

## 8. AI Agent 集成方式

### 集成标准对比

| 项目 | Claude Plugin | Cursor Plugin | MCP Server | SKILL.md | LangChain/CrewAI |
|------|:------------:|:-------------:|:----------:|:--------:|:----------------:|
| **Polygon** | ✅ | ✅ | ❌ | ✅ | 需包装 |
| **Bitget** | ✅ | ✅ | ✅ 原生 | ✅ 6 个 | 需包装 |
| **OKX** | ✅ | ✅ | ✅ CLI 双用 | ✅ 11 个 | 需包装 |
| **Morph** | ✅ | ✅ | ❌ | ✅ 5+1 个 | 需包装 |
| **Base Agentic** | ❌ | ❌ | ❌ | ✅ 4+1 个 | 需包装 |
| **AgentKit** | ❌ | ❌ | ❌ | ❌ | ✅ 原生 Tool |

### SKILL.md 设计模式

所有项目的 SKILL.md 都遵循类似结构：

```yaml
---
name: skill-name
version: 1.0.0
description: 一行描述（用于 Agent 路由匹配）
---

# 激活触发器
当用户提到 X / Y / Z 时激活本 Skill

# 可用命令
command-name --arg1 value --arg2 value

# 输出格式
{"success": true, "data": {...}}

# 安全规则
- 发送前必须确认
- 金额用人类可读单位

# 常见工作流
1. 先查余额 → 2. 获取报价 → 3. 确认 → 4. 执行
```

### Bitget MCP Server（最完整的 MCP 实现）

```typescript
// bitget-mcp-server
// 36 tools (spot 13 + futures 14 + account 8 + agent 1)

// 安装方式:
claude mcp add -s user \
  --env BITGET_API_KEY=key \
  --env BITGET_SECRET_KEY=secret \
  --env BITGET_PASSPHRASE=passphrase \
  bitget -- npx -y bitget-mcp-server

// 安全特性:
--read-only     // 禁用所有写操作
--modules spot  // 只加载现货模块（适配 Cursor 40 tool 限制）
```

---

## 9. 交易安全机制

### Dry-run / 确认机制

| 项目 | 默认 dry-run | 确认方式 | 强制手段 |
|------|:------------:|----------|----------|
| **Polygon** | ✅ `--broadcast` | SKILL.md 要求 Agent 确认 | CLI 级别：无 broadcast 不执行 |
| **Bitget** | ✅ | MCP `--read-only` 禁写 | Server 级别：工具不可用 |
| **OKX** | — | 预执行模拟 | 模拟失败阻止广播 |
| **Base Agentic** | — | SKILL 白名单 `allowed-tools` | SKILL 级别：只允许指定命令 |
| **Morph** | ❌ 直接执行 | SKILL.md 文档要求 | 无技术强制 |
| **AgentKit** | ❌ 直接执行 | 无 | 无 |

### 输入验证

| 项目 | 地址验证 | 金额验证 | 注入防护 |
|------|:--------:|:--------:|:--------:|
| **Polygon** | ✅ | ✅ Decimal | ✅ |
| **Bitget** | ✅ | ✅ 人类可读 | ✅ |
| **OKX** | ✅ | ✅ | ✅ |
| **Base Agentic** | ✅ regex | ✅ regex | ✅ Shell 元字符拒绝 |
| **Morph** | ✅ `0x + 40 hex` | ✅ Decimal | ❌ 无特殊防护 |
| **AgentKit** | ✅ Viem 类型检查 | ✅ BigInt | ❌ |

---

## 10. API 与依赖

### 外部依赖对比

| 项目 | 核心依赖 | 依赖数量 | 包管理 |
|------|----------|----------|--------|
| **Polygon** | ethers, viem, @0xsequence/*, tweetnacl, @x402/fetch | 重量级 | pnpm |
| **Bitget** | eth_account (Python), Commander.js (TS) | 中等 | pnpm + pip |
| **OKX** | onchainos CLI | 轻量 | npm |
| **AgentKit** | viem, @coinbase/cdp-sdk, ethers | 中等 | npm |
| **Base Agentic** | awal CLI (外部二进制) | 最轻 | npx |
| **Morph** | requests, eth_account, eth_keys | 轻量 | pip |

### API 端点

| 项目 | 链 RPC | Explorer | DEX | Bridge | 其他 |
|------|:------:|:--------:|:---:|:------:|:----:|
| **Polygon** | Sequence Nodes | ❌ | Trails API | Trails | Builder API, Indexer, Relayer |
| **Bitget** | copenapi.bgwapi.io | ❌ | Bitget Agent API | Bitget Agent API | K 线、安全审计 |
| **OKX** | OKX Gateway | ❌ | OKX DEX Aggregator | OKX Gateway | 信号、Trenches |
| **AgentKit** | 自配 RPC | ❌ | ❌ | ❌ | CDP API |
| **Base Agentic** | awal 内置 | ❌ | awal trade | awal bridge | x402 Bazaar |
| **Morph** | rpc.morph.network | ✅ Blockscout v2 | Bulbaswap v2 | Bulbaswap v2 | TokenRegistry |

---

## 11. 成熟度评估

### 综合评分

| 维度 | Polygon | Bitget | OKX | AgentKit | Agentic | Morph |
|------|:-------:|:------:|:---:|:--------:|:-------:|:-----:|
| 代码质量 | 9 | 8 | 7* | 6 | 5 | 7 |
| 安全性 | 10 | 9 | 7 | 5 | 8 | 4 |
| 功能覆盖 | 8 | 9 | 10 | 2 | 6 | 8 |
| Agent 集成 | 9 | 10 | 9 | 3 | 6 | 8 |
| 文档质量 | 8 | 9 | 7 | 7 | 5 | 8 |
| 可维护性 | 9 | 8 | 7 | 4 | 5 | 5 |
| **总分** | **53** | **53** | **47** | **27** | **35** | **40** |

> *OKX 部分 Skill 文档 404，扣分

### 成熟度排序

```
Tier 1 (生产级):
  🥇 Polygon Agent CLI — 最完整的 Agent 经济基础设施
  🥇 Bitget Agent Hub  — 最强交易工具 + MCP 标杆

Tier 2 (可用):
  🥉 OKX OnchainOS    — 情报覆盖最广，但文档不全
  🥉 Morph Skill       — L2 原生功能完整，但安全性弱

Tier 3 (早期):
     Base Agentic      — 概念好（SA + x402），实现薄
     Base AgentKit     — 底层库，非 CLI/Skill
```

---

## 12. 对 Morph 4337 项目的启示

### 我们的差异化价值

6 个项目中 **没有一个** 支持标准 ERC-4337 操作。我们的 `skills/4337/aa_api.py` 是唯一的 4337 专用工具。

```
其他项目都不做的事（我们的机会）:
  ✅ Smart Account 地址计算（CREATE2 确定性）
  ✅ UserOp 构建和估算
  ✅ EntryPoint 交互（deposit/stake/nonce）
  ✅ Session Key 管理（创建/验证/吊销）
  ✅ Paymaster 集成
  ✅ ERC-8004 Agent 身份查询（已实现）
```

### 需要改进的方面

| 问题 | 参考方案 | 优先级 |
|------|----------|--------|
| 私钥以 CLI 参数传递 | Bitget 临时文件模式 或 Polygon 加密存储 | **P0** |
| 无 SKILL.md Plugin 配置 | 参考 Morph Skill / Bitget 的 `.claude-plugin` | P1 |
| 无 dry-run 机制 | 参考 Polygon 的 `--broadcast` 模式 | P1 |
| 无 MCP Server | 参考 Bitget 的 `bitget-mcp-server` | P2 |
| 无跨链能力 | 专注 Morph 4337 是正确的定位 | 不需要 |
| 无市场数据 | 不是我们的定位 | 不需要 |

### 建议的演进路径

```
Phase 1 — 安全加固（立即）:
  - 私钥改为环境变量读取（MORPH_PRIVATE_KEY）
  - 加 --broadcast 确认机制
  - 加输入验证（地址、金额、token）

Phase 2 — Skill 化（1-2 天）:
  - 添加 SKILL.md（参考 Morph Skill 格式）
  - 添加 .claude-plugin/plugin.json
  - 添加 .cursor-plugin/plugin.json
  - 拆分为 2-3 个 Sub-skill（钱包、4337、Agent 身份）

Phase 3 — 功能完善（取决于 Bundler）:
  - UserOp 构建和提交（等 Bundler 恢复/自建）
  - Session Key 全生命周期管理
  - Paymaster 集成

Phase 4 — MCP Server（可选）:
  - 参考 Bitget 实现原生 MCP Server
  - 支持 Claude Code / Cursor / Codex 直接调用
```

---

## 附录：本地源码目录

```
/Users/bergtatt/morph_ai/4337/cli/
├── polygon/                    # Polygon Agent CLI
│   ├── index.ts               # yargs 入口
│   ├── setup.ts               # Builder 初始化
│   ├── wallet.ts              # Sequence 钱包管理
│   ├── agent.ts               # ERC-8004 身份
│   ├── operations.ts          # send/swap/deposit/x402
│   ├── storage.ts             # AES-256-GCM 加密存储
│   ├── dapp-client.ts         # Sequence 状态同步
│   ├── ethauth.ts             # EIP-712 认证
│   ├── utils.ts               # 工具函数
│   ├── SKILL.md               # Agent 参考文档
│   ├── QUICKSTART.md          # 快速开始
│   ├── claude-plugin.json     # Claude Code 插件
│   └── cursor-plugin.json     # Cursor 插件
│
├── bitget/                    # Bitget Agent Hub
│   ├── src-index.ts           # CLI 入口
│   ├── src-commands-index.ts  # 命令注册
│   ├── src-mcp-server.ts      # MCP Server
│   ├── wallet-skill-SKILL.md  # 钱包 Skill
│   ├── wallet-skill-README.md # 钱包文档
│   ├── wallet-skill-package.json
│   ├── SKILL.md / README.md / package.json
│   ├── .claude-plugin-plugin.json
│   └── .cursor-plugin-plugin.json
│
├── okx/                       # OKX OnchainOS
│   ├── skills-SKILL.md        # 总 Skill
│   ├── skills-wallet-SKILL.md # 钱包 Skill
│   ├── skills-swap-SKILL.md   # Swap Skill
│   ├── skills-market-SKILL.md # 市场 Skill
│   ├── SKILL.md / QUICKSTART.md / README.md / package.json
│   ├── .claude-plugin.json / .claude-plugin-plugin.json
│   └── .cursor-plugin-plugin.json
│
├── base-agentkit/             # Coinbase AgentKit
│   ├── viemWalletProvider.ts  # Viem 钱包实现（唯一完整文件）
│   ├── cdpWalletProvider.ts   # CDP 钱包（stub）
│   ├── transfer.ts            # 转账（stub）
│   ├── deploy_contract.ts     # 部署（stub）
│   ├── get_balance.ts         # 余额（stub）
│   ├── trade.ts               # 交易（stub）
│   ├── README.md              # 文档
│   └── package.json
│
├── base-agentic-wallet/       # Coinbase Agentic Wallet
│   ├── skills-auth-SKILL.md   # 认证 Skill
│   ├── skills-balance-SKILL.md # 余额 Skill
│   ├── skills-send-SKILL.md   # 发送 Skill
│   ├── skills-trade-SKILL.md  # 交易 Skill（最完整）
│   ├── SKILL.md               # 主入口
│   ├── README.md              # 文档
│   └── package.json
│
└── morph/                     # Morph Skill
    ├── scripts-morph_api.py   # 全部实现（1382 行）
    ├── SKILL.md               # 统一 Agent 参考
    ├── skills-morph-wallet-SKILL.md
    ├── skills-morph-explorer-SKILL.md
    ├── skills-morph-dex-SKILL.md
    ├── skills-morph-bridge-SKILL.md
    ├── skills-morph-altfee-SKILL.md
    ├── README.md / package.json
    ├── .claude-plugin-plugin.json
    └── .cursor-plugin-plugin.json
```
