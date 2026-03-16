# Morph Agent Wallet — 功能分析文档

> 基于 Morph 主网/测试网实际部署状态，2026-03-16 验证

---

## 1. 基础设施概览

### 1.1 合约部署总览（主网 vs 测试网）

> 地址基于 CREATE2 确定性部署，主网和测试网地址相同（代码相同，链状态独立）

#### EntryPoint（核心调度合约）

| 合约 | 地址 | 主网 (2818) | 测试网 (2910) |
|------|------|:-----------:|:------------:|
| **EntryPoint v0.6.0** | `0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789` | ✅ | ✅ |
| **EntryPoint v0.7.0** | `0x0000000071727De22E5E9d8BAf0edAc6f37da032` | ✅ | ✅ |

#### Biconomy Legacy V2 合约（基于 EntryPoint v0.6.0）

| 合约 | 地址 | 主网 (2818) | 测试网 (2910) |
|------|------|:-----------:|:------------:|
| SmartAccount V2 Implementation | `0x0000002512019Dafb59528B82CB92D3c5D2423Ac` | ✅ | ❌ |
| SmartAccount Factory V2 | `0x000000a56Aaca3e9a4C479ea6b6CD0DbcB6634F5` | ✅ | ❌ |
| ECDSA Ownership Module | `0x0000001c5b32F37F5beA87BDD5374eB2Ac54eA8e` | ✅ | ❌ |
| Multichain Validation Module | `0x000000824dc138db84FD9109fc154bdad332Aa8E` | ✅ | ❌ |
| Session Key Manager V1 | `0x000002FbFfedd9B33F4E7156F2DE8D48945E7489` | ✅ | ❌ |
| Batched Session Router | `0x00000D09967410f8C76752A104c9848b57ebba55` | ✅ | ❌ |
| ABI Session Validation Module | `0x000006bC2eCdAe38113929293d241Cf252D91861` | ✅ | ❌ |
| Verifying Paymaster V1.1 | `0x00000f79b7faf42eebadba19acc07cd08af44789` | ✅ | ❌ |
| Token Paymaster | `0x00000f7365cA6C59A2C93719ad53d567ed49c14C` | ✅ | ❌ |

#### Biconomy Nexus / MEE 合约（基于 EntryPoint v0.7.0）

**v2.1.0 (Default)**

| 合约 | 地址 | 主网 (2818) | 测试网 (2910) |
|------|------|:-----------:|:------------:|
| Nexus Implementation v1.2.0 | `0x00000000383e8cBe298514674Ea60Ee1d1de50ac` | ❌ | ❌ |
| MEE K1 Validator v1.0.3 | `0x0000000031ef4155C978d48a8A7d4EDba03b04fE` | ❌ | ❌ |
| Nexus Bootstrap v1.2.1 | `0x00000003eDf18913c01cBc482C978bBD3D6E8ffA3` | ❌ | ❌ |
| Nexus Account Factory | `0x0000006648ED9B2B842552BE63Af870bC74af837` | ❌ | ❌ |
| Composable Storage | `0x0000000671eb337E12fe5dB0e788F32e1D71B183` | ❌ | ❌ |
| ETH Forwarder | `0x000000Afe527A978Ecb761008Af475cfF04132a1` | ❌ | ❌ |

**v2.2.1 (Latest)**

| 合约 | 地址 | 主网 (2818) | 测试网 (2910) |
|------|------|:-----------:|:------------:|
| Nexus Implementation v1.3.1 | `0x0000000020fe2F30453074aD916eDeB653eC7E9D` | ❌ | ❌ |
| MEE K1 Validator v1.1.0 | `0x0000000002d3cC5642A748B6783F32C032616E03` | ❌ | ❌ |
| Nexus Bootstrap v1.3.0 | `0x000000007BfEdA33ac982cb38eAaEf5D7bCC954c` | ❌ | ❌ |
| Nexus Account Factory | `0x000000002c9A405a196f2dc766F2476B731693c3` | ❌ | ❌ |
| Composable Execution Module | `0x00000000f61636C0CA71d21a004318502283aB2d` | ❌ | ❌ |
| Composable Storage | `0x0000000078994c6ef6A4596BE53A728b255352c2` | ❌ | ❌ |
| ETH Forwarder | `0x000000C48Cdf2b46bEc062483dBD27046dfE3b8d` | ❌ | ❌ |

