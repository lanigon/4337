# ERC-4337 合约版本对比文档

> 基于 eth-infinitism/account-abstraction 仓库各版本的实际代码

---

## 1. 目录结构

```
4337contracts/
├── v06/             ERC-4337 v0.6.0 (2023-04, Solidity 0.8.17)
├── v07/             ERC-4337 v0.7.0 (2024-02, Solidity 0.8.23)
├── v08/             ERC-4337 v0.8.0 (2024-03, Solidity 0.8.28)
├── v09/             ERC-4337 v0.9.0 (2024-11, Solidity 0.8.28)
├── base/            Coinbase Smart Wallet 方案
├── biconomy/        Biconomy SmartAccountV2 方案
└── polygon/         Polygon Agent CLI + Sequence 方案
```

---

## 2. 官方合约文件清单（v0.6 → v0.9）

### 2.1 核心合约（core/）

| 合约 | v0.6 | v0.7 | v0.8 | v0.9 | 说明 |
|------|:----:|:----:|:----:|:----:|------|
| EntryPoint.sol | ✅ | ✅ | ✅ | ✅ | 核心调度：handleOps 验证+执行+结算 |
| NonceManager.sol | ✅ | ✅ | ✅ | ✅ | 192-bit key 并行 nonce 通道 |
| StakeManager.sol | ✅ | ✅ | ✅ | ✅ | deposit（流动）+ stake（锁定）管理 |
| SenderCreator.sol | ✅ | ✅ | ✅ | ✅ | 辅助部署 Smart Account |
| Helpers.sol | ✅ | ✅ | ✅ | ✅ | 通用工具（validationData 打包等） |
| UserOperationLib.sol | ❌ | ✅ | ✅ | ✅ | UserOp 打包/解包工具（v0.7 新增） |
| Eip7702Support.sol | ❌ | ❌ | ✅ | ✅ | EIP-7702 账户委托支持（v0.8 新增） |

### 2.2 接口定义（interfaces/）

| 接口 | v0.6 | v0.7 | v0.8 | v0.9 | 说明 |
|------|:----:|:----:|:----:|:----:|------|
| IEntryPoint.sol | ✅ | ✅ | ✅ | ✅ | EntryPoint 完整接口 |
| IAccount.sol | ✅ | ✅ | ✅ | ✅ | Smart Account 必须实现 validateUserOp |
| IPaymaster.sol | ✅ | ✅ | ✅ | ✅ | Paymaster 接口：validatePaymasterUserOp + postOp |
| IAggregator.sol | ✅ | ✅ | ✅ | ✅ | 签名聚合器接口（BLS 等） |
| INonceManager.sol | ✅ | ✅ | ✅ | ✅ | Nonce 管理接口 |
| IStakeManager.sol | ✅ | ✅ | ✅ | ✅ | Stake 管理接口 |
| UserOperation.sol | ✅ | ❌ | ❌ | ❌ | v0.6 的 UserOp 结构体（11 个独立字段） |
| PackedUserOperation.sol | ❌ | ✅ | ✅ | ✅ | v0.7+ 的 UserOp 结构体（打包字段） |
| IAccountExecute.sol | ❌ | ✅ | ✅ | ✅ | 可选的 executeUserOp 接口（v0.7 新增） |
| ISenderCreator.sol | ❌ | ❌ | ✅ | ✅ | SenderCreator 接口（v0.8 新增） |

### 2.3 参考实现（samples/ 或 accounts/）

| 合约 | v0.6 | v0.7 | v0.8 | v0.9 | 说明 |
|------|:----:|:----:|:----:|:----:|------|
| SimpleAccount.sol | ✅ | ✅ | ✅ | ✅ | 最简 ECDSA 单 owner 钱包 |
| SimpleAccountFactory.sol | ✅ | ✅ | ✅ | ✅ | CREATE2 工厂 |
| BaseAccount.sol | ✅ | ✅ | ✅ | ✅ | Smart Account 抽象基类 |
| TokenCallbackHandler.sol | ✅ | ✅ | ❌ | ❌ | ERC-721/1155 接收回调（v0.8 移除） |
| Simple7702Account.sol | ❌ | ❌ | ✅ | ✅ | EIP-7702 委托账户（v0.8 新增） |

