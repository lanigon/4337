# Agent Wallet 竞品深度技术分析

日期: 2026-03-19

---

## 1. Openfort (openfort.xyz)

### 概览

Openfort 是一个 Account Abstraction 基础设施提供商，提供 ERC-4337 Bundler、Paymaster、Smart Account 和 TEE 后端钱包。支持 25+ EVM 链。

### Smart Account 架构

**GitHub 仓库**: https://github.com/openfort-xyz/openfort-contracts

三种账户实现:
- **UpgradeableOpenfortAccount** — ERC-1967 代理模式，可升级，支持社交恢复
- **ManagedOpenfortAccount** — 托管账户，带社交恢复
- **ERC6551OpenfortAccount** — Token Bound Account 实验（ERC-6551 + ERC-4337）

标准兼容: ERC-4337, ERC-6551, ERC-1271, EIP-712, ERC-1967

### Session Key 实现（链上）

Session Key 完全在链上验证，定义在 `BaseOpenfortAccount.sol` 中:

```solidity
struct SessionKeyStruct {
    uint48 validAfter;      // 生效时间
    uint48 validUntil;      // 过期时间
    uint48 limit;           // 交易次数限制
    bool masterSessionKey;  // 是否为主密钥（无限权限）
    bool whitelisting;      // 是否启用合约白名单
    mapping(address => bool) whitelist;  // 允许交互的合约地址
    address registrarAddress;  // 注册者（必须是 owner）
}
```

**三种权限模型:**

| 类型 | 条件 | 行为 |
|------|------|------|
| Master Key | limit = 2^48 - 1, 无白名单 | 在有效期内无限制执行 |
| Whitelisted Key | 白名单非空 | 只能调用白名单内的合约 |
| Limited Key | limit > 0, 非 master | 每次交易 limit-1，归零后无法执行 |

**关键限制:**
- 白名单最多 10 个地址
- `executeBatch()` 最多 9 笔交易
- 禁止 self-call（防重入）
- 批量操作一次性扣减 limit

**核心函数:**
- `registerSessionKey(address, uint48, uint48, uint48, address[])` — 注册
- `revokeSessionKey(address)` — 撤销
- `isValidSessionKey(address, bytes)` — 验证（仅支持 execute/executeBatch）

### 已部署合约地址

从 `openfort-deployer` 仓库提取（CREATE2 确定性部署，跨链相同地址）:

| 合约 | 地址 |
|------|------|
| OPFPaymasterV3 (EP v0.8) | `0x8888fee873E7035789Db91C16b5dDDbad7214CDa` |
| OPFPaymasterV3 (EP v0.9) | `0x9999feeE50Fc515023F207b1c61aB3eA419e27d0` |
| OPFPaymasterV3 (EP v0.9 Async) | `0x9999fEe91eeF78fA05E03ea722Bb441151e7f63B` |
| GasPolicy | `0x4337fEeEC9Af990cda9E99B4c1c480A2a9700301` |
| WebAuthnVerifier | `0x00000256d7ef704c043cb352D7D6D3546A720A2e` |
| P256Verifier | `0x000000000000D01eA45F9eFD5c54f037Fa57Ea1a` |
| OPFMain (EIP-7702 v1, EP v0.8) | `0x7702000152F33A40E1Fd30C70E708f624113aa68` |
| OPFMain (EIP-7702 v1, EP v0.9) | `0x77020901f40BE88Df754E810dA9868933787652B` |
| Implementation (Smart Account) | `0x6e4a235c5f72a1054abFeb24c7eE6b48AcDe90ab` |
| EntryPoint v0.6 | `0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789` |
| EntryPoint v0.7 | `0x0000000071727De22E5E9d8BAf0edAc6f37da032` |
| EntryPoint v0.8 | `0x4337084D9E255Ff0702461CF8895CE9E3b5Ff108` |

注意: Factory 地址和具体链部署需要通过 deployer 工具 + salt 值计算得出，不是硬编码。

### TEE 后端钱包

