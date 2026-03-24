# AI Agent Payment Infrastructure - On-Chain Projects (2026年3月)

实际部署了智能合约的 AI Agent 支付基础设施项目调研。

---

## 1. Alchemy Account Kit (Modular Account + LightAccount)

**状态**: 生产环境，大规模部署

**链**: 所有主要 EVM 链（同一地址跨链部署）

**ERC-4337**: v0.6 (LightAccount v1) + v0.7 (LightAccount v2, Modular Account v2)

**Session Keys**: 有，SessionKeyPlugin (v1) + Modular Account V2 内置模块

**开源**: 是

**GitHub**:
- https://github.com/alchemyplatform/light-account
- https://github.com/alchemyplatform/modular-account

### 关键合约地址（跨链统一）

**Modular Account V2 (v2.0.0)**:
| 合约 | 地址 |
|------|------|
| ModularAccount | `0x00000000000002377B26b1EdA7b0BC371C60DD4f` |
| AccountFactory | `0x00000000000017c61b5bEe81050EC8eFc9c6fecd` |
| SemiModularAccount7702 | `0x69007702764179f14F51cdce752f4f775d74E139` |
| SingleSignerValidationModule | `0x00000000000099DE0BF6fA90dEB851E2A2df7d83` |
| AllowlistModule | `0x00000000003e826473a313e600b5b9b791f5a59a` |
| NativeTokenLimitModule | `0x00000000000001e541f0D090868FBe24b59Fbe06` |
| TimeRangeModule | `0x00000000000082B8e2012be914dFA4f62A0573eA` |
| PaymasterGuardModule | `0x0000000000001aA7A7F7E29abe0be06c72FD42A1` |

**Modular Account V1 (v1.0.0)**:
| 合约 | 地址 |
|------|------|
| SessionKeyPlugin | `0x0000003E0000a96de4058e1E02a62FaaeCf23d8d` |
| MultiOwnerPlugin | `0xcE0000007B008F50d762D155002600004cD6c647` |
| MultiOwnerModularAccountFactory | `0x000000e92D78D90000007F0082006FDA09BD5f11` |

**LightAccount V2 (v2.0.0, EntryPoint v0.7)**:
| 合约 | 地址 |
|------|------|
| Implementation | `0x8E8e658E22B12ada97B402fF0b044D6A325013C7` |
| Factory | `0x0000000000400CdFef5E2714E63d8040b700BC24` |

**LightAccount V1 (v1.1.0, EntryPoint v0.6)**:
| 合约 | 地址 |
|------|------|
| Implementation | `0xae8c656ad28F2B59a196AB61815C16A0AE1c3cba` |
| Factory | `0x00004EC70002a32400f8ae005A26081065620D20` |

### Agent 如何交易
- Session Key Plugin 允许创建带权限范围的临时密钥（目标合约、函数白名单、spending limit、时间限制）
- Modular Account V2 通过 AllowlistModule + NativeTokenLimitModule + TimeRangeModule 组合实现更细粒度的权限控制
- 支持 EIP-7702 (SemiModularAccount7702) 让 EOA 获得智能账户能力

---

## 2. Safe + Rhinestone (ERC-7579 模块化)

**状态**: 生产环境

**链**: 多链（Ethereum, Base, Optimism, Arbitrum, Polygon 等）

**ERC-4337**: v0.7 (通过 Safe 7579 Adapter)

**Session Keys**: 有，Smart Sessions 框架

**开源**: 是

**GitHub**:
- https://github.com/rhinestonewtf/safe7579
- https://github.com/rhinestonewtf/registry
- https://github.com/rhinestonewtf/modulekit
- https://github.com/rhinestonewtf/module-sdk

### 关键合约地址

| 合约 | 地址 |
|------|------|
| Safe 7579 Module | `0x7579EE8307284F293B1927136486880611F20002` |
| ERC-7579 Launchpad | `0x7579011aB74c46090561ea277Ba79D510c6C00ff` |
| Rhinestone Module Registry | `0x000000000069E2a187AEFFb852bF3cCdC95151B2` |