> **结论：Nexus/MEE 全部 13 个合约在 Morph 上均未部署。**需要 Biconomy 团队执行部署。

#### EIP-8004 Agent 身份合约

| 合约 | 地址 | 主网 (2818) | 测试网 (2910) |
|------|------|:-----------:|:------------:|
| IdentityRegistry | `0x672c7c7A9562B8d1e31b1321C414b44e3C75a530` | ✅ | ✅ |
| ReputationRegistry | `0x23AA2fD5D0268F0e523385B8eF26711eE820B4B5` | ✅ | ✅ |

### 1.2 Bundler 服务

| 端点 | 版本 | 主网 (2818) | 测试网 (2910) |
|------|------|:-----------:|:------------:|
| `bundler.biconomy.io/api/v2/` | v0.6 Legacy | ✅ 返回 EP v0.6.0 | ❌ 不支持 |
| `bundler.biconomy.io/api/v3/` | v0.7 MEE | ❌ 不支持 | ❌ 不支持 |

### 1.3 SDK 支持

| SDK | 包名 | EntryPoint | Morph 可用 |
|-----|------|-----------|:----------:|
| Biconomy Legacy V2 | `@biconomy/account` v4.5.7 | v0.6.0 | ✅ 主网（但 SDK 已 deprecated） |
| Biconomy Nexus/MEE | `@biconomy/abstractjs` | v0.7.0 | ❌ 缺上层合约 + Bundler 不支持 |

### 1.4 现状总结

```
EntryPoint v0.6.0 (Legacy):
  合约: ✅ 主网全部部署（10 个）
  Bundler: ✅ /api/v2 可用
  SDK: ⚠️ @biconomy/account 已 deprecated
  结论: 目前唯一可用路径，但 Biconomy 不再维护

EntryPoint v0.7.0 (MEE/Nexus):
  合约: ❌ 只有 EntryPoint 本身，缺 Nexus Account / Factory / Validator
  Bundler: ❌ /api/v3 不支持 Morph
  SDK: ❌ @biconomy/abstractjs 无法使用
  结论: 需要 Biconomy 部署 Nexus 合约 + 启用 Bundler

测试网 (2910):
  合约: ❌ 只有两个 EntryPoint + EIP-8004，无 Biconomy 上层合约
  Bundler: ❌ 完全不支持
  结论: 无法在测试网使用 Biconomy AA
```

---

## 2. ERC-4337 合约架构解析

> 源码位于 `contracts/erc4337/`，基于 ERC-4337 v0.8 规范

### 2.0.1 整体交互流程

```
User/Agent                Bundler               EntryPoint                Account              Paymaster
    │                        │                      │                       │                     │
    ├─ 构造 UserOp ─────────→│                      │                       │                     │
    │                        ├─ handleOps() ───────→│                       │                     │
    │                        │                      │                       │                     │
    │                        │     Phase 1: 验证    │                       │                     │
    │                        │                      ├─ createSender() ─────→│ (首次部署)           │
    │                        │                      ├─ validateUserOp() ───→│                     │
    │                        │                      │←─ 签名验证结果 ────────┤                     │
    │                        │                      ├─ validateNonce() ────→│                     │
    │                        │                      ├─ validatePaymaster() ─────────────────────→│
    │                        │                      │←─ context + validationData ────────────────┤
    │                        │                      │                       │                     │
    │                        │     Phase 2: 执行    │                       │                     │
    │                        │                      ├─ execute(callData) ──→│                     │
    │                        │                      │←─ 执行结果 ───────────┤                     │
    │                        │                      │                       │                     │
    │                        │     Phase 3: 结算    │                       │                     │
    │                        │                      ├─ postOp() ──────────────────────────────→│
    │                        │                      ├─ 退款 → sender/paymaster                   │
    │                        │                      ├─ 手续费 → beneficiary │                     │
    │                        │←─ receipt ───────────┤                       │                     │
```