**技术栈:**
- 硬件: AMD SEV-SNP（Secure Encrypted Virtualization - Secure Nested Paging）
- 平台: GCP Confidential Space
- 不是 Intel SGX，不是 ARM TrustZone

**密钥层级:**
```
Cloud KMS
  └── KEK (Key Encryption Key)
        └── Per-wallet DEK (Data Encryption Key)
              └── Private Key (仅在 enclave 内解密)
```

**工作流程:**
1. 密钥在 enclave 内生成，私钥从不离开 enclave
2. 每次签名请求必须通过 attestation 验证
3. KMS 只有在 attestation 合法时才解密 KEK
4. KEK 解密 DEK → DEK 解密私钥 → 在 enclave 内签名
5. 签名延迟 < 125ms

**密钥导入/导出:** RSA-4096 OAEP 端到端加密

**Agent 自主执行模式:**
- TEE EOA 钱包 + EIP-7702 delegation → 临时获得 Smart Account 能力
- 不需要部署独立的智能合约
- 钱包地址不变，通过 delegation 获得 session key、paymaster 等功能
- 支持 USDC 付 gas（通过 PaymasterV3 动态费率转换）

### 生产就绪度

**生产就绪。** 25+ EVM 链支持，有 Foundry 测试套件 + Slither + Mythril 安全分析。已上线应用。Gas 效率: 账户创建 ~250k gas，UserOp 转账 ~170k gas。GPL-3.0 开源。

---

## 2. Lit Protocol (litprotocol.com)

### 概览

Lit Protocol 是一个去中心化密钥管理网络，核心是 PKP（Programmable Key Pairs）— 通过 MPC/DKG（分布式密钥生成）产生的 ECDSA 密钥对，私钥从不完整存在于任何单一节点。

### PKP 工作原理

```
Lit Network (N 个节点)
  ├── Node 1: key-share-1
  ├── Node 2: key-share-2
  ├── ...
  └── Node N: key-share-N
        ↓ (threshold signing)
  签名结果（私钥从未重组）
```

- PKP 表示为 ERC-721 NFT，NFT 持有者是密钥的"控制者"
- 签名通过阈值签名方案完成，任何单个节点（包括 Lit 团队）都无法重建完整私钥
- PKP 可以拥有以太坊地址，持有资产，签署交易

### Agent Wallet（已弃用 → Vincent 取代）

**原始仓库**: https://github.com/LIT-Protocol/agent-wallet（已弃用）

**架构:**
- Admin（持有 PKP NFT）定义 tools 和 policies
- Delegatee（开发者）在 policy 约束内执行 agent intents
- Tools 是不可变的 JavaScript 代码，发布到 IPFS（Lit Actions）
- Policies 也发布到 IPFS，在执行前验证请求

**包结构:**
| 包 | 功能 |
|----|------|
| aw-tool | 工具基础接口 |
| aw-tool-registry | 工具发现和管理 |
| aw-signer | PKP 管理、policy 执行、签名 |
| aw-subagent-openai | GPT-4o 意图解析 |
| law-cli | 命令行界面 |

### Vincent（当前方案）

**GitHub**: https://github.com/LIT-Protocol/Vincent

Vincent 是 Agent Wallet 的继任者，扩展了委托访问模型:

**核心组件:**
- **Agent Wallets** — PKP 支持的非托管账户
- **Abilities** — 不可变 Lit Actions，定义 agent 可执行的操作
- **Policies** — 可编程约束（消费限额、MFA、速率限制、时间限制）
- **Connect Page** — 用户审批界面
- **On-chain App Registry** — 智能合约，跟踪授权

**与 Agent Wallet 的区别:** Vincent 是通用框架（DeFi + TradFi + 电商），Agent Wallet 只做 DeFi。Vincent 有完整的 App 注册机制和用户审批流程。

### ERC-4337 / ERC-7579 兼容性

**不是原生 ERC-4337 账户。** PKP 本质是分布式 MPC 密钥，不是链上 Smart Account。