### Smart Sessions 工作原理
- 用户通过 master key（passkey/ECDSA/multisig）生成 session key
- Session key 绑定权限策略（目标合约、函数、spending cap、时间）
- 与所有 ERC-7579 智能账户兼容（Safe, Kernel, Nexus 等）
- Module Registry 提供链上模块审计/attestation

---

## 3. ZeroDev Kernel (ERC-7579)

**状态**: 生产环境

**链**: 多链部署

**ERC-4337**: v0.6 (Kernel v2) + v0.7 (Kernel v3)

**Session Keys**: 有，内置 permissions system

**开源**: 是

**GitHub**: https://github.com/zerodevapp/kernel

### 关键合约地址

| 合约 | 地址 |
|------|------|
| Kernel Factory | `0x2577507b78c2008Ff367261CB6285d44ba5eF2E9` |
| Meta Factory | `0xd703aaE79538628d27099B8c4f621bE4CCd142d5` |

### 特点
- Kernel v3 (EntryPoint 0.7) 将 session keys 升级为更强大的 "permissions system"
- 权限可组合：合约白名单 + spending limit + 时间过期
- 支持 passkey validator
- Gas 高度优化

---

## 4. Biconomy (Nexus + Legacy V2)

**状态**: 生产环境，4.6M+ 账户，$1.1B+ 交易量

**链**: 多链（100+ EVM 链）

**ERC-4337**: v0.6 (Legacy V2) + v0.7 (Nexus)

**Session Keys**: 有（Legacy V2 通过 SessionKeyManager，Nexus 通过 ERC-7579 模块）

**开源**: 是

**GitHub**:
- https://github.com/bcnmy/nexus (Nexus ERC-7579)
- Legacy V2 合约已部署但代码在 Biconomy SDK 中

### 关键合约地址

**Nexus (ERC-7579)**:
| 合约 | 地址 |
|------|------|
| NexusAccountFactory | `0x000000226cada0d8b36034f5d5c06855f59f6f3a` (OP Mainnet 确认) |
| AccountFactory (newer) | `0x00000000000017c61b5bEe81050EC8eFc9c6fecd` |

**Legacy V2 (我们项目使用的，EntryPoint v0.6)**:
| 合约 | 地址 |
|------|------|
| SmartAccount Factory V2 | `0x000000a56Aaca3e9a4C479ea6b6CD0DbcB6634F5` |
| ECDSA Ownership Module | `0x0000001c5b32F37F5beA87BDD5374eB2Ac54eA8e` |
| Session Key Manager V1 | `0x000002FbFfedd9B33F4E7156F2DE8D48945E7489` |
| Batched Session Router | `0x00000D09967410f8C76752A104c9848b57ebba55` |
| ABI Session Validation | `0x000006bC2eCdAe38113929293d241Cf252D91861` |

---

## 5. Coinbase Smart Wallet

**状态**: 生产环境

**链**: 248 链（通过 Safe Singleton Factory 统一地址部署）

**ERC-4337**: v0.6

**Session Keys**: 无原生支持（通过多 owner 机制实现类似功能）

**开源**: 是

**GitHub**: https://github.com/coinbase/smart-wallet

### 关键合约地址

| 合约 | 地址 |
|------|------|
| CoinbaseSmartWalletFactory | `0xBA5ED110eFDBa3D005bfC882d75358ACBbB85842` |
| Implementation | `0x00000110dCdEdC9581cb5eCB8467282f2926534d` |

### 特点
- 支持 passkey (Secp256r1) 和 EOA owner
- 支持 2^256 个并发 owner
- 跨链 replay：签一次，所有链生效
- 与 x402 协议配合实现 agent 支付

---

## 6. Coinbase x402 协议

**状态**: 生产环境，$600M+ agent 支付

**链**: Base (主要), Ethereum, 多链扩展中

**ERC-4337**: 不直接使用（HTTP 层协议，底层用 ERC-20 transfer）

**Session Keys**: 不适用

**开源**: 是

**GitHub**: https://github.com/coinbase/x402