### 2.4 工具（utils/）

| 合约 | v0.6 | v0.7 | v0.8 | v0.9 | 说明 |
|------|:----:|:----:|:----:|:----:|------|
| Exec.sol | ✅ | ✅ | ✅ | ✅ | call/delegatecall 封装 |

### 2.5 OpenZeppelin 依赖

| 依赖 | v0.6 | v0.7 | v0.8 | v0.9 | 说明 |
|------|:----:|:----:|:----:|:----:|------|
| ReentrancyGuard | ✅ | ✅ | ❌ | ❌ | v0.8 换成 Transient 版本 |
| ReentrancyGuardTransient | ❌ | ❌ | ✅ | ❌ | v0.8 用 transient storage |
| ERC165 | ❌ | ✅ | ✅ | ✅ | supportsInterface（v0.7 新增） |
| EIP712 | ❌ | ❌ | ✅ | ✅ | 结构化签名（v0.8 新增） |
| SafeCast | ❌ | ❌ | ✅ | ✅ | 安全类型转换 |
| TransientSlot | ❌ | ❌ | ✅ | ❌ | v0.8 用，v0.9 去掉了 |

---

## 3. 标准包含 vs 不包含

### ERC-4337 标准包含的（官方写的）

```
✅ EntryPoint          — 唯一的全链统一合约
✅ NonceManager        — 并行 nonce
✅ StakeManager        — deposit/stake
✅ SenderCreator       — 账户部署辅助
✅ IAccount 接口       — Smart Account 必须实现
✅ IPaymaster 接口     — Paymaster 必须实现
✅ IAggregator 接口    — 签名聚合（可选）
✅ SimpleAccount       — 参考实现（可以不用）
✅ BaseAccount         — 抽象基类（可以不用）
✅ BasePaymaster       — Paymaster 基类（在 simple-account 包里）
```

### ERC-4337 标准不包含的（各家自己做的）

```
❌ Session Key         — Biconomy/ZeroDev 各自实现
❌ Module 系统         — Biconomy 模块化 / ERC-7579
❌ 多签 / 社交恢复     — Safe / ZeroDev 实现
❌ Passkey 登录        — Coinbase 实现
❌ Token Paymaster     — Biconomy/Pimlico 实现
❌ Bundler 服务        — 链下服务，不在合约里
❌ Paymaster 后端      — 链下服务
❌ SDK                 — 链下库
```

---

## 4. 版本间关键变化

### v0.6 → v0.7

```
UserOperation 结构体变化:
  v0.6: 11 个独立字段
    callGasLimit, verificationGasLimit   ← 各自独立
    maxFeePerGas, maxPriorityFeePerGas   ← 各自独立

  v0.7: 打包成 bytes32
    accountGasLimits    ← 打包 verificationGasLimit + callGasLimit
    gasFees             ← 打包 maxPriorityFeePerGas + maxFeePerGas

新增:
  + UserOperationLib.sol     — 打包/解包工具
  + PackedUserOperation.sol  — 新结构体定义
  + IAccountExecute.sol      — 可选的 executeUserOp 接口
  + ERC165 支持              — supportsInterface
  + 未使用 gas 10% 惩罚     — 防攻击 bundler
  + 模拟函数移到链下         — 减少链上代码

影响:
  v0.6 的 Smart Account 不能用在 v0.7 EntryPoint 上（结构体不兼容）
  v0.7 的 Smart Account 不能用在 v0.6 EntryPoint 上
  完全不能混用
```

### v0.7 → v0.8