但有集成路径:
1. **PKP as ERC-7579 Executor Module** — PKP 作为模块安装到 ERC-7579 Smart Account 中
2. **Smart Account Owns PKP** — Smart Account 持有 PKP NFT，通过 intent 系统控制签名

**集成仓库**: https://github.com/LIT-Protocol/lit-eip-7579-module

**已部署集成合约（Base Sepolia）:**
| 合约 | 地址 |
|------|------|
| LitPKPExecutor | `0x5C3cdbD408282b5f44009dEA215d4A5A1CEfd918` |
| IntentValidator | `0x35B1d5709507259CC689c87d38Fc5768691ba7C0` |
| PKPOwnerModule | `0x4aC9D1E06068992C70B57F12a78205A1aB5E6a10` |

### Session Key / Permission 系统

Lit 的"session key"概念与 ERC-4337 不同:
- **不是链上 session key**，而是 PKP 签名权限的委托
- 通过 Auth Methods 控制谁可以触发 PKP 签名（Google OAuth, WebAuthn, Ethereum wallet 等）
- Lit Actions（IPFS 上的 JS 代码）作为"可编程条件"，决定是否执行签名
- Policies 在 Lit 节点内验证，不是在 EVM 链上验证

### 已部署核心合约（Naga Mainnet — Lit Chain）

从 `LIT-Protocol/networks` 仓库 `naga-prod` 提取:

| 合约 | 地址 |
|------|------|
| PKPNFT | `0x11eBfFeab32f6cb5775BeF83E09124B9322E4026` |
| PKPPermissions | `0xEB1F9A8567bC01b8cfa9d6e7078bEf587D908342` |
| PKPHelper | `0xAe666c3080AA5Dd935574099c18E1eD779FFB231` |
| PKPHelperV2 | `0x2B0F165965f63800F3c4c7e226E6411cc42729a8` |
| PKPNFTMetadata | `0x20DC21B64c59807A491f6739B2B9d39bb304Fb9d` |
| PubkeyRouter | `0x5655D71832f6f2AFD72c3012a60144f5572897F1` |
| Staking | `0x8a861B3640c1ff058CCB109ba11CA3224d228159` |
| LITToken | `0x0996A48f8cc3c7c52Caf10d34c804eF5C9E7748B` |
| ContractResolver | `0xf5d51a8A91152cA3b901d26528cfC21a4eC11fdF` |
| PaymentDelegation | `0x5EF658cB6ab3C3BfB75C8293B9a6C8ccb0b96C3c` |
| Allowlist | `0x094CF9F8BBfc633AB2Eb8CdbBE8552a172fAdD80` |
| Ledger | `0x9BD023448d2D3b2D73fe61E4d7859007F6dA372c` |
| Forwarder | `0xa6A0Db95022e7859f1dff81D0Fedd5f9e38f042D` |

注意: 这些合约部署在 Lit 自己的链（Lit Chain / Naga），不是以太坊主网。

**Datil（旧网络，已于 2026-02-25 关闭）合约:**
- PKPPermissions (datil): `0x213Db6E1446928E19588269bEF7dFc9187c4829A`
- PKPPermissions (datil-test): `0x60C1ddC8b9e38F730F0e7B70A2F84C1A98A69167`

### 生产就绪度

**条件性生产就绪。** Naga 主网已上线，7000+ Vincent Agent Wallet 已创建。但:
- 依赖 Lit 自有链和节点网络（中心化风险）
- PKP 不是标准 ERC-4337，需要额外集成层
- Datil → Naga 迁移不兼容，PKP 需要重新铸造
- Naga Network 已宣布 sunset，正在向 Lit v3 过渡

---

## 3. Alchemy Account Kit (Modular Account V2)

### 概览

Alchemy 的 Modular Account V2 是基于 ERC-6900 标准的模块化智能合约账户，与 ERC-4337 完全兼容。核心特点是模块化验证和执行分离。

### 架构

**GitHub**: https://github.com/alchemyplatform/modular-account

