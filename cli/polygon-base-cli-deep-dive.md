# Polygon & Base CLI 深度分析

> 2026-03-24 | 源码：`cli/polygon/`, `cli/base-agentkit/`, `cli/base-agentic-wallet/`

---

## 目录

1. [Polygon Agent CLI](#1-polygon-agent-cli)
2. [Coinbase AgentKit](#2-coinbase-agentkit)
3. [Coinbase Agentic Wallet Skills](#3-coinbase-agentic-wallet-skills)
4. [三者对比](#4-三者对比)
5. [功能矩阵](#5-功能矩阵)
6. [对 Morph CLI 的借鉴](#6-对-morph-cli-的借鉴)

---

## 1. Polygon Agent CLI

### 1.1 项目概况

| 属性 | 值 |
|------|---|
| 包名 | `@polygonlabs/agent-cli` |
| 版本 | 0.3.0 |
| 语言 | TypeScript |
| 架构 | pnpm monorepo + yargs CLI |
| 节点要求 | Node.js ≥ 20（开发 ≥ 24） |
| 钱包类型 | Smart Account (Sequence) |
| 链 | Polygon 主网 |

### 1.2 完整命令列表

#### `setup` — 一次性初始化

```bash
polygon-agent setup [--name <name>] [--force]
```

**内部流程**：
1. `ethers.Wallet.createRandom()` → 生成 EOA
2. EIP-712 签名 → EthAuth proof
3. POST `api.sequence.build/rpc/Builder/GetAuthToken` → JWT
4. POST `api.sequence.build/rpc/Builder/CreateProject` → projectId
5. POST `api.sequence.build/rpc/QuotaControl/GetDefaultAccessKey` → accessKey
6. AES-256-GCM 加密私钥 → 存 `~/.polygon-agent/builder.json`

**输出**：`{ privateKey, eoaAddress, accessKey, projectId, projectName }`

---

#### `wallet create` — 创建 Session 钱包

```bash
polygon-agent wallet create [--name <name>] [--chain polygon] [--timeout 300]
  [--native-limit <amt>] [--usdc-limit <amt>] [--usdt-limit <amt>]
  [--token-limit <SYM:amt>]      # 可重复
  [--contract <addr>]            # 可重复，白名单
  [--usdc-to <addr> --usdc-amount <amt>]
  [--access-key <key>]
  [--no-wait]
```

**内部流程（7 步）**：
1. 生成 NaCl X25519 密钥对（base64url 编码）
2. 存请求记录到 `~/.polygon-agent/requests/<rid>.json`（2h 过期）
3. 启动 localhost HTTP server + Cloudflare Quick Tunnel
4. 构建审批 URL（含 pub key、spending limit、合约白名单）
5. **输出完整 URL** → 用户浏览器打开 → Sequence Ecosystem Wallet 审批
6. 浏览器用 NaCl sealed-box 加密 session → POST 回 tunnel callback
7. CLI 解密 → 存 `~/.polygon-agent/wallets/<name>.json`

**Session 权限参数**：
- `--native-limit 5` → 最多花 5 POL
- `--usdc-limit 100` → 最多转 100 USDC
- `--contract 0x...` → 白名单合约（可重复）

**自动白名单合约**（无需手动添加）：
- `0x8004A169...` — ERC-8004 IdentityRegistry
- `0x8004BAa1...` — ERC-8004 ReputationRegistry
- `0xABAAd93E...` — ValueForwarder（原生 POL 转账）

**注意**：`--usdc-limit` 只允许 `transfer()`，会阻止 `approve()`，导致 deposit 失败。

---

#### `wallet import` / `wallet list` / `wallet address` / `wallet remove`

```bash
polygon-agent wallet import --ciphertext '<blob>|@<file>' [--name <name>] [--rid <rid>]
polygon-agent wallet list
polygon-agent wallet address [--name <name>]
polygon-agent wallet remove [--name <name>]
```

`import`：手动粘贴加密 blob（tunnel 断掉时的备用方案）

---

#### `balances` — 查余额

```bash
polygon-agent balances [--wallet <name>] [--chain <chain>]
```

**内部**：Sequence Indexer API → native + ERC-20 余额

---

#### `send` / `send-native` / `send-token` — 转账

```bash
polygon-agent send --to <addr> --amount <num> [--symbol <SYM>] [--broadcast]
polygon-agent send-native --to <addr> --amount <num> [--broadcast] [--direct]
polygon-agent send-token --symbol <SYM> --to <addr> --amount <num> [--broadcast]
```

**send-native 两条路径**：
- **默认**：通过 ValueForwarder 合约 `0xABAAd93E...`（selector `0x98f850f1`）
- **`--direct`**：直接 EOA 转账

**send-token 流程**：
1. `resolveErc20BySymbol()` → token-directory 查地址+decimals
2. `parseUnits(amount, decimals)` → wei
3. 编码 ERC-20 `transfer(to, amount)`
4. `runDappClientTx()` → Sequence Relayer 提交

**所有写操作默认 dry-run，加 `--broadcast` 才真发。**

---

#### `swap` — DEX Swap

```bash
polygon-agent swap --from <SYM> --to <SYM> --amount <num>
  [--to-chain <chain>] [--slippage 0.005] [--broadcast]
```

**基于 Trails 意图路由（3 阶段）**：
1. `trails.quoteIntent()` → 获取报价和路由
2. `trails.commitIntent()` → 锁定意图，获取 intentId
3. `trails.executeIntent()` → 存入流动性 → Trails 后台执行 → 轮询结果（120s 超时）

支持跨链 swap（自动检测目标链）。

---

#### `deposit` — DeFi 收益

```bash
polygon-agent deposit --asset <SYM> --amount <num> [--protocol aave|morpho] [--broadcast]
```

**流程**：
1. `trails.getEarnPools()` → 查活跃池（按 TVL 排序）
2. 构建批量交易：`approve()` + `supply()`（Aave）或 `deposit()`（Morpho）
3. 通过 DappClient 提交

---

#### `fund` — 充值入口

```bash
polygon-agent fund [--wallet <name>] [--token <addr>]
```

生成 Trails 充值 widget URL，用户浏览器打开充值。

---

#### `agent` — ERC-8004 身份与声誉

```bash
polygon-agent agent register --name <name> [--agent-uri <uri>] [--metadata k=v,k=v] [--broadcast]
polygon-agent agent wallet --agent-id <id>
polygon-agent agent metadata --agent-id <id> --key <key>
polygon-agent agent reputation --agent-id <id> [--tag1 <tag>] [--tag2 <tag>]
polygon-agent agent feedback --agent-id <id> --value <score> [--tag1] [--tag2] [--broadcast]
polygon-agent agent reviews --agent-id <id> [--tag1] [--tag2] [--include-revoked]
```

**合约**：
- IdentityRegistry `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`
- ReputationRegistry `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`

**register**：铸造 ERC-721 NFT + 设置 metadata
**reputation**：`getSummary(agentId, clients, tag1, tag2)` → 聚合评分
**feedback**：`giveFeedback()` → float → fixed-point（×100）

---

#### `x402-pay` — HTTP 微支付

```bash
polygon-agent x402-pay --url <url> --wallet <name>
  [--method GET|POST] [--body <json>] [--header Key:Value]
```

**流程**：
1. 探测端点 → 非 402 直接返回
2. 收到 402 → 解析 `WWW-Authenticate: x402`（amount、asset、network）
3. 从钱包转 USDC 到 Builder EOA
4. EOA 签署 EIP-3009 支付授权
5. 带支付头重试请求 → 服务端验证 → 200 返回数据

---

#### `polymarket` — 预测市场交易

```bash
polygon-agent polymarket markets [--search <q>] [--limit 20]
polygon-agent polymarket market --condition-id <id>
polygon-agent polymarket set-key --private-key <key>
polygon-agent polymarket proxy-wallet
polygon-agent polymarket approve [--neg-risk] [--broadcast]
polygon-agent polymarket clob-buy --condition-id <id> --token-id <id> --amount <num> [--broadcast]
polygon-agent polymarket clob-sell ...
polygon-agent polymarket cancel-order --order-id <id> [--broadcast]
polygon-agent polymarket orders [--condition-id <id>]
polygon-agent polymarket positions
```

**特殊**：Polymarket 需要独立 EOA（不走 Sequence 钱包），通过 Proxy Wallet Factory 的 CREATE2 确定性地址。

---

### 1.3 存储架构

```
~/.polygon-agent/
├── .encryption-key              # 32 字节 AES 密钥（mode 0o600）
├── builder.json                 # EOA 私钥（加密）+ accessKey + projectId
├── wallets/
│   ├── main.json               # 默认钱包 session（明文，含 deadline）
│   └── agent.json              # 命名钱包
├── requests/
│   └── <rid>.json              # 待审批请求（2h 过期）
├── state/
│   └── dapp-client-cli/        # DappClient 状态（AES 加密）
├── bin/
│   └── cloudflared             # 自动下载的隧道二进制
└── token-directory/            # Token 元数据缓存（10 分钟 TTL）
```

### 1.4 环境变量

| 变量 | 必需 | 默认值 | 用途 |
|------|:----:|--------|------|
| `SEQUENCE_PROJECT_ACCESS_KEY` | ✅ | — | 所有 Sequence 服务的 API key |
| `SEQUENCE_INDEXER_ACCESS_KEY` | ✅ | 同上 | 余额查询 |
| `TRAILS_API_KEY` | ✅ | 同上 | Swap/Deposit/Fund |
| `SEQUENCE_BUILDER_API_URL` | — | `https://api.sequence.build` | Builder API |
| `SEQUENCE_ECOSYSTEM_CONNECTOR_URL` | — | `https://agentconnect.polygon.technology/` | 审批 UI |
| `SEQUENCE_KEYMACHINE_URL` | — | `https://keymachine.sequence.app` | Session key 管理 |
| `SEQUENCE_NODES_URL` | — | `https://nodes.sequence.app/{network}` | RPC |
| `SEQUENCE_RELAYER_URL` | — | `https://{network}-relayer.sequence.app` | Bundler |
| `POLYGON_AGENT_DEBUG_FETCH` | — | `0` | 请求日志 |
| `POLYGON_AGENT_DEBUG_FEE` | — | `0` | 手续费日志 |

### 1.5 核心依赖

| 依赖 | 用途 |
|------|------|
| `@0xsequence/dapp-client` | Smart Account session 管理 |
| `@0xsequence/indexer` | Token 余额查询 |
| `@0xsequence/network` | 链定义 |
| `@0xtrails/api` | DEX swap + earn |
| `@x402/fetch` | HTTP 微支付 |
| `@polymarket/clob-client` | 预测市场交易 |
| `ethers` v6 | 签名 + ABI 编码 |
| `viem` | 现代 EVM 库 |
| `tweetnacl` | NaCl 非对称加密 |
| `yargs` | CLI 命令解析 |

---

## 2. Coinbase AgentKit

### 2.1 项目概况

| 属性 | 值 |
|------|---|
| 包名 | `@coinbase/agentkit` |
| 语言 | TypeScript + Python 双栈 |
| 架构 | Monorepo（TS + Python 分开） |
| 定位 | AI Agent 链上操作 SDK（不是 CLI） |
| 口号 | "Every agent deserves a wallet" |
| 文件数 | 1202（含所有框架扩展和示例） |

### 2.2 架构

```
agentkit/
├── typescript/
│   ├── agentkit/                    # 核心 SDK
│   │   ├── src/wallet-providers/    # 7 种钱包实现
│   │   └── src/action-providers/    # 50+ 动作提供者
│   ├── create-onchain-agent/        # 脚手架 CLI
│   └── framework-extensions/
│       ├── langchain/               # LangChain Tool 绑定
│       ├── vercel-ai-sdk/           # Vercel AI SDK 集成
│       └── model-context-protocol/  # MCP Server
├── python/
│   ├── coinbase-agentkit/           # Python 核心
│   └── framework-extensions/
│       ├── langchain/
│       ├── openai-agents-sdk/
│       ├── pydantic-ai/
│       ├── autogen/
│       └── strands-agents/
```

### 2.3 钱包提供者（7 种）

| 提供者 | 类型 | 特点 |
|--------|------|------|
| **CdpSmartWalletProvider** | Smart Account (4337) | Owner + SA 分离，UserOp，Paymaster gasless |
| **CdpEvmWalletProvider** | EOA (CDP 托管) | CDP SDK 服务端签名 |
| **PrivyEvmWalletProvider** | EOA (Privy 嵌入) | 浏览器嵌入式钱包 |
| **PrivyEvmDelegatedEmbeddedWalletProvider** | EOA (Privy 委托) | 高级委托签名 |
| **ViemWalletProvider** | EOA (本地) | 直接 Viem client |
| **SolanaKeypairWalletProvider** | Solana | Ed25519 密钥对 |
| **ZeroDev Wallet Provider** | Smart Account (4337) | ZeroDev Kernel 智能合约钱包 |

**统一接口**：
```typescript
interface WalletProvider {
  getAddress(): string
  getBalance(): Promise<bigint>
  nativeTransfer(to, value): Promise<Hex>
  sendTransaction(tx): Promise<Hex>
  sign(hash): Promise<Hex>
  signMessage(message): Promise<Hex>
  signTypedData(typedData): Promise<Hex>
  readContract(params): Promise<any>
}
```

### 2.4 动作提供者（50+）

#### 核心钱包操作
- `get_wallet_details` — 地址、网络、余额
- `native_transfer` — 原生资产转账

#### ERC-20
- `get_balance` / `transfer` / `approve` / `get_allowance`
- `get_erc20_token_address` — 符号→地址解析

#### CDP (Coinbase Developer Platform)
- `request_faucet_funds` — 测试网水龙头
- `list_spend_permissions` / `use_spend_permission` — 支出权限
- `get_swap_price` / `swap` — Token swap + 自动 approve

#### ERC-8004 Agent 身份
- `register_agent` — 注册 Agent（铸 NFT）
- `update_agent_metadata` — 更新 name/description/image/endpoints/capabilities
- `get_owned_agents` — 查拥有的 Agent
- `search_agents` — 语义搜索（关键词 + 能力 + 状态过滤）
- `get_agent_info` — 完整 Agent 信息 + 声誉摘要
- `give_feedback` / `revoke_feedback` / `append_response` / `get_agent_feedback` — 声誉管理

#### x402 支付
- `make_http_request` — 初始请求（处理 402 响应）
- `retry_http_request_with_x402` — 带支付重试
- `make_http_request_with_x402` — 一步到位
- `discover_x402_services` — 搜索 x402 市场
- `list_registered_services` / `list_registered_facilitators` — 查询已注册服务
- `register_x402_service` — 注册新服务

#### DeFi 协议集成（20+）
| 协议 | 类型 |
|------|------|
| Across | 跨链桥 |
| Compound | 借贷 |
| Morpho | 借贷 |
| Moonwell | 借贷 |
| Sushi | DEX |
| Jupiter | Solana DEX |
| Enso | 聚合/Farming |
| Superfluid | 流支付 |
| Yelay | AI 协议 |
| WOW/UniSwap | DEX |

#### NFT/社交
| 协议 | 类型 |
|------|------|
| Zora | NFT/Creator |
| OpenSea | NFT 市场 |
| Farcaster | 社交 |
| Twitter | 社交 |
| Basename | ENS |

#### 数据
| 协议 | 类型 |
|------|------|
| DefiLlama | DeFi TVL |
| Zerion | 投资组合 |
| Alchemy | 链上数据 |

### 2.5 Smart Account 细节

**CdpSmartWalletProvider vs CdpEvmWalletProvider**：

| 特性 | Smart Wallet | EOA |
|------|:----------:|:---:|
| 账户类型 | 4337 Smart Account | 外部拥有 |
| 交易模型 | UserOp (sendUserOperation) | 直接 tx |
| Gas | Bundler + EntryPoint | 直接 RPC |
| Owner | 独立 owner 账户 | 单账户 |
| Paymaster | ✅ 可配置 gasless | ❌ |
| 批量操作 | ✅ | ❌ |

### 2.6 环境变量

```bash
# CDP SDK（必需）
CDP_API_KEY_ID=...
CDP_API_KEY_SECRET=...
CDP_WALLET_SECRET=...

# 网络（可选）
NETWORK_ID=base-sepolia          # 默认
RPC_URL=...                      # 自定义 RPC
PAYMASTER_URL=...                # Smart Wallet gasless

# x402（可选）
X402_MAX_PAYMENT_USDC=0.5
X402_ALLOW_DYNAMIC_SERVICE_REGISTRATION=true
```

---

## 3. Coinbase Agentic Wallet Skills

### 3.1 项目概况

| 属性 | 值 |
|------|---|
| 类型 | Vercel Skills 集合 |
| 核心 CLI | `awal@2.0.3` |
| 安装 | `npx skills add coinbase/agentic-wallet-skills` |
| 文件数 | 17（纯 Skill 定义） |
| 链 | Base 主网 |

### 3.2 完整 Skill 列表（9 个）

#### `authenticate-wallet` — 认证

```bash
npx awal@2.0.3 auth login <email>           # 发送 OTP
npx awal@2.0.3 auth verify <flowId> <otp>   # 验证 6 位 OTP
npx awal@2.0.3 status                       # 检查状态
npx awal@2.0.3 address                      # 获取地址
npx awal@2.0.3 balance                      # 查 USDC 余额
npx awal@2.0.3 show                         # 打开钱包 UI
```

#### `send-usdc` — 转 USDC

```bash
npx awal@2.0.3 send <amount> <recipient> [--chain base] [--json]

# 示例
npx awal@2.0.3 send '$1.00' 0x1234...abcd
npx awal@2.0.3 send 0.50 vitalik.eth        # 支持 ENS
```

#### `fund` — 充值

```bash
npx awal@2.0.3 show    # 打开 Coinbase Onramp（Apple Pay / 银行卡 / Coinbase 转账）
```

#### `trade` — Token Swap

```bash
npx awal@2.0.3 trade <amount> <from> <to> [-c base] [-s 200] [--json]

# 示例
npx awal@2.0.3 trade '$1' usdc eth
npx awal@2.0.3 trade 0.01 eth usdc
npx awal@2.0.3 trade '$5' usdc eth --slippage 200   # 200 基点 = 2%
```

**Token 别名**：
| 别名 | Token | Decimals |
|------|-------|----------|
| usdc | USDC | 6 |
| eth | ETH | 18 |
| weth | WETH | 18 |

#### `search-for-service` — 搜索 x402 服务

```bash
npx awal@2.0.3 x402 bazaar search <query> [-k 5] [--force-refresh]
npx awal@2.0.3 x402 bazaar list [--network base] [--full]
npx awal@2.0.3 x402 details <url>
```

BM25 相关性搜索，本地缓存 12 小时。

#### `pay-for-service` — 付费调 API

```bash
npx awal@2.0.3 x402 pay <url> [-X POST] [-d '{"key":"val"}'] [--max-amount 100000] [--json]
```

**USDC 单位**：1000000 = $1.00，100000 = $0.10

#### `monetize-service` — 部署付费 API

提供 Express.js 模板，用 `@x402/express` 中间件包装端点，自动注册到 Bazaar。

**定价参考**：
| 场景 | 价格 |
|------|------|
| 简单数据查询 | $0.001 - $0.01 |
| API 代理/增强 | $0.01 - $0.10 |
| 计算密集查询 | $0.10 - $0.50 |
| AI 推理 | $0.05 - $1.00 |

#### `query-onchain-data` — 链上 SQL 查询

```bash
npx awal@2.0.3 x402 pay https://x402.cdp.coinbase.com/platform/v2/data/query/run \
  -X POST -d '{"sql": "SELECT ... FROM base.events WHERE ..."}' --json
```

**$0.10/次**，CoinbaseQL（ClickHouse 方言），支持 `base.events`、`base.transactions`、`base.blocks`。

#### `x402` — 通用 x402 Skill

搜索 + 查看 + 支付的组合 Skill，作为 fallback。

---

## 4. 三者对比

| 维度 | Polygon Agent CLI | Coinbase AgentKit | Coinbase Agentic Wallet |
|------|:--:|:--:|:--:|
| **定位** | Agent 全栈 CLI | Agent SDK/库 | Agent Skill 集合 |
| **类型** | 命令行工具 | 编程框架 | 自然语言 Skill |
| **语言** | TypeScript | TypeScript + Python | Bash (awal CLI) |
| **钱包** | Sequence Smart Account | 7 种（含 4337） | 服务托管 |
| **链** | Polygon | 所有 EVM + Solana | Base |
| **认证** | NaCl + Cloudflare 隧道 | CDP API Key | Email OTP |
| **Send** | ✅ native + ERC-20 | ✅ native + ERC-20 | ✅ USDC only |
| **Swap** | ✅ Trails 意图路由 | ✅ CDP Swap API | ✅ awal trade |
| **Bridge** | ✅ 跨链 via Trails | ✅ Across Protocol | ❌ |
| **Deposit/Earn** | ✅ Aave + Morpho | ✅ Compound + Morpho + Moonwell | ❌ |
| **Agent 身份** | ✅ ERC-8004 (6 命令) | ✅ ERC-8004 (8 动作) | ❌ |
| **x402 支付** | ✅ x402-pay | ✅ x402 动作 (7 个) | ✅ x402 pay/search/monetize |
| **预测市场** | ✅ Polymarket | ❌ | ❌ |
| **链上 SQL** | ❌ | ❌ | ✅ CDP SQL ($0.10/次) |
| **NFT** | ❌ | ✅ Zora + OpenSea | ❌ |
| **社交** | ❌ | ✅ Twitter + Farcaster | ❌ |
| **MCP** | ❌ | ✅ 原生 MCP Server | ❌ |
| **Dry-run** | ✅ `--broadcast` | 无（直接执行） | 无 |
| **私钥安全** | AES-256-GCM | CDP 服务端 | 服务端 |
| **AI 框架** | 需包装 | LangChain/Vercel/MCP/AutoGen/Pydantic | Vercel Skills |

---

## 5. 功能矩阵

### 按使用场景

| 场景 | Polygon 怎么做 | AgentKit 怎么做 | Agentic 怎么做 |
|------|---------------|----------------|----------------|
| **创建钱包** | `wallet create` + 浏览器审批 | `AgentKit.from({ cdpApiKeyId })` | `auth login <email>` |
| **查余额** | `balances` (Indexer API) | `get_wallet_details` (RPC) | `balance` |
| **转原生币** | `send-native --to --amount --broadcast` | `native_transfer(to, value)` | 不支持 |
| **转 USDC** | `send-token --symbol USDC --to --amount --broadcast` | `transfer(token, to, amount)` | `send <amount> <recipient>` |
| **Swap** | `swap --from USDC --to POL --amount 10 --broadcast` | `swap(fromToken, toToken, amount)` | `trade 10 usdc eth` |
| **跨链** | `swap --from USDC --to ETH --to-chain ethereum --broadcast` | Across `bridge()` | 不支持 |
| **DeFi 存款** | `deposit --asset USDC --protocol aave --broadcast` | Compound/Morpho actions | 不支持 |
| **注册 Agent** | `agent register --name Bot --broadcast` | `register_agent(name, metadata)` | 不支持 |
| **查声誉** | `agent reputation --agent-id 1` | `get_agent_info(agentId)` | 不支持 |
| **x402 支付** | `x402-pay --url https://... --wallet main` | `make_http_request_with_x402(url)` | `x402 pay <url>` |
| **部署付费 API** | 不支持 | `register_x402_service(url)` | `monetize-service` Skill |
| **预测市场** | `polymarket clob-buy --condition-id ... --broadcast` | 不支持 | 不支持 |
| **链上查询** | 不支持 | 不支持 | `x402 pay ...cdp...query/run` |

---

## 6. 对 Morph CLI 的借鉴

### 从 Polygon 借鉴

| 功能 | Polygon 做法 | Morph 适配 |
|------|-------------|-----------|
| **钱包创建** | Cloudflare 隧道 + NaCl 加密 + 浏览器审批 | 简化：本地创建 SA，无需浏览器 |
| **Session 权限** | spending limit + 合约白名单 + deadline | 直接用 Biconomy SessionKeyManager |
| **私钥存储** | AES-256-GCM + file mode 0o600 | 必须参考，替换 CLI 参数传递 |
| **Dry-run** | `--broadcast` flag | 必须加 |
| **Agent 身份** | 6 个 ERC-8004 命令 | 复用，合约已在 Morph 上 |
| **Token 解析** | token-directory + 10min 缓存 | 可以用 Morph 的 KNOWN_TOKENS |
| **交易提交** | DappClient → Sequence Relayer | 改为 → 自建 Bundler / Pimlico |

### 从 AgentKit 借鉴

| 功能 | AgentKit 做法 | Morph 适配 |
|------|-------------|-----------|
| **多钱包提供者** | 7 种（CDP/Viem/Privy/ZeroDev） | 先支持 Biconomy，预留接口 |
| **Action Provider 模式** | `@CreateAction` 装饰器 | Python 版可用类似注册模式 |
| **ERC-8004 搜索** | 语义搜索（keyword + capability） | 可以加到 aa_api.py |
| **MCP Server** | 原生框架扩展 | Phase 3 考虑 |
| **x402** | 7 个 action（搜索+支付+注册+列表） | 后期考虑 |

### 从 Agentic Wallet 借鉴

| 功能 | Agentic 做法 | Morph 适配 |
|------|-------------|-----------|
| **Email OTP 认证** | 无私钥暴露 | Morph 不需要（自建 Bundler 路线） |
| **x402 Bazaar** | 搜索 + 详情 + 支付 3 步 | 后期考虑 |
| **链上 SQL** | CDP SQL API（$0.10/次） | 不需要（用 Blockscout API 免费） |
| **Skill 版本管理** | `bump-awal.js` 自动更新所有 SKILL.md | 好实践，可参考 |
| **输入验证** | Regex 白名单（防 shell 注入） | 必须加 |

### 优先实现顺序

```
P0 — 立即做:
  ├── 私钥加密存储（参考 Polygon AES-256-GCM）
  ├── --broadcast dry-run 机制
  └── 输入验证（地址、金额、注入防护）

P1 — SKILL 化:
  ├── .claude-plugin/plugin.json
  ├── SKILL.md（参考 Polygon 和 Morph 格式）
  └── 拆分子 Skill（wallet / 4337 / agent）

P2 — 核心命令:
  ├── wallet create（CREATE2 地址计算）
  ├── wallet balance / deposit
  ├── agent register / info / reputation（ERC-8004）
  ├── entrypoint deposit / stake / nonce
  └── session create / execute / revoke

P3 — Bundler 依赖:
  ├── userop build / estimate / send
  ├── session key 链上验证
  └── paymaster 集成

P4 — 增强:
  ├── MCP Server
  ├── x402 支付
  └── 多框架扩展（LangChain Tool）
```