### 2.0.2 PackedUserOperation — 核心数据结构

> `contracts/erc4337/interfaces/PackedUserOperation.sol`

```solidity
struct PackedUserOperation {
    address sender;               // Smart Account 地址
    uint256 nonce;                // 重放保护 (192-bit key | 64-bit sequence)
    bytes   initCode;             // Factory + init 调用（首次部署用）
    bytes   callData;             // 实际要执行的交易数据
    bytes32 accountGasLimits;     // 打包: [128-bit verificationGasLimit | 128-bit callGasLimit]
    uint256 preVerificationGas;   // 链下 bundler 固定开销
    bytes32 gasFees;              // 打包: [128-bit maxPriorityFeePerGas | 128-bit maxFeePerGas]
    bytes   paymasterAndData;     // Paymaster 地址 + gas limits + 自定义数据
    bytes   signature;            // 签名（ECDSA 或自定义验证逻辑）
}
```

**设计要点：**
- `accountGasLimits` 和 `gasFees` 用 `bytes32` 打包两个 128-bit 值，减少 calldata 开销
- `nonce` 高 192 位是 channel key，低 64 位是 sequence — 支持并行 nonce
- `initCode` 非空时触发首次账户部署（lazy deployment）

### 2.0.3 EntryPoint — 核心编排合约

> `contracts/erc4337/core/EntryPoint.sol` (958 行)

**主入口函数：**
```solidity
function handleOps(PackedUserOperation[] calldata ops, address payable beneficiary) external nonReentrant
```

**三阶段执行模型：**

| 阶段 | 做什么 | 失败后果 |
|------|--------|---------|
| **Phase 1: 验证** | 部署账户（如需）→ 验证签名 → 检查 nonce → 扣押预付金 → 验证 Paymaster | 整个 UserOp 被拒绝 |
| **Phase 2: 执行** | 调用 account.execute(callData) 执行实际交易 | callData revert 但仍然收 gas |
| **Phase 3: 结算** | 计算实际 gas → 调用 postOp → 退款 → 付手续费给 beneficiary | 罕见失败 |

**Gas 核算公式：**
```
prefund = (verificationGasLimit + callGasLimit + pmVerificationGasLimit + pmPostOpGasLimit + preVerificationGas) × maxFeePerGas
actualGasCost = actualGas × min(maxFeePerGas, maxPriorityFeePerGas + basefee)
refund = prefund - actualGasCost  →  退给 sender 或 paymaster
```

**未使用 gas 惩罚：** 如果未使用 gas 超过 40000，额外收取 10% 作为惩罚（防止故意高估 gasLimit 攻击 bundler）

**聚合签名支持：** `handleAggregatedOps()` 按 aggregator 分组批量验签（BLS 等方案可一次验证数百签名）

### 2.0.4 NonceManager — 并行 Nonce 通道

> `contracts/erc4337/core/NonceManager.sol`

```solidity
mapping(address => mapping(uint192 => uint256)) public nonceSequenceNumber;
```

**工作原理：**
```
nonce = [192-bit channel key][64-bit sequence number]

Channel 0: seq 0 → seq 1 → seq 2 → ...   (顺序执行)
Channel 1: seq 0 → seq 1 → ...             (独立并行)
Channel 2: seq 0 → ...                     (独立并行)
```

- 同一 channel 内必须顺序执行（单调递增）
- 不同 channel 完全独立，可以并行或乱序
- 最多 2^192 个 channel，每个 channel 最多 2^64 笔交易
- 用途：多个 agent 各用不同 channel，互不阻塞

### 2.0.5 StakeManager — 存款与质押

> `contracts/erc4337/core/StakeManager.sol`

