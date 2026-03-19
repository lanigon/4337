# Morph ERC-4337 Agent Wallet 综合调研报告

> 2026-03-18

---

## 1. 结论

### 1.1 核心发现

Morph 要在链上做 Agent 支付钱包，面临的现实是：

1. **ERC-4337 官方只提供 EntryPoint 合约**（v0.6/v0.7 已在 Morph 上），其他所有组件（Smart Account、Bundler、Paymaster、Session Key）都需要自己做或用第三方
2. **链上合约充足但无链下服务** — 多套 Smart Account 合约已在 Morph 上（Coinbase 等），但没有可用的 Bundler 服务
3. **主流链（Base/Polygon）都有自主可控的 AA 基础设施**，Morph 需要建立自己的基础设施避免对单一第三方的依赖

### 1.2 建议方案

**短期（1-2 周）：自建 Bundler + 复用现有合约**
```
EntryPoint v0.6.0（已有）
  + CoinbaseSmartWallet（已有，支持 Passkey）
  + 或部署 SimpleAccount（官方参考实现）
  + 自建 Bundler（eth-infinitism 开源 bundler）
  → 成本: ~$50/月服务器 + 开发时间
```

**中期（1-2 月）：加 Session Key + Paymaster**
```
自研或部署 Session Key 合约
  + 部署自研 Paymaster（gasless 交易）
  + 前端完善
```

**长期：考虑协议层 AA 或自研合约**
```
选项 A: 参考 Tempo 的协议层 AA（需要改链底层）
选项 B: 自研 Smart Account + Session Key 合约
选项 C: 部署 EntryPoint v0.8/v0.9 + SimpleAccount（官方最新参考实现）
```

---

## 2. 其他链怎么做的

### 2.1 Coinbase / Base

**策略：全栈自研，两套产品（链上合约 + Agent 钱包服务）**

Coinbase 有两套互补的方案：

```
产品 1: CoinbaseSmartWallet (链上合约层)
  面向: DApp 开发者
  技术: 标准 ERC-4337
  认证: Passkey（指纹/面部）

产品 2: AgentKit + Agentic Wallet (Agent 工具层)
  面向: AI Agent 开发者
  技术: 基础设施层面的钱包托管
  认证: 邮箱 OTP / API Key
```

#### CoinbaseSmartWallet（链上合约）

```
架构:
  用户
    ↓ Passkey 登录（指纹/面部，WebAuthn）
  CoinbaseSmartWallet (ERC-4337, EntryPoint v0.6.0)
    ↓ UserOp
  Coinbase Bundler (自建)
    ↓ handleOps()
  EntryPoint v0.6.0
    ↓
  Base L2
```