```
新增:
  + Eip7702Support.sol       — EIP-7702 原生账户委托
  + Simple7702Account.sol    — 7702 参考实现
  + EIP-712 签名             — 结构化 UserOp hash
  + ISenderCreator.sol       — SenderCreator 接口独立出来
  + TransientSlot            — transient storage 优化
  + initCode 防 front-running — 防抢先部署

移除:
  - TokenCallbackHandler.sol — 不再作为参考实现的一部分
  - ReentrancyGuard          — 换成 ReentrancyGuardTransient

文件路径变化:
  v0.6/v0.7: contracts/samples/SimpleAccount.sol
  v0.8/v0.9: contracts/accounts/SimpleAccount.sol
  （从 samples 移到 accounts，表示不再是"示例"）

影响:
  v0.8 向后兼容 v0.7 的 Smart Account（ABI 不变）
  但 EntryPoint 内部实现有变化
  需要 EIP-7702 链级支持才能用 7702 功能
```

### v0.8 → v0.9

```
新增:
  + paymasterSignature 字段   — Paymaster 签名可并行化
  + 区块号验证范围            — validAfter/validUntil 最高位=1 表示区块号
  + getCurrentUserOpHash()    — 执行时可查当前 UserOp hash
  + initCode 静默处理         — 账户已存在时不 revert
  + BasePaymaster 构造器改    — owner 必须显式传入

移除:
  - TransientSlot             — 不再使用 transient storage
  - ReentrancyGuardTransient  — 回到普通方式

影响:
  v0.9 完全向后兼容 v0.7/v0.8
  已有的 Smart Account 和 Paymaster 不需要改代码
  只有想用新功能（并行签名、区块号验证）才需要更新
```

---

## 5. Paymaster 在标准中的位置

```
ERC-4337 标准定义了:
  ✅ IPaymaster.sol 接口
     ├── validatePaymasterUserOp(userOp, userOpHash, maxCost)
     │   → 返回 (context, validationData)
     │   → 决定是否赞助这笔交易
     └── postOp(mode, context, actualGasCost, actualUserOpFeePerGas)
         → 交易执行后结算

  ✅ BasePaymaster.sol 抽象基类（在 simple-account 包里）
     ├── 封装了 _requireFromEntryPoint()
     ├── deposit() / withdrawTo() / addStake() / unlockStake()
     └── 子类只需实现 _validatePaymasterUserOp 和 _postOp

标准不提供的:
  ❌ 具体的 Paymaster 实现（谁能被赞助、怎么收费）
  ❌ Token Paymaster（用 ERC-20 付 gas）
  ❌ Verifying Paymaster（链下签名验证）
  ❌ Paymaster 后端服务
  → 这些由 Biconomy、Pimlico、Alchemy 等各自实现
```

---

## 6. 部署地址（全链统一）

| 版本 | EntryPoint 地址 | SenderCreator 地址 |
|------|----------------|-------------------|
| v0.6.0 | `0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789` | 内嵌在 EntryPoint 中 |
| v0.7.0 | `0x0000000071727De22E5E9d8BAf0edAc6f37da032` | 内嵌在 EntryPoint 中 |
| v0.8.0 | `0x4337084d9e255ff0702461cf8895ce9e3b5ff108` | 内嵌在 EntryPoint 中 |
| v0.9.0 | `0x433709009B8330FDa32311DF1C2AFA402eD8D009` | `0x0A630a99Df908A81115A3022927Be82f9299987e` |

### Morph 部署状态

| 版本 | 主网 (2818) | 测试网 (2910) |
|------|:-----------:|:------------:|
| v0.6.0 | ✅ | ✅ |
| v0.7.0 | ✅ | ✅ |
| v0.8.0 | ❌ | ❌ |
| v0.9.0 | ❌ | ❌ |

### 主流链部署状态