```solidity
struct DepositInfo {
    uint256 deposit;           // 流动余额（付 gas 用）
    bool    staked;            // 是否锁定状态
    uint112 stake;             // 锁定金额
    uint32  unstakeDelaySec;   // 解锁等待时间
    uint48  withdrawTime;      // 解锁完成时间
}
```

**Deposit vs Stake 区别：**

| | Deposit（存款） | Stake（质押） |
|---|---|---|
| 用途 | 付 gas 费 | 提供经济担保 |
| 流动性 | 随时可取 | 需要等待 unstakeDelay |
| 消耗 | 被 EntryPoint 扣除 | 不被消耗 |
| 使用方 | Account / Paymaster | 主要是 Paymaster |

**关键函数：**

| 函数 | 用途 |
|------|------|
| `depositTo(address)` | 为任意地址充值 deposit |
| `addStake(uint32 unstakeDelaySec)` | 锁定 ETH 作为 stake |
| `unlockStake()` | 开始解锁倒计时 |
| `withdrawStake(address)` | 倒计时结束后提取 stake |
| `withdrawTo(address, uint256)` | 提取 deposit |

### 2.0.6 SimpleAccount — 账户实现

> `contracts/erc4337/accounts/SimpleAccount.sol`

**架构：** ERC1967 代理模式（所有账户共享同一份逻辑合约，通过 proxy 隔离状态）

```solidity
address public owner;                        // 唯一 owner（EOA 地址）
IEntryPoint private immutable _entryPoint;   // 不可变 EntryPoint 引用
```

**核心函数：**

| 函数 | 签名 | 访问控制 |
|------|------|---------|
| `initialize` | `initialize(address owner)` | 仅一次（initializer） |
| `validateUserOp` | `validateUserOp(userOp, hash, missingFunds)` → `uint256` | 仅 EntryPoint |
| `execute` | `execute(address target, uint256 value, bytes data)` | EntryPoint 或 owner |
| `executeBatch` | `executeBatch(Call[] calls)` | EntryPoint 或 owner |
| `addDeposit` | `addDeposit()` payable | 任何人 |
| `withdrawDepositTo` | `withdrawDepositTo(address, uint256)` | 仅 owner |

**签名验证逻辑：**
```solidity
function _validateSignature(userOp, userOpHash) internal override returns (uint256) {
    if (owner != ECDSA.recover(userOpHash, userOp.signature))
        return SIG_VALIDATION_FAILED;  // 返回 1
    return SIG_VALIDATION_SUCCESS;      // 返回 0
}
```

**执行模式：**
- `execute()` — 单笔调用，失败则 revert 整个交易
- `executeBatch(Call[])` — 批量调用，第一笔失败时 revert 并报告 index

### 2.0.7 SimpleAccountFactory — CREATE2 部署

> `contracts/erc4337/accounts/SimpleAccountFactory.sol`

```solidity
function createAccount(address owner, uint256 salt) public returns (SimpleAccount)
function getAddress(address owner, uint256 salt) public view returns (address)
```

**确定性地址：**
```
address = keccak256(0xff + factory_address + salt + keccak256(init_code))
```

- 地址在部署前就可计算（counterfactual）
- 相同 owner + salt 永远得到相同地址
- 只有 EntryPoint 的 SenderCreator 可以调用 createAccount（防止未授权部署）
- 账户在第一笔 UserOp 的 initCode 中被创建

### 2.0.8 BasePaymaster — Paymaster 框架

> `contracts/erc4337/core/BasePaymaster.sol`

**两个核心钩子：**

```solidity
// 验证阶段：决定是否赞助这笔交易
function _validatePaymasterUserOp(userOp, userOpHash, maxCost)
    → (bytes context, uint256 validationData)

// 执行后：结算（如扣除用户 ERC-20 余额）
function _postOp(PostOpMode mode, bytes context, uint256 actualGasCost, uint256 feePerGas)
```

**PostOpMode：**
- `opSucceeded` — 交易成功
- `opReverted` — 交易失败（但仍然收 gas）

