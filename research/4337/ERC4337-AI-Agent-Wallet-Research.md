# ERC-4337 账户抽象在 AI Agent 钱包场景下的应用调研报告

> 调研日期：2026-03-13
> 目标链：Morph L2 (Chain ID: 2818)

---

## 目录

1. [ERC-4337 核心机制](#1-erc-4337-核心机制)
2. [AI Agent 钱包的需求分析](#2-ai-agent-钱包的需求分析)
3. [Morph 链对 ERC-4337 的支持情况](#3-morph-链对-erc-4337-的支持情况)
4. [现有方案和 SDK 对比](#4-现有方案和-sdk-对比)
5. [安全考虑](#5-安全考虑)
6. [代码实现路径](#6-代码实现路径)
7. [总结与建议](#7-总结与建议)

---

## 1. ERC-4337 核心机制

### 1.1 总体架构

ERC-4337 在不修改以太坊共识层协议的前提下实现了账户抽象 (Account Abstraction)。其核心思想是引入一套替代的交易流程，包括 UserOperation 对象、替代内存池 (alt mempool)、链上 EntryPoint 合约，以及可编程的验证逻辑。

**架构流程图描述：**

```
用户/AI Agent
     |
     v
[构造 UserOperation]
     |
     v
[Alt Mempool] <--- Bundler 监听
     |
     v
[Bundler 聚合多个 UserOps]
     |
     v
[EntryPoint.handleOps()]
     |
     +---> 验证循环 (Verification Loop)
     |        |
     |        +---> 验证签名 (validateUserOp)
     |        +---> 检查 Paymaster (如有)
     |        +---> 创建账户 (如需，通过 initCode)
     |
     +---> 执行循环 (Execution Loop)
              |
              +---> 调用 Smart Account 执行交易
              +---> 计算 gas 消耗
              +---> 偿付 Bundler（来自账户存款或 Paymaster）
```

### 1.2 UserOperation

UserOperation 是一个伪交易对象，代表用户的交易意图。与传统交易不同，UserOperation 包含更多字段，且使用替代内存池传播。

**核心字段：**

| 字段 | 说明 |
|------|------|
| `sender` | 智能合约钱包地址 |
| `nonce` | 防重放计数器（由账户实现定义） |
| `initCode` | 如果账户尚不存在，用于创建账户的工厂合约 + calldata |
| `callData` | 要在账户上执行的操作数据 |
| `callGasLimit` | 执行阶段的 gas 上限 |
| `verificationGasLimit` | 验证阶段的 gas 上限 |
| `preVerificationGas` | 额外 gas 补偿（覆盖 calldata 成本等） |
| `maxFeePerGas` | EIP-1559 最大 gas 费 |
| `maxPriorityFeePerGas` | EIP-1559 优先费 |
| `paymasterAndData` | Paymaster 地址 + 附加数据（可选） |
| `signature` | 签名数据（由账户实现定义验证逻辑） |

**关键特性：** nonce 和 signature 字段的用法不由协议定义，而是由每个账户实现自行决定。这意味着可以支持任意签名方案（ECDSA、Passkeys、多签、MPC 等）。

### 1.3 Bundler

Bundler 是一个监听 UserOperation 内存池的节点，负责将多个 UserOperation 聚合为一个标准以太坊交易，发送到 EntryPoint 合约执行。

**工作机制：**
- Bundler 作为交易的 `from` 地址，先行支付 ETH gas 费用
- 在接受 UserOperation 之前，Bundler 会模拟执行以验证签名正确性和费用支付能力
- Bundler 通过 UserOperation 执行时收取的费用获得补偿
- Bundler 设计为无许可基础设施，任何人都可以运行

**主流 Bundler 实现：**

| 名称 | 语言 | 维护方 | 特点 |
|------|------|--------|------|
| **Alto** | TypeScript | Pimlico | 开源(GPL-3.0)，可自托管，支持 100+ EVM 链 |
| **Rundler** | Rust | Alchemy | 高性能，模块化设计，可作为单一二进制或分布式系统运行 |
| **Stackup** | Go | Stackup | 已停止托管服务，但仍可自托管 |
| **Silius** | Rust | 社区 | 纯自托管方案 |

### 1.4 EntryPoint

EntryPoint 是一个全局单例智能合约，负责验证和执行所有 UserOperation。每条链上只需部署一个实例。

**合约地址（通过 CREATE2 确定性部署，所有 EVM 链相同）：**

| 版本 | 地址 |
|------|------|
| **v0.6.0** | `0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789` |
| **v0.7.0** | `0x0000000071727De22E5E9d8BAf0edAc6f37da032` |

**核心方法：**
- `handleOps(UserOperation[] ops, address payable beneficiary)` - 处理一批 UserOperation
- 验证循环：验证每个 UserOp 的签名，必要时通过 initCode 创建新账户
- 执行循环：调用各 Smart Account 执行交易，计算 gas 消耗，偿付 Bundler

### 1.5 Paymaster

Paymaster 是 ERC-4337 定义的智能合约，实现 gas 支付策略。它是实现 gasless 交易和 ERC-20 代付的关键组件。

**典型应用场景：**
- 应用开发者为用户补贴 gas 费（gasless 交易）
- 用户使用 ERC-20 代币（如 USDC、USDT）支付 gas
- 订阅模式的 gas 支付
- 信用卡等链下支付方式

**安全风险提示：** 当 UserOperation 指定的 gas limit 高于实际使用量时，EntryPoint 会对未使用 gas 的 10% 收取惩罚费用，从 Paymaster 存款中扣除。这是 ERC-20 Paymaster 需要特别注意的隐患。

### 1.6 Account Factory

Account Factory 是用于创建新 Smart Account 的工厂合约。当 UserOperation 的 `initCode` 字段非空时，EntryPoint 会调用指定的 Factory 来部署新的 Smart Account。

**关键特性：**
- 使用 CREATE2 实现确定性地址（用户可在部署前知道地址）
- 一般采用代理模式 (Proxy Pattern) 降低部署 gas
- 支持不同的账户实现（Kernel、Safe、Nexus 等）

### 1.7 EIP-7702 补充说明

2025 年 5 月 Pectra 升级后引入的 EIP-7702 为账户抽象提供了补充路径，允许传统 EOA 临时获得智能合约功能，创建混合用户体验。ERC-4337 + EIP-7702 的组合正在加速生态采用。

---

## 2. AI Agent 钱包的需求分析

### 2.1 为什么 AI Agent 需要 AA 钱包

AI Agent 与传统用户在链上交互有本质区别，传统 EOA 钱包无法满足其需求：

| 需求 | EOA 钱包的问题 | AA 钱包的解决方案 |
|------|---------------|------------------|
| **无私钥管理** | Agent 直接持有私钥风险极高 | 通过 Session Key 委托有限权限 |
| **Gasless 交易** | Agent 需要预先持有 ETH | Paymaster 代付 gas |
| **批量交易** | 每笔交易需单独签名发送 | `multicall` 在一个 UserOp 中执行多笔交易 |
| **权限控制** | 全有或全无，无法限制操作范围 | 细粒度的合约/函数/金额白名单 |
| **自动化执行** | 需要持续在线签名 | Session Key 实现自主交易 |
| **安全边界** | 私钥泄露 = 全部资产丢失 | 花费限额、时间锁、多签恢复 |
| **身份验证** | 只有 ECDSA 签名 | 支持任意验证逻辑 |

### 2.2 AI Agent 链上自治的五级模型

根据学术研究（"Autonomous Agents on Blockchains"，2026 年 1 月），Agent 的链上自治可分为五个级别：

1. **L0 - 只读分析**：Agent 仅观察链上状态，不写入交易
2. **L1 - 模拟与意图生成**：Agent 制定目标，但不具备直接执行权限
3. **L2 - 委托执行**：人类保留对 Agent 发起交易的否决权，通过受限角色权限
4. **L3 - 自主签名**：Agent 独立授权和广播交易
5. **L4 - 多 Agent 工作流**：多个 Agent 协调互动，产生复合风险面

**对于大多数 AI Agent 钱包场景，建议从 L2（委托执行）起步，在有充分安全保障后逐步过渡到 L3。**

### 2.3 Agent 钱包核心需求清单

```
1. 钱包创建：无需助记词，通过 Factory 确定性部署
2. 权限委托：Session Key 赋予 Agent 有限操作权限
3. 花费控制：单笔限额、日限额、白名单合约
4. Gas 抽象：Paymaster 代付，Agent 无需持有 ETH
5. 批量操作：一次 UserOp 执行多笔交易（如 approve + swap）
6. 自动过期：Session Key 超时自动失效
7. 紧急撤销：管理者可随时撤销 Agent 权限
8. 审计追踪：所有操作通过 EntryPoint 事件可追踪
```

### 2.4 典型 Agent 钱包使用场景

- **DeFi 自动化**：Agent 在预设规则下自动进行 swap、添加流动性、收割奖励
- **支付处理**：Agent 代表用户自动完成加密支付（Morph 的核心场景）
- **投资组合管理**：Agent 根据策略自动调仓
- **NFT 操作**：Agent 自动铸造、交易 NFT
- **跨链桥接**：Agent 自动完成跨链资产转移

---

## 3. Morph 链对 ERC-4337 的支持情况

### 3.1 Morph 网络基础信息

| 参数 | 主网 (Mainnet) | 测试网 (Hoodi Testnet) |
|------|---------------|----------------------|
| **Chain ID** | 2818 | 2910 |
| **RPC URL** | `https://rpc-quicknode.morph.network` | `https://rpc-hoodi.morph.network` |
| **区块浏览器** | `https://explorer.morph.network` | `https://explorer-hoodi.morph.network` |
| **原生代币** | ETH | ETH |
| **类型** | Optimistic zkEVM L2 | 测试网 |

Morph 是一个完全 EVM 兼容的 Optimistic zkEVM Layer 2 方案，支持标准以太坊 JSON-RPC 方法，可以使用 Hardhat、Foundry、Remix 等标准开发工具。

### 3.2 ERC-4337 基础设施现状

**官方支持的 AA 方案：Biconomy**

根据 Morph 官方文档，Biconomy 是目前 Morph 上唯一正式文档化的 Account Abstraction 解决方案：

- **状态**：Biconomy 已在 Morph 主网上线
- **支持版本**：EntryPoint v0.6.0
- **提供服务**：Smart Accounts Platform + Paymaster + Bundler

**EntryPoint 合约部署情况：**

| 版本 | 地址 | Morph 上状态 |
|------|------|-------------|
| v0.6.0 | `0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789` | 已部署（Biconomy 基于此版本） |
| v0.7.0 | `0x0000000071727De22E5E9d8BAf0edAc6f37da032` | 待确认 |

### 3.3 第三方基础设施支持

| 服务商 | 是否支持 Morph | 备注 |
|--------|---------------|------|
| **Biconomy** | 是 (EntryPoint v0.6) | 官方合作，Bundler + Paymaster + Smart Account |
| **Pimlico** | 否（截至调研时） | 支持 83 条链，暂未包含 Morph |
| **ZeroDev** | 未确认 | 支持 50+ 链，可请求添加新链 |
| **Alchemy AA** | 未确认 | 需查看 Alchemy 控制台 |
| **Stackup** | 不适用 | 已停止托管服务 |
| **QuickNode** | 是（RPC） | 提供 Morph RPC 节点，但未确认 AA 服务 |

### 3.4 自托管方案可行性

由于 Morph 是完全 EVM 兼容链，可以自托管 Bundler 和部署 Paymaster：

**使用 Pimlico Alto 自托管 Bundler：**

```bash
# 克隆并构建
git clone https://github.com/pimlicolabs/alto.git
cd alto
pnpm install
pnpm build:contracts
pnpm build

# 运行（指向 Morph RPC）
./alto run \
  --entrypoints "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789" \
  --executor-private-keys "0x<executor-key-1>,0x<executor-key-2>" \
  --utility-private-key "0x<utility-key>" \
  --rpc-url "https://rpc-quicknode.morph.network" \
  --safe-mode false
```

**注意事项：**
- Morph 的 RPC 可能不支持 `debug_traceCall`，因此建议使用 `--safe-mode false`
- 需要为 utility wallet 预先充值 ETH
- Alto 会自动管理多个 executor wallet 的余额

---

## 4. 现有方案和 SDK 对比

### 4.1 综合对比矩阵

| 特性 | ZeroDev (Kernel) | Biconomy (Nexus) | Safe | Alchemy (LightAccount) | Pimlico |
|------|-----------------|------------------|------|----------------------|---------|
| **智能账户标准** | ERC-7579 | ERC-7579 | ERC-7579 (模块化) | 自有实现 | 无自有账户 |
| **Session Keys** | 原生支持，功能最强 | 通过模块支持 | 通过 7579 模块 | 有限支持 | 仅基础设施 |
| **Gas 效率** | 极高 (Kernel v2.1-lite: 422,291) | 中等 | 较高 (622,406) | 高 (471,141) | N/A |
| **Passkeys** | 原生支持 | 通过第三方模块 | 通过第三方模块 | 不支持 | N/A |
| **多签** | 支持 | 支持 | 原生支持（核心优势） | 不支持 | N/A |
| **Morph 支持** | 未确认（可请求） | 已支持 | 需自部署 | 未确认 | 不支持 |
| **Agent 适配度** | 最高 | 高 | 中等 | 中等 | 仅基础设施 |
| **6 个月活跃账户数** | 904K | 78 | 34K | 7.3M | N/A |
| **审计方** | ChainLight, Kalos | Cyfrin, Spearbit | 多家 | OpenZeppelin | N/A |
| **开源许可** | MIT | MIT | LGPL | MIT | GPL-3.0 |

### 4.2 各方案详细分析

#### ZeroDev (Kernel) - 推荐用于 AI Agent

ZeroDev 是 AI Agent 场景最推荐的方案，核心优势：

- **Session Keys 原生支持**：专门为自动化交易设计，文档明确标注 "Great for AI agents"
- **元基础设施**：将流量代理到 Alchemy、Gelato、Pimlico、StackUp 等多个 Bundler 提供商，提高可靠性
- **ERC-7579 模块化**：支持丰富的插件生态（Validator、Executor、Hook）
- **权限策略丰富**：Call Policy、Gas Policy、Signature Policy、Rate Limit Policy、Timestamp Policy、自定义 Policy

**Session Key 核心代码示例：**

```typescript
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { signerToSessionKeyValidator } from "@zerodev/sdk";
import { createKernelAccount } from "@zerodev/sdk";

// 1. 生成 Session Key
const sessionPrivateKey = generatePrivateKey();
const sessionKeySigner = privateKeyToAccount(sessionPrivateKey);

// 2. 创建 Session Key Validator（带权限策略）
const sessionKeyValidator = await signerToSessionKeyValidator(publicClient, {
  signer: sessionKeySigner,
  validatorData: {
    // 限制可调用的合约和函数
    permissions: [
      {
        target: "0x<contract-address>",  // 白名单合约
        functionSelector: "0xa9059cbb",  // transfer 函数
        valueLimit: parseEther("1"),      // 最大转账 1 ETH
      }
    ],
    paymaster: paymasterAddress,  // 可选：指定 Paymaster
  },
});

// 3. 构造带 Session Key 的 Kernel 账户
const sessionKeyAccount = await createKernelAccount(publicClient, {
  plugins: {
    sudo: ecdsaValidator,        // 管理员密钥（人类持有）
    regular: sessionKeyValidator, // 受限密钥（Agent 持有）
  },
});
```

**Agent 创建模式（Agent-Created Pattern）：**

```typescript
import { toECDSASigner } from "@zerodev/sdk";
import { toPermissionValidator } from "@zerodev/sdk";

// Agent 自行创建空账户签名者
const emptySessionKeySigner = await toECDSASigner({ signer: emptyAccount });

// 构建权限验证器
const permissionPlugin = await toPermissionValidator(publicClient, {
  entryPoint,
  kernelVersion,
  signer: emptySessionKeySigner,
  policies: [
    // Call Policy：限制可调用的合约和函数
    callPolicy({ ... }),
    // Gas Policy：限制 gas 消耗
    gasPolicy({ ... }),
    // Rate Limit Policy：限制调用频率
    rateLimitPolicy({ ... }),
    // Timestamp Policy：限制时间窗口
    timestampPolicy({ validAfter: ..., validUntil: ... }),
  ],
});
```

#### Biconomy (Nexus) - Morph 上的现成方案

Biconomy 的核心优势在于已经在 Morph 主网上线：

- **Smart Accounts Platform**：基于 ERC-7579 的模块化智能账户
- **Bundler**：已为 Morph 配置的 Bundler 服务
- **Paymaster**：支持 Gasless 和 ERC-20 代付

**模块类型：**
- **Validation Modules**：多签、ECDSA 所有权等
- **Execution Modules**：自定义执行逻辑
- **Hook Modules**：交易前后的自定义逻辑

**Bundler URL 格式：**
```
https://bundler.biconomy.io/api/v2/2818/nJPK7B3ru.<your-api-key>
```

**基本集成示例：**

```typescript
import { createNexusClient } from "@biconomy/sdk";
import { http } from "viem";
import { morphMainnet } from "viem/chains"; // 或自定义链配置

// 自定义 Morph 链配置
const morph = {
  id: 2818,
  name: "Morph",
  network: "morph",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc-quicknode.morph.network"] },
  },
  blockExplorers: {
    default: { name: "Morph Explorer", url: "https://explorer.morph.network" },
  },
};

// 创建 Nexus 客户端
const nexusClient = await createNexusClient({
  signer: walletClient,
  chain: morph,
  transport: http(),
  bundlerTransport: http("https://bundler.biconomy.io/api/v2/2818/<api-key>"),
  paymaster: createPaymasterClient({
    transport: http("https://paymaster.biconomy.io/api/v1/2818/<api-key>"),
  }),
});
```

#### Safe - 成熟但较重

- 管理超过 $100B 资产，安全性经过长期验证
- 通过 Safe4337Module 支持 ERC-4337
- Gas 效率最低（622,406 total gas）
- 更适合高价值资产的多签管理场景
- 原生 ERC-7579 支持

#### Alchemy (LightAccount) - 简单轻量

- Gas 效率高
- 由 OpenZeppelin 审计
- 功能相对简单，不支持 Passkeys 和多签
- 适合简单场景

### 4.3 AI Agent 场景适配建议

**首选方案：ZeroDev + 自托管 Bundler (Alto)**

理由：
1. Session Key 系统专为 Agent 设计
2. 权限策略最丰富（Call、Gas、Rate Limit、Timestamp）
3. 通过自托管 Alto Bundler 可支持任何 EVM 链（包括 Morph）
4. ERC-7579 模块化，未来扩展性强

**备选方案：Biconomy Nexus**

理由：
1. 已在 Morph 主网上线，开箱即用
2. 有官方 Bundler 和 Paymaster 服务
3. 同样基于 ERC-7579
4. 但 Session Key 支持不如 ZeroDev 成熟

---

## 5. 安全考虑

### 5.1 Session Keys 安全模型

Session Key 是 AI Agent 钱包的核心安全机制，它允许在不暴露主密钥的情况下委托有限权限。

**委托模型对比：**

| 类型 | 说明 | 适用场景 |
|------|------|---------|
| **静态委托** | 赋予持续权限，需要显式撤销 | 长期运行的 Agent |
| **动态委托** | 签发带约束的 Session Token（过期时间、目标合约） | 临时任务 Agent |

**安全约束参数：**

```typescript
// Session Key 安全约束示例
const sessionKeyConstraints = {
  // 1. 时间约束
  validAfter: Math.floor(Date.now() / 1000),      // 生效时间
  validUntil: Math.floor(Date.now() / 1000) + 3600, // 1 小时后过期

  // 2. 合约白名单
  allowedContracts: [
    "0x<DEX-Router>",
    "0x<Token-Contract>",
  ],

  // 3. 函数选择器白名单
  allowedFunctions: [
    "0xa9059cbb", // transfer
    "0x095ea7b3", // approve
    "0x38ed1739", // swapExactTokensForTokens
  ],

  // 4. 金额限制
  spendingLimits: {
    perTransaction: parseEther("0.1"),  // 单笔最大 0.1 ETH
    perDay: parseEther("1"),            // 日限额 1 ETH
    total: parseEther("10"),            // 总限额 10 ETH
  },

  // 5. 频率限制
  rateLimit: {
    maxCalls: 100,     // 最大调用次数
    interval: 86400,   // 24 小时窗口
  },
};
```

**重要提示：** Session Key 的约束在 `validateUserOp()` 中由钱包特定逻辑（如 ERC-6900/7579 插件）强制执行，而非 ERC-4337 原生支持。不同钱包实现之间尚无统一标准。

### 5.2 七类攻击威胁模型

根据学术研究，AI Agent 在区块链上面临以下威胁：

| 攻击类型 | 描述 | 防御措施 |
|----------|------|---------|
| **Prompt 注入** | 恶意输入劫持 Agent 推理 | 输入过滤 + 链上约束双重防御 |
| **工具/数据欺骗** | 假的 Oracle 响应或合约元数据 | 多源验证 + 签名校验 |
| **中间件篡改** | 在推理和签名之间操纵意图 | TEE 或端到端加密 |
| **密钥泄露** | Agent 基础设施中的凭证被盗 | Session Key + 花费限额 |
| **重放 & Nonce 操纵** | 交易重排序攻击 | EntryPoint 的 nonce 管理 |
| **MEV 提取** | 验证者对 Agent 交易进行恶意排序 | Private mempool 或 MEV 保护 |
| **多 Agent 串谋** | 多个 Agent 协调攻击 | 独立权限隔离 |

### 5.3 安全分层架构 (Defense in Depth)

建议采用以下安全分层：

```
Layer 1: 智能合约约束 (On-chain)
  ├── Session Key 权限策略
  ├── 花费限额 (Spending Limits)
  ├── 合约/函数白名单
  └── 时间锁 (Timelock)

Layer 2: 链下策略引擎 (Off-chain)
  ├── 交易模拟 (Simulation)
  ├── 风险评估
  ├── 异常检测
  └── 人工审批（高风险操作）

Layer 3: 密钥安全 (Custody)
  ├── MPC/TSS 密钥管理
  ├── TEE 执行环境
  ├── HSM 硬件签名
  └── 密钥轮换策略

Layer 4: 监控与审计 (Observability)
  ├── 实时交易监控
  ├── 策略决策记录 (PDR)
  ├── 异常告警
  └── 合规审计日志
```

### 5.4 合规等级选择

| 等级 | 约束类型 | 适用场景 |
|------|---------|---------|
| **L0** | 无约束（不安全） | 仅测试环境 |
| **L1** | 链上智能合约守卫 | 低值操作 Agent |
| **L2** | 链下策略引擎 + 交易模拟 | 中等价值 Agent |
| **L3** | 硬件安全签名 (HSM/MPC) + 分布式审批 | 高价值资产管理 |

### 5.5 ERC-8004 Agent 身份标准

ERC-8004 为 Agent 提供标准化的身份验证基础设施：
- 身份注册表 (Identity Registry)
- 声誉系统 (Reputation System)
- 通过 zkML 证明和 TEE 的验证机制
- 支持 Agent 在不同服务间安全注册和运营

---

## 6. 代码实现路径

### 6.1 推荐技术架构

```
┌─────────────────────────────────────────────────────────┐
│                    AI Agent 应用层                        │
│  ┌─────────────┐  ┌────────────┐  ┌──────────────────┐  │
│  │ Agent Logic  │  │ 策略引擎    │  │ 交易模拟器        │  │
│  └──────┬──────┘  └─────┬──────┘  └────────┬─────────┘  │
│         └───────────────┼──────────────────┘             │
│                         v                                │
│  ┌──────────────────────────────────────────────────┐   │
│  │           SDK 层 (ZeroDev / Biconomy)              │   │
│  │  - Kernel/Nexus Smart Account Client               │   │
│  │  - Session Key Manager                             │   │
│  │  - UserOperation Builder                           │   │
│  └──────────────────────┬───────────────────────────┘   │
│                         v                                │
│  ┌──────────────────────────────────────────────────┐   │
│  │           基础设施层                                │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  │   │
│  │  │  Bundler    │  │  Paymaster │  │  RPC Node  │  │   │
│  │  │  (Alto 自托管│  │  (自部署/   │  │  (Morph    │  │   │
│  │  │  或 Biconomy)│  │  Biconomy) │  │  QuickNode)│  │   │
│  │  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘  │   │
│  └────────┼───────────────┼────────────────┼────────┘   │
│           └───────────────┼────────────────┘             │
│                           v                              │
│  ┌──────────────────────────────────────────────────┐   │
│  │           Morph L2 (Chain ID: 2818)                │   │
│  │  ┌─────────────┐  ┌──────────────┐               │   │
│  │  │  EntryPoint  │  │ Smart Account│               │   │
│  │  │  v0.6.0      │  │ (Kernel/Nexus│               │   │
│  │  │              │  │  + Modules)  │               │   │
│  │  └─────────────┘  └──────────────┘               │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### 6.2 实施步骤

#### 步骤 1：环境准备

```bash
# 初始化项目
mkdir morph-agent-wallet && cd morph-agent-wallet
npm init -y

# 安装核心依赖
npm install viem permissionless @zerodev/sdk @zerodev/ecdsa-validator
# 或使用 Biconomy
npm install @biconomy/sdk viem
```

#### 步骤 2：配置 Morph 链

```typescript
// config/morph.ts
import { defineChain } from "viem";

export const morphMainnet = defineChain({
  id: 2818,
  name: "Morph",
  network: "morph",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://rpc-quicknode.morph.network"],
    },
  },
  blockExplorers: {
    default: {
      name: "Morph Explorer",
      url: "https://explorer.morph.network",
    },
  },
  contracts: {
    entryPoint: {
      address: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789", // v0.6.0
    },
  },
});

export const morphHoodiTestnet = defineChain({
  id: 2910,
  name: "Morph Hoodi Testnet",
  network: "morph-hoodi",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://rpc-hoodi.morph.network"],
    },
  },
  blockExplorers: {
    default: {
      name: "Morph Hoodi Explorer",
      url: "https://explorer-hoodi.morph.network",
    },
  },
});
```

#### 步骤 3：部署自托管 Bundler（如不使用 Biconomy）

```bash
# alto-config.json
cat > alto-config.json << 'EOF'
{
  "entrypoints": "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
  "executor-private-keys": "<comma-separated-executor-keys>",
  "utility-private-key": "<utility-wallet-key>",
  "rpc-url": "https://rpc-quicknode.morph.network",
  "safe-mode": false,
  "port": 4337
}
EOF

# 启动 Alto Bundler
./alto run --config "alto-config.json"
# Bundler 将在 http://localhost:4337/rpc 提供服务
```

#### 步骤 4：创建 Smart Account（方案 A - ZeroDev）

```typescript
// agent-wallet.ts
import { createPublicClient, http } from "viem";
import { createKernelAccount, createKernelAccountClient } from "@zerodev/sdk";
import { signerToEcdsaValidator } from "@zerodev/ecdsa-validator";
import { morphMainnet } from "./config/morph";

// 管理员密钥（人类持有，用于管理 Agent 权限）
const adminSigner = privateKeyToAccount("0x<admin-private-key>");

// 公共客户端
const publicClient = createPublicClient({
  chain: morphMainnet,
  transport: http(),
});

// 1. 创建 ECDSA Validator（管理员）
const ecdsaValidator = await signerToEcdsaValidator(publicClient, {
  signer: adminSigner,
  entryPoint: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
});

// 2. 创建 Kernel 智能账户
const kernelAccount = await createKernelAccount(publicClient, {
  plugins: {
    sudo: ecdsaValidator,
  },
  entryPoint: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
});

console.log("Smart Account 地址:", kernelAccount.address);

// 3. 创建账户客户端
const kernelClient = createKernelAccountClient({
  account: kernelAccount,
  chain: morphMainnet,
  bundlerTransport: http("http://localhost:4337/rpc"), // 自托管 Alto
  // 或使用 Biconomy: http("https://bundler.biconomy.io/api/v2/2818/<key>")
});
```

#### 步骤 5：为 AI Agent 创建 Session Key

```typescript
// session-key.ts
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import {
  signerToSessionKeyValidator,
  createKernelAccount,
  createKernelAccountClient,
} from "@zerodev/sdk";
import { parseEther, encodeFunctionData } from "viem";

// 1. 为 Agent 生成 Session Key
const agentSessionKey = generatePrivateKey();
const agentSigner = privateKeyToAccount(agentSessionKey);

// 2. 定义权限策略
const sessionKeyValidator = await signerToSessionKeyValidator(publicClient, {
  signer: agentSigner,
  validatorData: {
    permissions: [
      {
        // 只允许调用指定 DEX Router
        target: "0x<Morph-DEX-Router>",
        // 只允许 swap 函数
        functionSelector: "0x38ed1739",
        // 单笔最大 0.5 ETH
        valueLimit: parseEther("0.5"),
        // 允许的参数规则（可选）
        rules: [],
      },
      {
        // 允许 ERC-20 approve
        target: "0x<Token-Address>",
        functionSelector: "0x095ea7b3",
        valueLimit: BigInt(0),
      },
    ],
    // Session 有效期
    validAfter: Math.floor(Date.now() / 1000),
    validUntil: Math.floor(Date.now() / 1000) + 86400, // 24 小时
  },
});

// 3. 创建带 Session Key 的 Kernel 账户
const agentAccount = await createKernelAccount(publicClient, {
  plugins: {
    sudo: ecdsaValidator,          // 管理员（可升级/撤销）
    regular: sessionKeyValidator,   // Agent Session Key
  },
  entryPoint: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
});

// 4. Agent 使用 Session Key 发送交易
const agentClient = createKernelAccountClient({
  account: agentAccount,
  chain: morphMainnet,
  bundlerTransport: http("http://localhost:4337/rpc"),
});

// 5. Agent 执行 swap
const txHash = await agentClient.sendUserOperation({
  userOperation: {
    callData: await agentAccount.encodeCallData({
      to: "0x<Morph-DEX-Router>",
      value: parseEther("0.1"),
      data: encodeFunctionData({
        abi: dexRouterAbi,
        functionName: "swapExactTokensForTokens",
        args: [/* swap params */],
      }),
    }),
  },
});
```

#### 步骤 6：部署 Paymaster（可选）

```solidity
// contracts/AgentPaymaster.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@account-abstraction/contracts/core/BasePaymaster.sol";

contract AgentPaymaster is BasePaymaster {
    mapping(address => bool) public allowedAgents;
    mapping(address => uint256) public agentSpent;
    mapping(address => uint256) public agentDailyLimit;

    constructor(IEntryPoint _entryPoint) BasePaymaster(_entryPoint) {}

    function addAgent(address agent, uint256 dailyLimit) external onlyOwner {
        allowedAgents[agent] = true;
        agentDailyLimit[agent] = dailyLimit;
    }

    function _validatePaymasterUserOp(
        UserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 maxCost
    ) internal override returns (bytes memory context, uint256 validationData) {
        require(allowedAgents[userOp.sender], "Agent not allowed");
        require(
            agentSpent[userOp.sender] + maxCost <= agentDailyLimit[userOp.sender],
            "Daily limit exceeded"
        );

        agentSpent[userOp.sender] += maxCost;
        return (abi.encode(userOp.sender, maxCost), 0);
    }

    function _postOp(
        PostOpMode mode,
        bytes calldata context,
        uint256 actualGasCost
    ) internal override {
        (address sender, uint256 maxCost) = abi.decode(context, (address, uint256));
        // 退还多收的 gas 费
        agentSpent[sender] -= (maxCost - actualGasCost);
    }

    // 每日重置（简化版，生产环境应使用时间戳逻辑）
    function resetDailySpent(address agent) external onlyOwner {
        agentSpent[agent] = 0;
    }
}
```

#### 步骤 7：创建 Agent 交易管理器

```typescript
// agent-manager.ts
import { createPublicClient, http, parseEther, formatEther } from "viem";
import { morphMainnet } from "./config/morph";

interface AgentConfig {
  sessionKeyPrivateKey: string;
  allowedContracts: string[];
  dailySpendingLimit: bigint;
  maxSingleTx: bigint;
  sessionDuration: number; // 秒
}

class AgentWalletManager {
  private publicClient;
  private kernelClient;
  private totalSpent = BigInt(0);

  constructor(private config: AgentConfig) {
    this.publicClient = createPublicClient({
      chain: morphMainnet,
      transport: http(),
    });
  }

  // 预交易检查
  async preTransactionCheck(
    target: string,
    value: bigint,
    data: string
  ): Promise<{ allowed: boolean; reason?: string }> {
    // 1. 检查目标合约是否在白名单
    if (!this.config.allowedContracts.includes(target.toLowerCase())) {
      return { allowed: false, reason: "目标合约不在白名单中" };
    }

    // 2. 检查单笔限额
    if (value > this.config.maxSingleTx) {
      return { allowed: false, reason: `单笔金额 ${formatEther(value)} ETH 超过限额 ${formatEther(this.config.maxSingleTx)} ETH` };
    }

    // 3. 检查日限额
    if (this.totalSpent + value > this.config.dailySpendingLimit) {
      return { allowed: false, reason: "超过日消费限额" };
    }

    // 4. 模拟交易
    try {
      await this.publicClient.simulateContract({
        address: target as `0x${string}`,
        abi: [], // 需要实际 ABI
        functionName: "...",
        args: [],
      });
    } catch (e) {
      return { allowed: false, reason: `交易模拟失败: ${e}` };
    }

    return { allowed: true };
  }

  // 执行交易
  async executeTransaction(target: string, value: bigint, data: string) {
    const check = await this.preTransactionCheck(target, value, data);
    if (!check.allowed) {
      throw new Error(`交易被拒绝: ${check.reason}`);
    }

    const txHash = await this.kernelClient.sendUserOperation({
      userOperation: {
        callData: await this.kernelClient.account.encodeCallData({
          to: target as `0x${string}`,
          value,
          data: data as `0x${string}`,
        }),
      },
    });

    this.totalSpent += value;
    return txHash;
  }

  // 批量交易
  async executeBatchTransactions(
    calls: Array<{ to: string; value: bigint; data: string }>
  ) {
    // 预检查所有交易
    for (const call of calls) {
      const check = await this.preTransactionCheck(call.to, call.value, call.data);
      if (!check.allowed) {
        throw new Error(`批量交易中存在被拒绝的操作: ${check.reason}`);
      }
    }

    // 编码为单个 UserOperation 的 multicall
    const txHash = await this.kernelClient.sendUserOperation({
      userOperation: {
        callData: await this.kernelClient.account.encodeCallData(
          calls.map((c) => ({
            to: c.to as `0x${string}`,
            value: c.value,
            data: c.data as `0x${string}`,
          }))
        ),
      },
    });

    const totalValue = calls.reduce((sum, c) => sum + c.value, BigInt(0));
    this.totalSpent += totalValue;
    return txHash;
  }
}
```

### 6.3 部署清单

```
在 Morph 上搭建 AI Agent ERC-4337 钱包的完整部署清单：

[ ] 1. 确认 EntryPoint v0.6.0 已在 Morph 上部署
       地址: 0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789
       验证: https://explorer.morph.network/address/0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789

[ ] 2. 选择方案
       方案 A: Biconomy (开箱即用，已在 Morph 上线)
       方案 B: ZeroDev + 自托管 Alto Bundler (功能更强，需要自建基础设施)

[ ] 3. 基础设施部署
       - 方案 A: 在 Biconomy Dashboard 注册获取 API Key
       - 方案 B: 部署 Alto Bundler，部署自定义 Paymaster

[ ] 4. 智能合约部署
       - 部署 Smart Account Factory (Kernel 或 Nexus)
       - 部署 AgentPaymaster (可选)
       - 部署权限管理模块

[ ] 5. SDK 集成
       - 安装 @zerodev/sdk 或 @biconomy/sdk
       - 配置 Morph 链参数
       - 实现 Session Key 管理

[ ] 6. Agent 权限配置
       - 定义合约白名单
       - 设置花费限额
       - 配置 Session Key 有效期
       - 实现紧急撤销机制

[ ] 7. 安全测试
       - 在 Morph Hoodi 测试网完成全流程测试
       - 权限边界测试
       - Gas 估算测试
       - 异常情况处理测试

[ ] 8. 监控与审计
       - 部署交易监控系统
       - 设置异常告警
       - 集成审计日志
```

---

## 7. 总结与建议

### 7.1 关键发现

1. **Morph 已有 AA 支持**：Biconomy 已在 Morph 主网上线，基于 EntryPoint v0.6.0，提供 Bundler + Paymaster + Smart Account 全套服务。

2. **Pimlico 和 ZeroDev 暂未官方支持 Morph**：但两者都支持自托管和自定义链扩展。Alto Bundler 可以指向任何 EVM 兼容链的 RPC 运行。

3. **ZeroDev 是 AI Agent 最佳选择**：其 Session Key 系统专为 Agent 设计，权限策略最丰富，但需要自建基础设施接入 Morph。

4. **安全不可忽视**：Account Abstraction 本身不自动等于安全，需要多层防御（链上约束 + 链下策略 + 密钥安全 + 监控审计）。

### 7.2 推荐路线

**短期（快速验证）：使用 Biconomy**
- 利用已有的 Morph 基础设施快速搭建 MVP
- 验证 Agent 钱包的核心流程

**中期（功能增强）：迁移到 ZeroDev + 自托管 Alto**
- 部署自托管 Alto Bundler 到 Morph
- 利用 ZeroDev Kernel 的高级 Session Key 和权限策略
- 部署自定义 AgentPaymaster

**长期（生产就绪）：完善安全和监控体系**
- 集成 MPC/TEE 密钥管理
- 部署链下策略引擎
- 实现 ERC-8004 Agent 身份验证
- 建立完整的监控和审计系统

### 7.3 风险提示

- AI Agent 和相关工具仍处于早期开发阶段，需谨慎使用
- EntryPoint v0.6.0 与 v0.7.0 的 API 不兼容，选择时需注意生态匹配
- 自托管 Bundler 需要持续的运维投入和 ETH 资金用于 gas
- Session Key 缺乏跨实现的统一标准，可能存在供应商锁定风险

---

## 参考资源

### 官方文档
- [ERC-4337 Documentation](https://docs.erc4337.io/index.html)
- [ERC-4337 EIP 规范](https://eips.ethereum.org/EIPS/eip-4337)
- [Morph Developer Documentation](https://docs.morph.network/docs/quick-start/wallet-setup)
- [Morph Account Abstraction Guide](https://docs.morph.network/docs/build-on-morph/developer-resources/use-ecosystem-developer-tools/account-abstraction)

### SDK 和工具
- [ZeroDev Documentation](https://docs.zerodev.app/smart-wallet/quickstart-capabilities)
- [ZeroDev Session Keys](https://docs.zerodev.app/sdk/advanced/session-keys)
- [ZeroDev Permissions](https://docs.zerodev.app/smart-wallet/permissions/intro)
- [Biconomy Nexus Documentation](https://docs-devx.biconomy.io/nexus-client)
- [Biconomy Supported Chains](https://docs.biconomy.io/contracts-and-audits/supported-chains)
- [Pimlico Documentation](https://docs.pimlico.io/guides/supported-chains)
- [Pimlico Alto Self-Host Guide](https://docs.pimlico.io/references/bundler/self-host)
- [Alto Bundler GitHub](https://github.com/pimlicolabs/alto)
- [Safe ERC-4337 Integration](https://docs.safe.global/advanced/erc-4337/4337-safe)

### 标准和研究
- [ERC-7579: Minimal Modular Smart Accounts](https://eips.ethereum.org/EIPS/eip-7579)
- [ERC-4337 Session Keys & Delegation](https://docs.erc4337.io/smart-accounts/session-keys-and-delegation.html)
- [Ethereum.org AI Agents](https://ethereum.org/ai-agents/)
- [Autonomous Agents on Blockchains (学术论文)](https://arxiv.org/html/2601.04583v1)
- [Pimlico Smart Account Comparison](https://docs.pimlico.io/guides/how-to/accounts/comparison)

### 安全审计
- [ERC-4337 Paymasters: Better UX, Hidden Risks](https://osec.io/blog/2025-12-02-paymasters-evm/)
- [ERC-4337 Audit Checklist](https://github.com/aviggiano/security/blob/main/audit-checklists/ERC-4337.md)

### 合约地址速查

| 合约 | 地址 | 说明 |
|------|------|------|
| EntryPoint v0.6.0 | `0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789` | Morph 上 Biconomy 使用 |
| EntryPoint v0.7.0 | `0x0000000071727De22E5E9d8BAf0edAc6f37da032` | 待确认 Morph 部署 |
| Biconomy Paymaster (v0.7, 通用) | `0x00000072a5F551D6E80b2f6ad4fB256A27841Bbc` | 非 Base/OP 链 |