### 工作原理
- 复活 HTTP 402 Payment Required 状态码
- AI agent 在 HTTP 请求中嵌入支付数据
- 链上通过标准 ERC-20 transfer (主要是 USDC) 完成结算
- 无需订阅、账户或中间人
- x402 Foundation 成员：Coinbase, Cloudflare, Google, Visa
- V2 (2025.12) 增加了可复用 sessions 和多链支持

---

## 7. Circle USDC Paymaster

**状态**: 生产环境

**链**: Arbitrum, Base（及测试网）

**ERC-4337**: v0.7 + v0.8

**Session Keys**: 不适用（Paymaster 角色）

**开源**: 不完全

**文档**: https://developers.circle.com/paymaster

### 关键合约地址

| 链 | Paymaster 地址 |
|----|---------------|
| Arbitrum Mainnet | `0x6C973eBe80dCD8660841D4356bf15c32460271C9` |
| Arbitrum Testnet | `0x31BE08D380A21fc740883c0BC434FcFc88740b58` |
| Base Mainnet | `0x6C973eBe80dCD8660841D4356bf15c32460271C9` |
| Base Testnet | `0x31BE08D380A21fc740883c0BC434FcFc88740b58` |

### 特点
- 用户/Agent 可以用 USDC 支付 gas 费
- 10% surcharge (Arbitrum/Base)
- 仅支持 USDC token

---

## 8. Openfort

**状态**: 生产环境

**链**: 多链 EVM

**ERC-4337**: 是 + EIP-7702

**Session Keys**: 有，链上策略强制执行

**开源**: 是

**GitHub**:
- https://github.com/openfort-xyz/openfort-contracts
- https://github.com/openfort-xyz/openfort-deployer

### 关键合约地址

| 合约 | 地址 |
|------|------|
| Implementation | `0x6e4a235c5f72a1054abFeb24c7eE6b48AcDe90ab` |
| EntryPoint v0.8 | `0x4337084D9E255Ff0702461CF8895CE9E3b5Ff108` |

### 特点
- TEE Backend Wallets：服务端 agent 钱包，策略控制签名
- Session Keys：时间限制、spending cap、合约白名单
- EIP-7702 支持：EOA 获得智能账户能力
- Foundry 构建 (`forge build`)

---

## 9. Thirdweb

**状态**: 生产环境

**链**: 所有 EVM 链

**ERC-4337**: v0.7 (主要), 也支持 v0.6

**Session Keys**: 有，Granular Session Keys API (2025.11)

**开源**: 是

**GitHub**: https://github.com/thirdweb-dev/contracts

### 特点
- 三种账户：Simple Account, Dynamic Account, Managed Account
- Session Keys 支持：目标合约限制、native token spending limit、激活/过期时间
- AI Agent 用例：限额交易、自动化 DeFi、游戏后台操作
- 定位为 "Infrastructure for AI Agents"
- 包含 Nebula（AI agent 创建框架）

---

## 10. Privy (已被 Stripe 收购)

**状态**: 生产环境，百万级钱包

**链**: EVM, Solana, Bitcoin 等

**ERC-4337**: 通过集成的智能账户支持

**Session Keys**: 不直接提供（依赖底层智能账户）

**开源**: 否（闭源基础设施）

**特点**:
- Shamir Secret Sharing + TEE 架构
- 私钥分片，端到端加密
- Server Wallets API：后端创建和管理钱包
- sub-20ms 延迟，99.99% uptime
- 2025年6月被 Stripe 收购，与 Bridge (Stripe 的 $1.1B 稳定币收购) 整合
- Virtuals Protocol 用 Privy 给每个 AI agent 配非托管钱包
- **注意**: 无公开合约地址（闭源托管服务）

---

## 11. Crossmint

**状态**: 生产环境，40,000+ 用户

**链**: 40+ 区块链

**ERC-4337**: 是 + ERC-7702

**Session Keys**: 有（通过可编程钱包控制）

**开源**: 部分（底层基于开源智能合约）