**经济流程：**
```
1. EntryPoint 从 Paymaster deposit 扣除 maxCost
2. validatePaymasterUserOp() 检查是否愿意赞助
3. 交易执行
4. postOp() 被调用，Paymaster 可以：
   - 扣除用户的 ERC-20 token（Token Paymaster）
   - 记录 gas 使用量
   - 更新内部余额
5. refund = maxCost - actualGasCost → 退回 Paymaster deposit
```

---

## 3. 功能模块详解

### 3.1 Smart Account 创建

**SDK API**: `createSmartAccountClient()`

```
用户 EOA (MetaMask)
  ↓ 签名
Biconomy SmartAccountV2
  ├── 地址: 确定性派生 (CREATE2, 基于 owner + salt + factory)
  ├── 验证模块: ECDSA Ownership Module
  ├── EntryPoint: v0.6.0
  └── 首次 UserOp 时自动部署（lazy deployment）
```

**功能清单：**
- [x] 连接 EOA 钱包（MetaMask）
- [x] 计算 counterfactual 地址（无需 gas）
- [x] 查询 Smart Account ETH 余额
- [x] 从 EOA 向 Smart Account 充值
- [x] 首次交易自动部署 Smart Account

**依赖**: Bundler URL（已有）、钱包连接

**Gas 策略**:
- 无 Paymaster: Smart Account 需持有 ETH 付 gas
- 有 Paymaster: gasless（需 Dashboard API key）

---

### 3.2 Session Key 管理

**SDK API**: `createSession()`, `createSessionKeyEOA()`, `createSessionSmartAccountClient()`

```
Owner 创建 Session
  ├── 生成 Session Key EOA（本地密钥对）
  ├── 定义 Policy（权限规则）
  │   ├── contractAddress: 允许调用的合约
  │   ├── functionSelector: 允许调用的函数
  │   ├── rules[]: 参数约束规则
  │   ├── valueLimit: ETH 花费上限
  │   └── interval: {validUntil, validAfter} 时间范围
  ├── 发送 UserOp → 链上启用 Session Key Manager 模块
  └── Session 数据存储在浏览器 localStorage (SessionLocalStorage)

Agent 使用 Session
  ├── 从 localStorage 加载 Session
  ├── createSessionSmartAccountClient() 创建 session client
  ├── getSingleSessionTxParams() 获取签名参数
  └── 用 Session Key 签名 UserOp（无需 Owner 签名）
```

**功能清单：**
- [x] 生成 Session Key 密钥对
- [x] 配置合约白名单
- [x] 配置函数选择器白名单
- [x] 配置参数约束规则（ABI Session Validation）
- [x] 配置 ETH 花费上限（valueLimit）
- [x] 配置时间范围（validUntil / validAfter）
- [x] 链上创建 Session（UserOp）
- [x] 浏览器本地存储 Session 数据
- [x] 批量 Session 操作（Batched Session Router）
- [ ] Session 撤销（需要发送 UserOp 禁用 module leaf）

**权限规则 (rules[]) 详解：**

每条 rule 定义一个参数约束：
```typescript
{
  offset: number,      // 参数在 calldata 中的偏移量
  condition: number,   // 0=EQUAL, 1=GT, 2=LT, 3=GTE, 4=LTE, 5=NOT_EQUAL
  referenceValue: hex  // 参考值（32 bytes, left-padded）
}
```

示例：限制 transfer 金额 ≤ 0.1 ETH
```typescript
rules: [{
  offset: 32,  // 第二个参数 (amount)
  condition: 4,  // LTE
  referenceValue: pad(parseEther("0.1"), { size: 32 })
}]
```

---

### 3.3 Agent 自主执行

**核心价值**: Agent 持有 Session Key，可以在权限范围内自主执行交易，无需用户逐笔审批。

**执行流程：**
```
Agent 提出操作
  ↓
Session Key Manager 合约验证（链上强制执行）：
  ├── Session 是否在有效期内 (validUntil / validAfter)
  ├── 目标合约是否在白名单
  ├── 函数选择器是否匹配
  ├── 参数是否满足 rules 约束
  └── ETH value 是否在 valueLimit 内
  ↓ 全部通过
Session Key 签名 UserOp
  ↓
Bundler 提交到 EntryPoint
  ↓
EntryPoint.handleOps() 执行
```