**ERC-6900 标准:**
- 定义了模块化 Smart Account 的标准接口
- 区分 Validation Modules（认证）和 Execution Modules（权限控制）
- 模块自行管理自己的状态（通过 `onInstall` 初始化）

**账户变体:**

| 变体 | 用途 | 特点 |
|------|------|------|
| ModularAccount | 完整模块化 | 支持所有模块类型 |
| SemiModularAccount-Bytecode (SMA-B) | Gas 优化 | owner 存在 proxy bytecode 中 |
| SemiModularAccount-Storage (SMA-S) | 可升级 | owner 存在 storage 中 |
| SemiModularAccount-7702 (SMA-7702) | EIP-7702 | fallback signer = address(this) |

**模块系统:**

```
Account
├── Validation Modules
│   ├── SingleSignerValidation (ECDSA secp256k1)
│   └── WebAuthnValidation (Passkey)
├── Permission Modules (Hooks)
│   ├── AllowlistModule (地址/函数白名单 + ERC-20 限额)
│   ├── NativeTokenLimitModule (原生代币限额，含 gas)
│   ├── PaymasterGuardModule (强制使用指定 paymaster)
│   └── TimeRangeModule (时间窗口限制)
└── Execution (external calls / batching)
```

### Session Key 实现

**MAv2 没有独立的 SessionKeyPlugin 合约。** Session key 通过模块组合实现:

1. 安装一个 `SingleSignerValidationModule`（entity ID 非 0）作为 session key signer
2. 附加权限 hooks:
   - `TimeRangeModule` → 限制有效期
   - `AllowlistModule` → 限制可调用的合约/函数
   - `NativeTokenLimitModule` → 限制原生代币消费（含 gas）
3. 权限是**减法模型** — 默认全部允许，每个 hook 减去一部分权限

**示例场景:** "24小时有效、最多花 0.001 ETH（含 gas）和 100 USDC、只能调用一个特定合约的一个特定函数的 session key"

这通过组合安装 TimeRangeModule + NativeTokenLimitModule + AllowlistModule 实现。

**Deferred Actions:** 支持在 UserOp validation 阶段原子性安装 session key（通过 EIP-712 签名的 DeferredAction），不需要额外交易。

**注意: Modular Account V1（v1.0.x 分支）有独立的 SessionKeyPlugin:**

V1 SessionKeyPlugin（已弃用）接口:
```solidity
enum ContractAccessControlType { ALLOWLIST, DENYLIST, ALLOW_ALL_ACCESS }

struct SpendLimitInfo {
    bool hasLimit;
    uint256 limit;
    uint256 limitUsed;
    uint48 refreshInterval;
    uint48 lastUsedTime;
}
```

功能: `executeWithSessionKey`, `addSessionKey`, `removeSessionKey`, `rotateSessionKey`, `updateKeyPermissions`
权限: ERC-20 消费限额（可刷新）、原生代币限额、gas 限额、地址 allowlist/denylist、必需 paymaster、时间范围

### 已部署合约地址（所有 EVM 链相同）

**Modular Account V2:**

| 合约 | 地址 |
|------|------|
| ModularAccount | `0x00000000000002377B26b1EdA7b0BC371C60DD4f` |
| SemiModularAccount7702 | `0x69007702764179f14F51cdce752f4f775d74E139` |
| SemiModularAccountBytecode | `0x000000000000c5A9089039570Dd36455b5C07383` |
| SemiModularAccountStorageOnly | `0x0000000000006E2f9d80CaEc0Da6500f005EB25A` |
| ExecutionInstallDelegate | `0x0000000000008e6a39E03C7156e46b238C9E2036` |
| AccountFactory | `0x00000000000017c61b5bEe81050EC8eFc9c6fecd` |
| WebAuthnFactory | `0x55010E571dCf07e254994bfc88b9C1C8FAe31960` |

**Validation Modules:**

| 模块 | 地址 |
|------|------|
| SingleSignerValidationModule | `0x00000000000099DE0BF6fA90dEB851E2A2df7d83` |
| WebAuthnValidationModule | `0x0000000000001D9d34E07D9834274dF9ae575217` |