**文档**: https://docs.crossmint.com/solutions/ai-agents/introduction

### 特点
- Programmable Wallets：非托管，无需牌照
- Agent 可安全持有和交易资金
- 链无关 SDK，统一 API 管理合约、密钥管理、paymaster
- 与 Tempo 区块链合作（稳定币支付）
- 被 Adidas、Red Bull 等使用
- 2025年融资 $23.6M
- **注意**: 无公开合约地址（API 服务，底层合约未公开）

---

## 12. MoonPay Agents

**状态**: 生产环境

**链**: Solana, Ethereum, Base, Polygon, Arbitrum, Optimism, BNB, Avalanche, TRON, Bitcoin

**ERC-4337**: 不明确（非托管软件层，可能不直接使用）

**Session Keys**: 不适用

**开源**: 部分（CLI 工具）

### 特点
- 非托管软件层，OS keychain 加密
- 54 个 crypto 工具，17 个技能领域
- 全金融生命周期：法币→加密→钱包管理→交易→法币出金
- 2026.3 集成 Ledger 硬件签名：每笔 AI 发起的交易都需硬件确认
- MoonPay CLI / MCP Server / Web Chat 多入口
- **注意**: 更多是 API/CLI 层，非链上合约基础设施

---

## 13. ERC-8004 (Trustless Agents) — 链上 Agent 身份

**状态**: 生产环境（2026.1.29 上线以太坊主网）

**链**: Ethereum Mainnet, Base

**ERC-4337**: 不直接关联（身份/声誉层，可与任何钱包配合）

**开源**: 是

**GitHub**: https://github.com/erc-8004/erc-8004-contracts

### 关键合约地址