| 链 | v0.6 | v0.7 | v0.8 | v0.9 |
|---|:---:|:---:|:---:|:---:|
| Ethereum | ✅ | ✅ | ✅ | ✅ |
| Polygon | ✅ | ✅ | ✅ | ✅ |
| Base | ✅ | ✅ | ✅ | ✅ |
| Arbitrum | ✅ | ✅ | ✅ | ✅ |
| Optimism | ✅ | ✅ | ✅ | ✅ |
| Scroll | ✅ | ✅ | ✅ | ✅ |
| BSC | ✅ | ✅ | ✅ | ✅ |
| Morph | ✅ | ✅ | ❌ | ❌ |

---

## 7. 各家方案对比

### Base (Coinbase)

```
合约:
  CoinbaseSmartWallet.sol   ← 自研，支持多 owner（EOA + Passkey）
  CoinbaseSmartWalletFactory.sol
  MultiOwnable.sol          ← 多设备/多 owner 管理
  ERC1271.sol               ← 合约签名验证
  WebAuthn.sol              ← Passkey/指纹认证

特点:
  ✅ Passkey 登录（无需 MetaMask）
  ✅ 多 owner（多设备同时登录）
  ✅ 跨 248 条链统一地址
  ✅ 开源
  ❌ 不支持 Session Key
  ❌ 不支持 Module 系统

EntryPoint: v0.6.0
Bundler: Coinbase 自建
Paymaster: Coinbase 自建（送 0.25 ETH credits）
```

### Biconomy

```
合约:
  SmartAccount.sol           ← 模块化钱包
  SmartAccountFactory.sol
  ModuleManager.sol          ← 模块管理（可插拔）
  EcdsaOwnershipRegistryModule.sol ← ECDSA 签名验证
  SessionKeyManager.sol      ← Session Key 权限管理
  ABISessionValidationModule.sol   ← 参数级别权限验证

特点:
  ✅ Module 系统（可插拔验证/执行模块）
  ✅ Session Key（Agent 自主执行）
  ✅ 批量 Session（Batched Session Router）
  ✅ ABI 级参数约束
  ❌ SDK 已 deprecated
  ❌ Bundler 已下线

EntryPoint: v0.6.0
Bundler: Biconomy（已永久下线）
Paymaster: Biconomy（需 API key，已不可用）
```

### Polygon (Sequence)

```
合约:
  Wallet.sol                 ← 多签智能合约钱包
  Factory.sol                ← 钱包工厂
  MainModule.sol             ← 主模块（交易执行）
  GuestModule.sol            ← 访客模块（无需 owner 签名的操作）
  ModuleAuth.sol             ← 模块认证
  ModuleCalls.sol            ← 模块调用封装

特点:
  ✅ 不走 ERC-4337 EntryPoint（自己的 AA 方案）
  ✅ Session-scoped wallets（per-app 权限隔离）
  ✅ Sequence Relayer（类似 Bundler 但不走 EntryPoint）
  ✅ 全链路 USDC 结算
  ✅ Agent CLI 工具链
  ✅ ERC-8004 Agent 身份
  ❌ 不是标准 ERC-4337

EntryPoint: 不使用
Bundler: Sequence Relayer
Paymaster: Sequence 代付（USDC）
```

---

## 8. 行业采用版本

| 服务商 | 使用版本 | 备注 |
|--------|---------|------|
| Coinbase | v0.6 | CoinbaseSmartWallet 硬编码 v0.6 地址 |
| Biconomy Legacy | v0.6 | SmartAccountV2，已 deprecated |
| Biconomy Nexus/MEE | v0.7 | 新版，需付费部署 |
| Pimlico | v0.6 + v0.7 | 两个都支持 |
| Alchemy | v0.6 + v0.7 | 两个都支持 |
| ZeroDev | v0.7 | Kernel 账户 |
| Safe | v0.6 + v0.7 | Safe + 4337 Module |
| Polygon | 不用 | Sequence 自己的方案 |

**当前主流仍然是 v0.6，v0.7 在逐步推进，v0.8/v0.9 尚无主流采用。**