**可执行操作：**
- ERC-8004 注册 Agent 身份
- ERC-8004 提交声誉反馈
- ERC-20 token transfer（受限）
- 任意白名单合约的白名单函数调用

**安全保证（链上强制）：**
- 调用非白名单合约 → 交易 revert
- 调用非白名单函数 → 交易 revert
- 参数超出 rules 约束 → 交易 revert
- 超过 valueLimit → 交易 revert
- 超过 validUntil → 交易 revert

---

### 3.4 ERC-8004 Agent 身份

**IdentityRegistry 合约功能：**

| 函数 | 签名 | 用途 |
|------|------|------|
| `register()` | `register()` → `uint256 agentId` | 最简注册（无 metadata） |
| `register(string)` | `register(string agentURI)` → `uint256 agentId` | 带 URI 注册 |
| `register(string, tuple[])` | `register(string agentURI, MetadataEntry[] metadata)` → `uint256 agentId` | 带 URI + metadata 注册 |
| `setMetadata` | `setMetadata(uint256 agentId, string key, bytes value)` | 设置 metadata |
| `getMetadata` | `getMetadata(uint256 agentId, string key)` → `bytes` | 读取 metadata |
| `getAgentWallet` | `getAgentWallet(uint256 agentId)` → `address` | 查询 agent 钱包地址 |
| `agentExists` | `agentExists(uint256 agentId)` → `bool` | 检查 agent 是否存在 |
| `ownerOf` | `ownerOf(uint256 tokenId)` → `address` | 查询 agent NFT owner |
| `balanceOf` | `balanceOf(address owner)` → `uint256` | 查询地址持有的 agent 数量 |

**MetadataEntry 结构：**
```solidity
struct MetadataEntry {
    string metadataKey;
    bytes metadataValue;
}
```

**关键特性：**
- 注册 = 铸造 ERC-721 NFT（agentId = tokenId）
- 每个地址可注册多个 agent
- metadata 支持任意 key-value 存储
- Agent 身份与 Smart Account 地址绑定

---

### 3.5 ERC-8004 Agent 声誉

**ReputationRegistry 合约功能：**

| 函数 | 签名 | 用途 |
|------|------|------|
| `giveFeedback` | `giveFeedback(uint256 agentId, uint64 value, uint8 valueDecimals, bytes32 tag1, bytes32 tag2, string endpoint, string feedbackURI, bytes32 feedbackHash)` | 提交评分反馈 |
| `getSummary` | `getSummary(uint256 agentId, address[] clients, bytes32 tag1, bytes32 tag2)` → `(count, value, decimals)` | 查询聚合声誉 |
| `readFeedback` | `readFeedback(uint256 agentId, address client, uint64 index)` → `(value, decimals, tag1, tag2, isRevoked)` | 读取单条反馈 |
| `readAllFeedback` | `readAllFeedback(uint256 agentId, address[] clients, bytes32 tag1, bytes32 tag2, bool includeRevoked)` → 批量读取 | 批量读取反馈 |
| `getClients` | `getClients(uint256 agentId)` → `address[]` | 查询所有评价者 |
| `revokeFeedback` | `revokeFeedback(uint256 agentId, uint64 index)` | 撤回反馈 |
| `appendResponse` | `appendResponse(uint256 agentId, address client, uint64 index, string uri, bytes32 hash)` | Agent 回复反馈 |

**评分模型：**
- `value`: 评分数值（uint64）
- `valueDecimals`: 小数位数（uint8），如 value=450, decimals=2 → 4.50 分
- `tag1`, `tag2`: 分类标签（bytes32），用于按维度筛选
- `feedbackURI`: 链下详细评价内容的 URI
- `feedbackHash`: 评价内容的哈希（完整性验证）