**Permission Modules (Hooks):**

| 模块 | 地址 |
|------|------|
| AllowlistModule | `0x00000000003e826473a313e600b5b9b791f5a59a` |
| NativeTokenLimitModule | `0x00000000000001e541f0D090868FBe24b59Fbe06` |
| PaymasterGuardModule | `0x0000000000001aA7A7F7E29abe0be06c72FD42A1` |
| TimeRangeModule | `0x00000000000082B8e2012be914dFA4f62A0573eA` |

### 与 ZeroDev Kernel 的核心区别

| 维度 | Alchemy MAv2 (ERC-6900) | ZeroDev Kernel (ERC-7579) |
|------|------------------------|--------------------------|
| **标准** | ERC-6900 | ERC-7579 |
| **权限设计** | Plugin 开发者决定插件如何组合 | Plugin 用户决定插件如何组合 |
| **关系** | ERC-6900 ≈ ERC-7579 + 权限系统 | ERC-7579 把权限留在 scope 外 |
| **模块兼容性** | 只兼容 ERC-6900 模块 | 跨平台兼容所有 ERC-7579 模块 |
| **Gas 效率** | 账户创建 97,764 gas | 账户创建 180,465 gas |
| **Session Key** | 组合多个 hook 模块实现 | 独立 Session Key 模块 |
| **生态** | Alchemy 生态内 | 跨平台（Safe, Biconomy 等都支持 7579） |

**根本分歧:** ERC-6900 是更严格的标准，模块之间的绑定关系在安装时就确定；ERC-7579 更灵活，但需要用户自己负责安全组合。

### 生产就绪度

**高度生产就绪。** 两次独立安全审计（ChainLight + Quantstamp, 2024-12），40%+ gas 优化，所有 EVM 链统一地址部署。Cantina bug bounty 计划。Alchemy 背书。ERC-6900 标准（与 Circle, Trust Wallet 共同开发）。

---

## 对比总结

| 维度 | Openfort | Lit Protocol | Alchemy MAv2 |
|------|----------|-------------|--------------|
| **账户类型** | ERC-4337 Smart Account | MPC/DKG (PKP) + 可选 7579 集成 | ERC-6900 Modular Account |
| **Session Key** | 链上，BaseOpenfortAccount 内置 | 链下（Lit Actions + Policies） | 链上，通过模块组合 |
| **密钥管理** | TEE (AMD SEV-SNP) | 分布式 MPC（Lit Network 节点） | 用户自持 (EOA/Passkey) |
| **Agent 模式** | TEE EOA + EIP-7702 delegation | PKP + Lit Actions + Policy 验证 | Session key signer + hook 限制 |
| **标准兼容** | ERC-4337 v0.6/v0.7/v0.8 | 非标准（可通过 7579 模块集成） | ERC-4337 + ERC-6900 |
| **部署链** | 25+ EVM 链 | Lit Chain（自有链）+ 任意链签名 | 所有 EVM 链 |
| **Gas 效率** | 创建 ~250k, 转账 ~170k | N/A（签名在链下完成） | 创建 ~98k |
| **开源** | GPL-3.0 | Apache-2.0 | GPL-3.0 |
| **审计** | Slither + Mythril | — | ChainLight + Quantstamp |
| **生产就绪** | 是 | 条件性（Naga sunset 中） | 是（最成熟） |

### 对我们项目的启示

1. **Openfort** 的 session key 设计（struct + 白名单 + limit）是最简单直接的链上实现，和我们 Biconomy V2 的 Session Key Manager 类似但更轻量
2. **Alchemy MAv2** 的模块化 hook 组合方式最灵活，但需要 ERC-6900 生态支持
3. **Lit Protocol** 的 PKP 方案本质上不同 — 它是分布式密钥管理，不是 Smart Account，需要额外集成层才能和 ERC-4337 工作
4. Openfort 的 TEE + EIP-7702 方案是 Agent 钱包的一个有趣方向 — 不需要部署新合约，EOA 通过 delegation 临时获得 Smart Account 能力