**Ethereum Mainnet**:
| 合约 | 地址 |
|------|------|
| IdentityRegistry | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` |
| ReputationRegistry | `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` |

**Base**:
| 合约 | 地址 |
|------|------|
| IdentityRegistry | `0x8004A818BFB912233c491871b3d84c89A494BD9e` |
| ReputationRegistry | `0x8004B663056A597Dffe9eCcC1965A193B7388713` |

### 工作原理
- 三个链上注册表：Identity、Reputation、Validation
- Agent 在 IdentityRegistry 注册身份
- 交易完成后 ReputationRegistry 累积声誉
- 与 ERC-8183 (Virtuals/EF dAI) 配合：Job 完成 → 链上记录 → 声誉更新

---

## 14. ERC-8183 (AI Agent 条件托管)

**状态**: 首个实现刚上线（BNB Chain BNBAgent SDK, 2026.3.18）

**链**: BNB Chain（首个），计划扩展

**ERC-4337**: 不直接关联

**开源**: 是

### 工作原理
- 由 Virtuals Protocol + Ethereum Foundation dAI 团队提出
- 通用条件托管机制：AI Agent 之间的交易
- 可编程 escrow：自动释放/退款
- 每笔 Job 产生永久链上记录：deliverable hash + evaluator attestation + settlement outcome
- 数据喂入 ERC-8004 ReputationRegistry

---

## 15. Lit Protocol (PKP Agent Wallet)

**状态**: 生产环境 (Datil Mainnet)

**链**: 多链（PKP 可在任何 EVM 链签名）

**ERC-4337**: 可集成（通过 EIP-7579 模块）

**Session Keys**: 有（通过 Lit Actions 实现权限委托）

**开源**: 是

**GitHub**:
- https://github.com/LIT-Protocol/agent-wallet
- https://github.com/LIT-Protocol/lit-eip-7579-module

### 特点
- PKP (Programmable Key Pairs)：分布式密钥生成 (DKG)，2/3 节点门限签名
- PKP 是 ERC-721 NFT
- AI Agent 意图通过 IPFS 上的不可变 JS 代码执行
- Admin 定义和强制执行严格策略
- 支持 ERC20 转账、Uniswap swap、ECDSA 签名等工具

---

## 16. Virtuals Protocol (ERC-6551 Agent Wallets)

**状态**: 生产环境

**链**: Base (主要)

**ERC-4337**: 不使用（用 ERC-6551 Token Bound Accounts）

**Session Keys**: 不适用

**开源**: 部分

### 特点
- 每个 AI Agent 是 ERC-6551 NFT，自动拥有独立钱包地址
- Agent 可自主交易、管理资产
- GAME (Goal-Action-Mind-Engine) 框架驱动决策
- 与 x402 集成实现 agent 商业支付
- Base 链上 90.2% 日活钱包
- 用 Privy 实现安全钱包集成

---

## 对比总结

| 项目 | 链上合约 | Session Keys | Agent Identity | Escrow | ERC-4337 | 开源 |
|------|---------|-------------|---------------|--------|----------|------|
| Alchemy Account Kit | 有 | 有 | 无 | 无 | v0.6+v0.7 | 是 |
| Safe + Rhinestone | 有 | 有 (Smart Sessions) | 无 | 无 | v0.7 | 是 |
| ZeroDev Kernel | 有 | 有 | 无 | 无 | v0.6+v0.7 | 是 |
| Biconomy | 有 | 有 | 无 | 无 | v0.6+v0.7 | 是 |
| Coinbase Smart Wallet | 有 | 有限 | 无 | 无 | v0.6 | 是 |
| x402 (Coinbase) | 无(用ERC-20) | 有限 (V2 sessions) | 无 | 无 | 无 | 是 |
| Circle Paymaster | 有 | 无 | 无 | 无 | v0.7+v0.8 | 否 |
| Openfort | 有 | 有 | 无 | 无 | 是+7702 | 是 |
| Thirdweb | 有 | 有 | 无 | 无 | v0.7 | 是 |
| Privy | 无(托管) | 无 | 无 | 无 | 间接 | 否 |
| Crossmint | 有(未公开) | 有 | 无 | 无 | 是 | 部分 |
| MoonPay Agents | 无(API层) | 无 | 无 | 无 | 不明确 | 部分 |
| ERC-8004 | 有 | 无 | **有** | 无 | 无 | 是 |
| ERC-8183 | 有 | 无 | 间接 | **有** | 无 | 是 |
| Lit Protocol | 有 | 有(PKP) | 有(NFT) | 无 | 可集成 | 是 |
| Virtuals | 有 | 无 | 有(ERC-6551) | 无 | 无 | 部分 |

---

## 关键发现

### 真正有链上合约的 Agent 支付基础设施（按成熟度排序）

1. **Alchemy Account Kit** — 最完整的模块化方案，SessionKeyPlugin 有明确地址，跨链统一部署
2. **Biconomy** — 规模最大（4.6M账户），Legacy V2 的 Session Key Manager 在 Morph 上已部署（我们项目正在用）
3. **Safe + Rhinestone** — ERC-7579 标准制定者，Smart Sessions 是最通用的 session key 框架
4. **ZeroDev Kernel** — 最轻量高效的 ERC-7579 账户，permissions system 设计精良
5. **Coinbase Smart Wallet** — 248 链部署，passkey 原生支持，但 session key 支持有限
6. **Circle USDC Paymaster** — 唯一的稳定币 gas 支付方案，合约地址明确
7. **ERC-8004** — 唯一的链上 Agent 身份标准，已上线主网
8. **ERC-8183** — 唯一的链上 Agent 间条件托管标准，刚开始部署

### 纯 API/托管服务（无公开链上合约）

- Privy（被 Stripe 收购，闭源）
- MoonPay Agents（CLI/API 层）
- Crossmint（API 服务，底层合约未公开）

### 与我们项目 (Morph ERC-4337) 的关系

我们使用 Biconomy Legacy V2 + EntryPoint v0.6，与上述项目的关系：
- **直接相关**: Biconomy (我们的 SDK)、Circle Paymaster (可集成)、ERC-8004 (可为 Agent 添加身份)
- **可迁移到**: Biconomy Nexus (ERC-7579)、Alchemy Modular Account、ZeroDev Kernel
- **可参考**: Rhinestone Smart Sessions 架构、Alchemy SessionKeyPlugin 设计