**声誉聚合：**
- `getSummary` 按 tag 筛选计算平均分
- 支持多个 client 地址的批量查询
- 已撤回的反馈可选择性包含/排除

---

### 3.6 安全看板

**可展示数据：**
- Smart Account ETH 余额
- 活跃 Session 数量及详情
- 每个 Session 的权限范围
- Session 过期倒计时
- 交易历史（通过 RPC 查询）
- Agent 身份信息
- Agent 声誉评分

---

## 4. 完整用户流程

```
┌──────────────────────────────────────────────────────────┐
│ Step 1: Setup                                            │
│   ① 连接 MetaMask（切换到 Morph 主网 2818）               │
│   ② 查看 Smart Account 地址（counterfactual）             │
│   ③ 充值 ETH 到 Smart Account（MetaMask 转账）            │
│                                                          │
│ Step 2: 注册 Agent 身份                                   │
│   ④ 调用 IdentityRegistry.register(uri)                  │
│   ⑤ 获得 agentId（NFT）                                  │
│   ⑥ 可选：设置 metadata                                  │
│                                                          │
│ Step 3: 创建 Session Key                                  │
│   ⑦ 生成 Session Key 密钥对                               │
│   ⑧ 配置权限：合约白名单、函数白名单、花费上限、有效期      │
│   ⑨ 链上创建 Session（UserOp）                            │
│                                                          │
│ Step 4: Agent 自主操作                                    │
│   ⑩ Agent 使用 Session Key 签名交易                       │
│   ⑪ 无需用户确认，直接提交 UserOp                         │
│   ⑫ 链上权限验证 → 执行/拒绝                              │
│                                                          │
│ Step 5: 声誉积累                                          │
│   ⑬ 其他用户调用 giveFeedback 评价 Agent                  │
│   ⑭ Agent 可调用 appendResponse 回复反馈                  │
│   ⑮ 声誉聚合可被其他 Agent/服务查询                        │
└──────────────────────────────────────────────────────────┘
```

---

## 5. 前端 Demo Tabs 设计

### Tab 1: Setup
- 连接钱包 / 断开连接
- Smart Account 地址 + 余额
- "Fund Account" 按钮（EOA → Smart Account 转账）
- 网络信息（Morph 2818, EntryPoint 地址）

### Tab 2: Identity (ERC-8004)
- 注册 Agent（输入 URI）
- 查询已注册 Agent（agentId, owner, wallet）
- 设置/查看 metadata
- 查询声誉评分（getSummary）
- 提交反馈（giveFeedback）

### Tab 3: Session Keys
- 创建表单：合约选择、函数选择、花费上限、过期时间
- 活跃 Session 列表（含过期倒计时）
- Session 详情（权限范围、已用/剩余额度）

### Tab 4: Agent
- 选择 Session Key
- 选择操作：注册身份 / 提交反馈 / 自定义调用
- 执行权限检查（链上验证）
- 交易结果展示

### Tab 5: Security
- 统计面板：活跃 Session、总交易数、总花费
- Session 健康度（过期警告）
- Smart Account 余额监控
- 交易日志

### 底部: Terminal Console
- 实时日志输出
- UserOp hash、交易 hash
- 错误信息

---

## 6. 技术约束和注意事项

1. **必须在 Morph 主网操作** — Biconomy Bundler 不支持 Morph 测试网
2. **Smart Account 需要 ETH** — 无 Paymaster 时，Smart Account 需持有 ETH 付 gas
3. **Paymaster 可选** — 有 Dashboard API key 时可启用 gasless 模式（`NEXT_PUBLIC_BICONOMY_PAYMASTER_KEY`）
4. **Session 存储在 localStorage** — 清除浏览器数据会丢失 Session（链上 Session 仍然有效，但本地密钥丢失）
5. **Bundler API Key 已内置** — `nJPK7B3ru.dd7f7861-190d-41bd-af80-6877f74b8f44` 已验证可用
6. **SDK 版本限制** — 使用 `@biconomy/account` v4.5.7 (Legacy V2)，不支持 Nexus/MEE 功能