| 组件 | 实现方式 | 开源 |
|------|---------|:----:|
| Smart Account | CoinbaseSmartWallet（自研） | ✅ [github.com/coinbase/smart-wallet](https://github.com/coinbase/smart-wallet) |
| Factory | CoinbaseSmartWalletFactory | ✅ |
| Bundler | Coinbase Developer Platform 自建 | ❌ |
| Paymaster | Coinbase 自建（送 0.25 ETH credits） | ❌ |
| 认证 | WebAuthn Passkey（secp256r1） | ✅ |
| Session Key | 不支持（用 Passkey 替代） | — |

技术亮点：
- **双格式 Owner**：同一个 Smart Account 支持 EOA 地址（32 bytes）和 Passkey 公钥（64 bytes）
- **链上 WebAuthn 验证**：通过 RIP-7212 预编译或 FreshCryptoLib 在链上验证 secp256r1 签名
- **CREATE2 全链部署**：通过 Safe Singleton Factory 部署到 248 条链，地址统一

合约地址（全链统一，Morph 上已部署）：
```
CoinbaseSmartWallet Implementation: 0x000100abaad02f1cfC8Bbe32bD5a564817339E72
CoinbaseSmartWalletFactory:         0x0BA5ED0c6AA8c49038F819E587E2633c4A9F428a
EntryPoint v0.6.0:                  0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789
```

#### AgentKit（Agent 开发 SDK）

```
定位: 开发者工具箱，给 AI Agent 加钱包能力
架构:
  AI Agent (LangChain / Vercel AI SDK / OpenAI Agents SDK)
    ↓ 自然语言指令
  AgentKit Action Provider (50+ 链上操作)
    ↓ 选择操作（transfer, swap, stake, mint...）
  Wallet Provider (可选: Coinbase / Privy / Viem)
    ↓ 构造并签名交易
  区块链（所有 EVM + Solana）
```

| 特性 | 说明 |
|------|------|
| 语言 | TypeScript + Python |
| 操作数 | 50+ (TS) / 30+ (Python) |
| 钱包 | 3 种 provider（Coinbase / Privy / Viem） |
| 链 | 所有 EVM + Solana |
| AI 框架 | LangChain, Vercel AI SDK, OpenAI, Pydantic AI, AutoGen |
| DeFi 集成 | Compound, Morpho, Moonwell, Superfluid, Jupiter |
| 开源 | ✅ Apache-2.0 |

#### Agentic Wallet（独立 Agent 钱包）

```
定位: 开箱即用的 Agent 钱包，CLI 直接调用
架构:
  AI Agent
    ↓ awal CLI 或 MCP
  Agentic Wallet
    ↓ 私钥隔离在 TEE 安全飞地
  Coinbase 基础设施
    ↓ gasless 交易
  Base L2
```

| 特性 | 说明 |
|------|------|
| 钱包 | Coinbase TEE 托管（私钥不可导出） |
| 链 | Base 为主 |
| 认证 | 邮箱 OTP |
| 安全 | TEE 隔离 + Spending Limits + KYT + OFAC |
| 功能 | 持有/发送/交易稳定币 + x402 微支付 |

安全模型：
```
TEE（Trusted Execution Environment）:
  ├── 私钥在安全飞地里，永远不进 LLM context
  └── 即使 Agent 被 prompt injection 攻击，也无法导出私钥

Spending Limits:
  ├── Per-session 上限（整个会话的总花费）
  ├── Per-transaction 上限（单笔交易的金额）
  └── 在基础设施层面强制执行（交易提交前检查，不是链上合约）

KYT (Know Your Transaction):
  └── 自动阻断高风险交易

OFAC 合规:
  └── 所有转账自动检查制裁名单
```

CLI 命令：
```bash
npx awal auth login user@email.com   # 邮箱 OTP 登录
npx awal auth verify <id> <otp>      # 验证
npx awal address                     # 查钱包地址
npx awal balance                     # 查余额
npx awal send 10 0x... --chain base  # 发送 USDC
npx awal trade 100 USDC ETH         # 交易
npx awal x402 pay <url>             # x402 微支付
```

#### AgentKit vs Agentic Wallet vs CoinbaseSmartWallet

| | CoinbaseSmartWallet | AgentKit | Agentic Wallet |
|---|---|---|---|
| **类型** | 链上合约 | SDK 工具箱 | 独立钱包产品 |
| **面向** | DApp 用户 | Agent 开发者 | AI Agent |
| **钱包** | ERC-4337 SA | 多种 provider | TEE 托管 |
| **私钥** | 用户设备（Passkey） | 取决于 provider | TEE 隔离 |
| **Session/Spending** | 不支持 | 取决于 provider | 内置（per-session + per-tx） |
| **认证** | Passkey（指纹） | API key | 邮箱 OTP |
| **链** | 248 条 EVM | 所有 EVM + Solana | Base |
| **gasless** | Paymaster | 通过 Paymaster | 内置 |
| **x402** | 可集成 | 可集成 | 内置 |
| **开源** | ✅ 合约 | ✅ SDK | 部分（Skills） |

**文档：**
- Smart Wallet 源码: https://github.com/coinbase/smart-wallet
- AgentKit: https://github.com/coinbase/agentkit
- Agentic Wallet: https://docs.cdp.coinbase.com/agentic-wallet/welcome
- Bundler + Paymaster 示例: https://github.com/coinbase/paymaster-bundler-examples
- x402: https://www.x402.org/

#### 2.1.1 Base 的 Bundler

```
类型: 标准 ERC-4337 Bundler（遵循 ERC-4337 RPC 规范）
运营: Coinbase Developer Platform 自建
端点: https://api.developer.coinbase.com/rpc/v1/base/<api_key>

获取 API Key:
  1. 去 https://portal.cdp.coinbase.com 注册（免费）
  2. 创建项目 → 自动生成 API key
  3. Bundler + Paymaster 共用同一个端点和 key

支持的方法（标准 4337 RPC）:
  - eth_sendUserOperation
  - eth_estimateUserOperationGas
  - eth_getUserOperationReceipt
  - eth_getUserOperationByHash
  - eth_supportedEntryPoints

EntryPoint: v0.6.0 (0x5FF137D4...2789)

支持的 Smart Account 类型（全兼容）:
  - CoinbaseSmartWallet（自家的）
  - SimpleAccount（官方参考实现）
  - Safe（多签）
  - Kernel（ZeroDev）

支持的 SDK（5 种都能配合使用）:
  - Pimlico permissionless.js
  - Alchemy aa-core
  - ZeroDev @zerodev/sdk
  - Wagmi
  - Viem
```

#### 2.1.2 Base 的 Paymaster

```
类型: 标准 ERC-4337 Paymaster（VerifyingPaymaster 模式）
运营: Coinbase 自建后端
端点: 跟 Bundler 共用同一个 API 端点

工作流程:
  1. 开发者在 CDP Dashboard 配置 sponsorship 规则:
     - 白名单合约地址
     - 白名单函数
     - 每日/每月额度
  2. 用户发 UserOp → SDK 自动请求 Paymaster
  3. Paymaster 后端检查规则 → 签名 paymasterAndData
  4. UserOp 带着 paymasterAndData 提交给 Bundler
  5. EntryPoint 验证 Paymaster 签名 → 从 Paymaster deposit 扣 gas

免费额度:
  注册即送 0.25 ETH gas credits
  超出后按用量付费

代码示例:
  // 使用 permissionless.js
  const paymasterClient = createClient({
    transport: http("https://api.developer.coinbase.com/rpc/v1/base/<key>"),
  });

  const userOp = await bundlerClient.sendUserOperation({
    account: smartAccount,
    calls: [{ to, data, value }],
    paymaster: paymasterClient,  // 自动处理 paymasterAndData
  });
```

#### 2.1.3 Base 的 Session Key

```
Base 不支持 Session Key。

替代方案: Passkey（WebAuthn）
  - 每次交易用户按指纹/面部确认
  - 不需要 Session Key 的原因:
    Passkey 验证延迟极低（<1秒），用户体验已经足够好
    Coinbase 的目标用户是普通消费者，不是 AI Agent
  - 缺点:
    不能做无人值守的自主执行（每次都需要用户生物识别确认）
    不适合 Agent 场景

如果要在 Base 上做 Agent 自主执行:
  需要自己写 Session Key 模块，或用 ZeroDev Kernel（支持 session key）配合 Base 的 Bundler
```

---

### 2.2 Polygon

**策略：$250M 收购 Sequence，走自己的 AA 路线（非标准 ERC-4337）**

```
架构:
  AI Agent
    ↓ polygon-agent CLI
  Sequence Smart Contract Wallet（不走 EntryPoint）
    ↓ Session-scoped transaction
  Sequence Relayer（不是 4337 Bundler）
    ↓ Meta-transaction
  Polygon PoS
```

**核心组件：**

| 组件 | 实现方式 | 开源 |
|------|---------|:----:|
| Smart Wallet | Sequence Smart Contract Wallet | 部分 |
| Relayer | Sequence Relayer（类似 Bundler） | ❌ |
| Gas 代付 | Sequence 代付，USDC 结算 | ❌ |
| Session Key | Sequence Smart Sessions | ❌ |
| Agent CLI | @polygonlabs/agent-cli | ✅ [github.com/0xPolygon/polygon-agent-cli](https://github.com/0xPolygon/polygon-agent-cli) |
| 身份 | ERC-8004 IdentityRegistry | ✅ |
| 声誉 | ERC-8004 ReputationRegistry | ✅ |
| 路由 | Trails（DEX 聚合 + 跨链桥） | ❌ |
| 微支付 | x402 协议 | ✅ |

**合约地址（Polygon 链上）：**
```
IdentityRegistry:   0x8004A169FB4a3325136EB29fA0ceB6D2e539a432
ReputationRegistry: 0x8004BAa17C55a88189AE136b182e5fdA19dE9b63
ValueForwarder:     0xABAAd93EeE2a569cF0632f39B10A9f5D734777ca
```

**文档：**
- Agent CLI: https://github.com/0xPolygon/polygon-agent-cli
- Sequence Wallet: https://github.com/0xsequence/wallet-contracts
- Sequence 文档: https://docs.sequence.xyz

#### 2.2.1 Polygon 的 Bundler (Sequence Relayer)

```
类型: 非标准（不是 ERC-4337 Bundler，是 Sequence 自己的 Relayer）
运营: Sequence（Polygon 收购）

跟 ERC-4337 Bundler 的区别:
  ERC-4337: UserOp → Bundler → EntryPoint.handleOps() → SA.validateUserOp()
  Sequence: 签名交易 → Relayer → Wallet.execute()（直接调钱包，不走 EntryPoint）

获取 API Key:
  不需要网站注册，CLI 一条命令搞定:

  polygon-agent setup --name "MyAgent"
    ↓ 内部流程:
    1. ethers.Wallet.createRandom()            → 生成新 EOA
    2. 用 EOA 签名 EthAuth proof               → 证明身份
    3. POST api.sequence.build/Builder/GetAuthToken  → 拿 JWT
    4. POST api.sequence.build/Builder/CreateProject → 创建项目
    5. POST api.sequence.build/QuotaControl/GetDefaultAccessKey → 拿 Access Key
    6. 加密存到 ~/.polygon-agent/builder.json

  全程自动，无需人工操作。Key 通过链上身份（EOA 签名）认证，不需要邮箱/密码注册。

Relayer 接口:
  不暴露标准 4337 RPC 方法
  通过 @0xsequence/dapp-client SDK 调用:
    client.sendTransaction(chainId, txs, feeOption)
```

#### 2.2.2 Polygon 的 Paymaster (Sequence Gas 代付)

```
类型: 非标准（不用 ERC-4337 Paymaster 合约，Relayer 内置 gas 代付）
运营: Sequence Relayer 内部处理

工作流程:
  1. Agent 发交易，指定 fee token（如 USDC）
  2. Relayer 查 Indexer，确认 Agent 持有足够的 fee token
  3. Relayer 用自己的原生 token（POL）垫付 gas
  4. 从 Agent 的钱包里扣回等值 USDC
  5. 全程用户不需要持有 gas token

fee token 选择逻辑（从 dapp-client.ts 源码）:
  1. 查询 Relayer 支持的 fee token 列表
  2. 查询用户持有的 token 余额（通过 Indexer）
  3. 匹配: 用户有的 ∩ Relayer 支持的
  4. 优先选 USDC（Polygon 上）
  5. 回退到任意可用 fee token

代码:
  const feeOption = {
    token: { contractAddress: USDC_ADDRESS },
    value: feeAmount,
  };
  client.sendTransaction(chainId, txs, feeOption);

跟 ERC-4337 Paymaster 的区别:
  ERC-4337: 需要部署 Paymaster 合约 + 充 deposit + 链下签名后端
  Sequence: 不需要合约，Relayer 服务内部处理
```

#### 2.2.3 Polygon 的 Session Key (Smart Sessions)

```
类型: 非标准（不是 ERC-4337 的 SessionKeyManager，是 Sequence 自己的方案）
运营: Sequence Ecosystem Wallet

跟 ERC-4337 Session Key 的区别:
  ERC-4337: 链上合约存 merkle root → 链上验证每笔交易
  Sequence: 链下创建 session → 钱包 + Relayer 联合验证

创建 Session 流程（浏览器-CLI 握手）:

  Agent CLI                  浏览器 Connector UI         Sequence Wallet
      │                            │                         │
      ├─ 生成 NaCl 密钥对           │                         │
      ├─ 启动 local HTTP server    │                         │
      ├─ cloudflared 隧道          │                         │
      ├─ 构造审批 URL ──────────→  │                         │
      │   (权限参数:                │                         │
      │    --native-limit 10       │                         │
      │    --usdc-limit 50         │                         │
      │    --contract 0x...)       │                         │
      │                            ├─ 用户连接钱包 ──────────→│
      │                            │                         │
      │                            │←─ 钱包签发 session ─────┤
      │                            │   (explicit + implicit)  │
      │                            │                         │
      │←─ sealed-box 加密回传 ─────┤                         │
      │                            │                         │
      ├─ 解密 session 凭证         │                         │
      └─ AES-256-GCM 加密存储      │                         │
          ~/.polygon-agent/wallets/ │                         │

Session 权限模型:
  ├── per-token spending limit（每种 token 独立额度）
  │   --native-limit 10    → 最多花 10 POL
  │   --usdc-limit 50      → 最多花 50 USDC
  │   --token-limit WETH:0.1
  ├── contract whitelist（合约白名单）
  │   --contract 0xABC...  → 只能调这些合约
  │   自动白名单: IdentityRegistry, ReputationRegistry, ValueForwarder
  ├── 时间过期
  │   默认 24 小时，过期后必须重新审批
  └── 权限执行位置
      Sequence 钱包合约 + Relayer 联合验证（链上 + 链下混合）

双层 Session 结构:
  Explicit Session（显式会话）:
    ├── pk: session 私钥（签交易用）
    ├── walletAddress: 钱包地址
    └── config.deadline: 过期时间
  Implicit Session（隐式会话）:
    ├── pk: 隐式 session 私钥
    ├── attestation: 钱包签发的证明
    └── identitySignature: 身份签名（EthAuth）

安全特性:
  ├── 私钥永远不进 LLM context（防 prompt injection）
  ├── NaCl sealed-box 加密传输
  ├── AES-256-GCM 加密本地存储
  ├── 默认 dry-run（--broadcast 才真发）
  └── 24h 自动过期
```

### 2.3 三方对比：Bundler / Paymaster / Session Key

#### Bundler 对比

| | Base (Coinbase) | Polygon (Sequence) | 自建方案 |
|---|---|---|---|
| **类型** | 标准 ERC-4337 | 非标准 Relayer | 标准 ERC-4337 |
| **走 EntryPoint** | 是 | 否 | 是 |
| **API Key** | 网站注册获取 | CLI 自动生成（EOA 签名认证） | 不需要 |
| **免费** | 是 | 是 | 是（自己的服务器） |
| **可自建** | 否 | 否 | 是 |
| **开源** | 否 | 否 | 是（eth-infinitism/bundler） |
| **支持多种 SA** | 是（全兼容） | 否（只支持 Sequence Wallet） | 是（全兼容） |

#### Paymaster 对比

| | Base (Coinbase) | Polygon (Sequence) | 自建方案 |
|---|---|---|---|
| **类型** | ERC-4337 Paymaster 合约 | Relayer 内置代付 | ERC-4337 Paymaster 合约 |
| **需要合约** | 是 | 否 | 是 |
| **谁垫 gas** | Paymaster 合约的 deposit | Relayer 服务 | Paymaster 合约的 deposit |
| **用户付什么** | 不付（赞助）| USDC | 不付 或 ERC-20 |
| **验证逻辑** | 链上（validatePaymasterUserOp） | 链下（Relayer 内部） | 链上 |
| **免费额度** | 0.25 ETH credits | 无限（gas 用 USDC 扣） | 自定义 |
| **配置方式** | Dashboard 设白名单 | 不需要配置 | 自研验证逻辑 |

#### Session Key / Spending Control 对比

| | Base CoinbaseSmartWallet | Base Agentic Wallet | Polygon (Sequence) | ERC-4337 方案 |
|---|---|---|---|---|
| **Session Key** | ❌ 不支持 | ❌ 不支持 | ✅ Smart Sessions | ✅ 需要自研合约 |
| **Spending Limit** | ❌ | ✅ 基础设施层面 | ✅ per-token | ✅ 链上合约 |
| **私钥安全** | 设备安全芯片（Passkey） | TEE 安全飞地 | 加密本地文件 | 链上 merkle root |
| **权限验证** | 链上（WebAuthn） | 链下（基础设施） | 链下 + 链上混合 | 链上（SessionKeyManager） |
| **粒度** | 每次确认 | per-session + per-tx | per-token + 合约白名单 | 合约 + 函数 + 参数级 |
| **过期** | 无（每次 Passkey） | session 级 | 24h 默认 | 自定义 validUntil |
| **合规** | 无 | KYT + OFAC 筛查 | 无 | 无 |
| **适合 Agent** | ❌（需要人按指纹） | ✅ | ✅ | ✅ |

---

## 3. Morph 现有组件

### 3.1 已部署的 ERC-4337 官方合约

| 合约 | 地址 | 主网 | 测试网 |
|------|------|:----:|:-----:|
| EntryPoint v0.6.0 | `0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789` | ✅ | ✅ |
| EntryPoint v0.7.0 | `0x0000000071727De22E5E9d8BAf0edAc6f37da032` | ✅ | ✅ |
| EntryPoint v0.8.0 | `0x4337084d9e255ff0702461cf8895ce9e3b5ff108` | ❌ | ❌ |
| EntryPoint v0.9.0 | `0x433709009B8330FDa32311DF1C2AFA402eD8D009` | ❌ | ❌ |
| SimpleAccountFactory | — | ❌ | ❌ |

### 3.2 已部署的第三方合约

**Coinbase：**

| 合约 | 地址 | 状态 |
|------|------|------|
| CoinbaseSmartWallet | `0x000100abaad02f1cfC8Bbe32bD5a564817339E72` | ✅ |
| CoinbaseSmartWalletFactory | `0x0BA5ED0c6AA8c49038F819E587E2633c4A9F428a` | ✅ |

**ERC-8004 Agent 身份：**

| 合约 | 地址 | 主网 | 测试网 |
|------|------|:----:|:-----:|
| IdentityRegistry | `0x672c7c7A9562B8d1e31b1321C414b44e3C75a530` | ✅ | ✅ |
| ReputationRegistry | `0x23AA2fD5D0268F0e523385B8eF26711eE820B4B5` | ✅ | ✅ |

### 3.3 缺少的组件

| 缺失 | Base 怎么解决的 | Polygon 怎么解决的 |
|------|----------------|-------------------|
| Bundler 服务 | Coinbase 自建 | Sequence Relayer |
| Paymaster 服务 | Coinbase 自建 + 免费 credits | Sequence 代付 |
| SimpleAccountFactory | Coinbase 用自己的 Factory | Sequence 有自己的 |
| Session Key 合约 | 不需要（用 Passkey） | Sequence Smart Sessions |
| Agent 工具 | AgentKit | Agent CLI |

### 3.4 第三方 AA 服务商

| 服务商 | Bundler | Paymaster | 是否支持 Morph |
|--------|:-------:|:---------:|:-----------:|
| Pimlico | ✅ | ✅ | 待确认 |
| Alchemy | ✅ | ✅ | 待确认 |
| ZeroDev | 用别家 | ✅ | 待确认 |
| Stackup | ✅ 自托管 | ✅ | 自托管可支持 |
| Coinbase | ✅ | ✅ | 待确认 |

---

## 4. ERC-4337 版本对比

### 4.1 总览

| | v0.6.0 | v0.7.0 | v0.8.0 | v0.9.0 |
|---|---|---|---|---|
| **发布** | 2023-04 | 2024-02 | 2024-03 | 2024-11 |
| **编译器** | Solidity 0.8.17 | 0.8.23 | 0.8.28 | 0.8.28 |
| **行业采用** | 主流（Coinbase 等） | 推进中（Pimlico、ZeroDev） | 少量 | 无 |
| **Morph 部署** | ✅ | ✅ | ❌ | ❌ |
| **开发团队** | eth-infinitism（含 Vitalik） | 同 | 同 | 同 |

### 4.2 v0.6.0 — 当前主流

```
EntryPoint: 0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789

核心特征:
  - UserOperation: 11 个独立字段（sender, nonce, initCode, callData,
    callGasLimit, verificationGasLimit, preVerificationGas,
    maxFeePerGas, maxPriorityFeePerGas, paymasterAndData, signature）
  - 签名: 直接 ECDSA 或自定义验证逻辑
  - Nonce: 192-bit key + 64-bit sequence（并行通道）
  - Paymaster: validatePaymasterUserOp + postOp
  - 模拟: 链上 simulateValidation
  - 防重入: OpenZeppelin ReentrancyGuard

合约文件 (14 个):
  core/EntryPoint.sol, NonceManager.sol, StakeManager.sol,
  SenderCreator.sol, Helpers.sol
  interfaces/IEntryPoint.sol, IAccount.sol, IPaymaster.sol,
  IAggregator.sol, INonceManager.sol, IStakeManager.sol,
  UserOperation.sol
  utils/Exec.sol

参考实现:
  samples/SimpleAccount.sol, SimpleAccountFactory.sol
  core/BaseAccount.sol
```

### 4.3 v0.7.0 — 工程优化

```
EntryPoint: 0x0000000071727De22E5E9d8BAf0edAc6f37da032

相比 v0.6 的变化:
  + UserOperation 字段打包 → PackedUserOperation
    accountGasLimits (bytes32) = verificationGasLimit + callGasLimit
    gasFees (bytes32) = maxPriorityFeePerGas + maxFeePerGas
    → 省 calldata → 省 L2 gas
  + UserOperationLib.sol — 打包/解包工具
  + IAccountExecute.sol — 可选的 executeUserOp 接口
  + ERC165 supportsInterface 支持
  + 未使用 gas 10% 惩罚（防攻击 bundler）
  + 模拟函数移到链下（减少链上代码）

  - UserOperation.sol → 被 PackedUserOperation.sol 替代

影响:
  v0.6 和 v0.7 的 Smart Account 不能互用（结构体不兼容）
  完全不能混用
```

### 4.4 v0.8.0 — EIP-7702 支持

```
EntryPoint: 0x4337084d9e255ff0702461cf8895ce9e3b5ff108

相比 v0.7 的变化:
  + Eip7702Support.sol — 原生 EIP-7702 账户委托
  + Simple7702Account.sol — 7702 参考实现（EOA 临时变 Smart Account）
  + EIP-712 签名 — 结构化 UserOp hash
  + ISenderCreator.sol — SenderCreator 接口独立
  + ReentrancyGuardTransient — transient storage 优化
  + initCode 防 front-running — 防抢先部署账户

  - TokenCallbackHandler.sol — 不再作为参考实现
  - 文件路径: samples/ → accounts/（不再是"示例"）

影响:
  向后兼容 v0.7 的 Smart Account（ABI 不变）
  7702 功能需要链级支持（EIP-7702 硬分叉）
```

### 4.5 v0.9.0 — Paymaster 优化

```
EntryPoint: 0x433709009B8330FDa32311DF1C2AFA402eD8D009
SenderCreator: 0x0A630a99Df908A81115A3022927Be82f9299987e（首次独立部署）

相比 v0.8 的变化:
  + paymasterSignature 字段 — Paymaster 签名可与用户签名并行
  + 区块号验证范围 — validAfter/validUntil 最高位=1 表示区块号
  + getCurrentUserOpHash() — 执行时可查当前 UserOp hash
  + initCode 静默处理 — 账户已存在时不 revert
  + BasePaymaster 构造器改 — owner 必须显式传入

  - TransientSlot — 不再使用 transient storage
  - ReentrancyGuardTransient — 回到普通方式

影响:
  完全向后兼容 v0.7/v0.8
  已有 Smart Account 和 Paymaster 不需要改代码
  SenderCreator 首次独立部署
```

### 4.6 合约文件演进

| 文件 | v0.6 | v0.7 | v0.8 | v0.9 | 说明 |
|------|:----:|:----:|:----:|:----:|------|
| EntryPoint.sol | ✅ | ✅ | ✅ | ✅ | 核心调度 |
| NonceManager.sol | ✅ | ✅ | ✅ | ✅ | 并行 nonce |
| StakeManager.sol | ✅ | ✅ | ✅ | ✅ | deposit/stake |
| SenderCreator.sol | ✅ | ✅ | ✅ | ✅ | 账户部署辅助 |
| Helpers.sol | ✅ | ✅ | ✅ | ✅ | 工具函数 |
| Exec.sol | ✅ | ✅ | ✅ | ✅ | call 封装 |
| UserOperationLib.sol | ❌ | ✅ | ✅ | ✅ | v0.7 新增 |
| Eip7702Support.sol | ❌ | ❌ | ✅ | ✅ | v0.8 新增 |
| UserOperation.sol | ✅ | ❌ | ❌ | ❌ | v0.7 被替代 |
| PackedUserOperation.sol | ❌ | ✅ | ✅ | ✅ | 替代 UserOp |
| IAccountExecute.sol | ❌ | ✅ | ✅ | ✅ | v0.7 新增 |
| ISenderCreator.sol | ❌ | ❌ | ✅ | ✅ | v0.8 新增 |
| SimpleAccount.sol | ✅ | ✅ | ✅ | ✅ | 参考实现 |
| Simple7702Account.sol | ❌ | ❌ | ✅ | ✅ | v0.8 新增 |
| BaseAccount.sol | ✅ | ✅ | ✅ | ✅ | 抽象基类 |
| TokenCallbackHandler.sol | ✅ | ✅ | ❌ | ❌ | v0.8 移除 |

### 4.7 主流链部署状态

| 链 | v0.6 | v0.7 | v0.8 | v0.9 |
|---|:---:|:---:|:---:|:---:|
| Ethereum | ✅ | ✅ | ✅ | ✅ |
| Polygon | ✅ | ✅ | ✅ | ✅ |
| Base | ✅ | ✅ | ✅ | ✅ |
| Arbitrum | ✅ | ✅ | ✅ | ✅ |
| Optimism | ✅ | ✅ | ✅ | ✅ |
| Scroll | ✅ | ✅ | ✅ | ✅ |
| BSC | ✅ | ✅ | ✅ | ✅ |
| **Morph** | ✅ | ✅ | ❌ | ❌ |

### 4.8 标准包含 vs 不包含

**ERC-4337 标准包含的（eth-infinitism 写的）：**
- EntryPoint 合约（全链统一地址，CREATE2 确定性部署）
- NonceManager、StakeManager、SenderCreator、Helpers、Exec
- IAccount、IPaymaster、IAggregator 接口定义
- SimpleAccount、BaseAccount、BasePaymaster 参考实现

**标准不包含的（各家自己做的）：**
- Session Key — 需要自研或用开源方案
- Module 系统 — ERC-7579 或自研
- Passkey 登录 — 需要 WebAuthn 合约验证
- Token Paymaster — 需要自研
- Bundler 服务 — 链下服务，需要自建或用第三方
- Paymaster 后端 — 链下服务
- SDK — 链下库

### 4.9 行业采用

| 服务商 | 使用版本 |
|--------|---------|
| Coinbase Smart Wallet | v0.6（硬编码） |
| Pimlico | v0.6 + v0.7 |
| Alchemy | v0.6 + v0.7 |
| ZeroDev | v0.7 |
| Safe | v0.6 + v0.7 |
| Polygon | 不用 ERC-4337（Sequence） |

**当前主流仍然是 v0.6，v0.7 在推进中，v0.8/v0.9 尚无主流采用。**

---

## 附录 A：其他 AA 方案

### Tempo（协议层 AA）

Tempo 是支付专用 L1，将 AA 直接内置到协议层（EIP-2718 type 0x76 新交易类型），不需要 EntryPoint、Bundler、Paymaster 合约。Passkey、Session Key（Access Key）、Gas 代付、批量交易都是链原生功能。与 ERC-4337 的区别是协议层实现 vs 应用层实现。目前审计中，测试网可用。

- 文档: https://docs.tempo.xyz
- 仓库: https://github.com/tempoxyz/tempo

### Bitget Wallet（MPC 方案）

Bitget Wallet 走 MPC 路线（2-of-3 TSS），不是标准 ERC-4337。没有 EntryPoint、没有 Bundler，私钥分片签名后直接上链。功能上有 gasless（GetGas）和无助记词登录，但架构完全不同。

---

## 附录 B：合约源码位置

本仓库已拉取所有相关合约源码：

```
4337contracts/
├── v06/                         ERC-4337 v0.6.0 官方合约
│   ├── entrypoint/        14 .sol
│   └── simple-account/    11 .sol
├── v07/                         ERC-4337 v0.7.0
│   ├── entrypoint/        18 .sol
│   └── simple-account/    30 .sol
├── v08/                         ERC-4337 v0.8.0 (+ EIP-7702)
│   ├── entrypoint/        31 .sol
│   └── simple-account/    10 .sol
├── v09/                         ERC-4337 v0.9.0
│   ├── entrypoint/        29 .sol
│   ├── sender-creator/    29 .sol
│   └── simple-account/    10 .sol
├── base/                        Coinbase Smart Wallet 方案
│   ├── coinbase-smart-wallet/  14 .sol
│   └── coinbase-factory/       16 .sol
└── polygon/                     Polygon Agent CLI + Sequence
    ├── sequence-contracts/  6 .sol
    ├── agent-cli/           8 .ts
    └── erc-8004/
```

---

## 附录 C：关键文档链接

**ERC-4337 官方：**
- 规范: https://eips.ethereum.org/EIPS/eip-4337
- 合约仓库: https://github.com/eth-infinitism/account-abstraction
- 文档: https://docs.erc4337.io

**Coinbase/Base：**
- AA 概述: https://docs.base.org/chain/account-abstraction
- Smart Wallet: https://github.com/coinbase/smart-wallet
- Bundler + Paymaster 示例: https://github.com/coinbase/paymaster-bundler-examples
- AgentKit: https://github.com/coinbase/agentkit
- x402: https://www.x402.org/

**Polygon：**
- Agent CLI: https://github.com/0xPolygon/polygon-agent-cli
- Sequence: https://docs.sequence.xyz
- ERC-4337 概述: https://docs.polygon.technology/pos/concepts/transactions/eip-4337/

**Bundler 开源实现：**
- eth-infinitism: https://github.com/eth-infinitism/bundler
- Pimlico Alto: https://github.com/pimlicolabs/alto
- Stackup: https://github.com/stackup-wallet/stackup-bundler

**Tempo（协议层 AA）：**
- 文档: https://docs.tempo.xyz
- 仓库: https://github.com/tempoxyz/tempo
