# EIP-7702 / Alt-Fee / ERC-4337 对比分析

> 2026-03-25 | 基于 Morph 官方文档 + 6 个 CLI 项目源码分析

---

## 目录

1. [三种 Gas 支付方案](#1-三种-gas-支付方案)
2. [EIP-7702 详解](#2-eip-7702-详解)
3. [Alt-Fee (0x7f) 详解](#3-alt-fee-0x7f-详解)
4. [ERC-4337 Paymaster 详解](#4-erc-4337-paymaster-详解)
5. [代付 Gas 场景分析](#5-代付-gas-场景分析)
6. [各 CLI 的 7702 集成](#6-各-cli-的-7702-集成)
7. [私钥存储方案对比](#7-私钥存储方案对比)
8. [Morph 上的完整 Gas 方案](#8-morph-上的完整-gas-方案)

---

## 1. 三种 Gas 支付方案

三种方案都在解决同一个问题：**让用户不需要持有 ETH 就能交易。**

```
                   EIP-7702 (0x04)          Alt-Fee (0x7f)           ERC-4337 Paymaster
原理              EOA 临时变合约            链原生 ERC-20 付 gas      Paymaster 合约代付
链上 gas 结算      ETH                      ERC-20（真正的）          ETH
用户实际付的       取决于合约逻辑            自己的 ERC-20             取决于 Paymaster
部署成本           0（不部署合约）           0（链原生）               需要部署 SA + Paymaster
基础设施依赖       需要可信的委托合约        需要 TokenRegistry        需要 Bundler + Paymaster
标准化程度         EVM 标准（所有链）        Morph 独有                EVM 标准（所有链）
```

### 一句话区分

- **Alt-Fee**："我用 USDC 替代 ETH 付自己的 gas"
- **EIP-7702**："我把 EOA 临时变成合约，让合约逻辑处理 gas"
- **4337 Paymaster**："Paymaster 帮我垫付 ETH，我用 USDC 还"

---

## 2. EIP-7702 详解

### 2.1 核心概念

EIP-7702 允许 EOA **临时指向一个合约的代码**，使 EOA 拥有智能合约的能力。

```
之前: EOA 地址上没有代码 → 只能发普通交易
之后: EOA 地址上有代码 → 可以执行合约逻辑（批量调用、权限控制、gas 代付）
交易结束: 代码保留或清除（取决于实现）
```

**关键：7702 本身不做任何 token 转换，不兑换，不代付。它只做一件事——"给 EOA 装上合约代码"。后面发生什么完全取决于那个合约写了什么逻辑。**

### 2.2 交易结构

```
tx type: 0x04 (SET_CODE_TX_TYPE)

RLP 编码:
  rlp([
    chainId, nonce, maxPriorityFeePerGas, maxFeePerGas, gasLimit,
    to, value, data, accessList,
    authorization_list: [          ← 7702 专有字段
      { chainId, address, nonce, yParity, r, s },  ← 每个授权一条
      ...
    ]
  ])

authorization_list 不能为空，至少一条授权。
```

### 2.3 执行流程

```
Step 1: EOA 签署 Authorization
  authorization = {
    chainId: 2818,                    // Morph 主网
    address: 0xDelegateContract,       // 要指向的合约
    nonce: EOA 当前 nonce
  }
  signature = EOA.sign(MAGIC(0x05) || rlp(authorization))

Step 2: 打包成 0x04 交易提交

Step 3: EVM 执行
  1. 验证 chainId（必须匹配或为 0）
  2. 验证 nonce 范围
  3. ecrecover 恢复签名者地址
  4. 确认签名者的 code 为空或已是委托状态
  5. 设置 EOA.code = 0xef0100 || delegateContract（委托标记）
  6. nonce +1
  7. 如果授权失败 → 跳过，继续下一条（不 revert）

Step 4: 执行 tx.data
  → 在 EOA 地址上执行 delegateContract 的代码
  → msg.sender / storage / balance 都是 EOA 自己的
```

### 2.4 三大用例（Morph 官方文档）

```
1. Batching（批量操作）
   approve + swap 合并成一笔交易，原子执行

2. Sponsorship（Gas 代付）
   应用方 / 赞助方覆盖用户的 gas 费用

3. Privilege De-escalation（权限降级）
   给子密钥授予有限能力（spending limit、rate limit、dApp 限制）
```

### 2.5 Gasless 交易的真实原理

```
错误理解: 7702 把 USDC 转成 ETH 付 gas
正确理解: 有人（Sponsor）用 ETH 垫付 gas，从用户 USDC 扣手续费补偿

流程:
  用户: 100 USDC + 0 ETH
    ↓ 签 7702 授权 → EOA 指向 Sponsor 合约
    ↓ Sponsor 合约逻辑:
    │   1. 从用户 USDC 扣 $0.01 手续费
    │   2. 用 Sponsor 自己的 ETH 付链上 gas
    │   3. 执行用户操作（转 USDC）
    ↓
  用户: 99.99 USDC，操作完成
  Sponsor: 收了 $0.01 USDC，花了等值 ETH

类比: 你把家钥匙交给中介，中介帮你做事
  好中介: 帮你付水电费（收人民币，替你转账）
  坏中介: 搬空你家（所以需要合约白名单检测）
```

### 2.6 安全风险

```
核心风险: 签了 7702 授权 = 把 EOA 全部控制权交给委托合约

如果合约是恶意的:
  → 转走所有 ETH
  → 转走所有 ERC-20
  → 授权所有 token 给攻击者
  → 创建新合约消耗 nonce

OKX 的 5 条安全检测规则:
  CRITICAL — 阻止:
    evm_7702_risk                          → 子交易无资产增加（偷钱）
    evm_7702_auth_address_not_in_whitelist → 委托给未验证合约
    evm_okx7702_loop_calls_are_not_allowed → 递归调用（重入攻击）
  MEDIUM — 警告:
    to_is_7702_address                     → 目标是 7702 升级过的地址
```

### 2.7 Morph 上的 7702

```
状态: ✅ 已支持
上线: 2025 年 10 月（Viridian 升级）
网络: 主网 + Hoodi 测试网
审计: SlowMist 白盒审计
文档: https://docs.morph.network/docs/about-morph/eip7702

Gas 参数:
  PER_AUTH_BASE_COST    = 12,500 gas（每条授权基础）
  PER_EMPTY_ACCOUNT_COST = 25,000 gas（空账户初始化）
```

---

## 3. Alt-Fee (0x7f) 详解

### 3.1 核心概念

Morph 独有的交易类型，**链级别原生支持用 ERC-20 付 gas**。

```
普通交易: ETH 付 gas → 矿工收 ETH
Alt-Fee:  USDC 付 gas → 排序器收 USDC（链原生，不经过任何中间合约）
```

### 3.2 交易结构

```
tx type: 0x7f

RLP 编码:
  rlp([
    chainId, nonce, gasTipCap, gasFeeCap, gas, to, value, data, accessList,
    feeTokenID,    ← uint16，指定用哪个 token 付 gas
    feeLimit,      ← big.Int，最多扣多少 token
    v, r, s
  ])

签名哈希:
  keccak256(0x7F || rlp([chainId, nonce, gasTipCap, gasFeeCap, gas, to, value, data,
                          accessList, feeTokenID, feeLimit]))
```

### 3.3 费用计算

```
1. 先算 ETH 费用（标准 EIP-1559）:
   effectiveGasPrice = min(gasTipCap, gasFeeCap - baseFee) + baseFee
   l2Fee = gas × effectiveGasPrice
   l1DataFee = calculateL1DataFee(data)
   totalFeeETH = l2Fee + l1DataFee

2. 换算成 token:
   tokenAmount = ⌈(totalFeeETH × tokenScale) / tokenRate⌉

3. 退款（用不完的退回）:
   remaining = remainingGas × effectiveGasPrice
   remainingToken = ⌈(remaining × tokenScale) / tokenRate⌉
```

### 3.4 TokenRegistry 合约

```
地址: 0x5300000000000000000000000000000000000021（Morph 系统预部署）

查询方法:
  getSupportedTokenList() → 返回所有支持的 token 列表
  getTokenInfo(tokenID)  → { tokenAddress, tokenScale, tokenRate, decimals, isActive }
  priceRatio(tokenID)    → 当前汇率（oracle 同步）

Token 需要满足:
  isActive == true
  tokenRate != 0
  tokenScale != 0
```

### 3.5 扣费机制

```
从 sender 的 token 余额直接扣:

senderBalance = stateDB.GetState(tokenAddress, senderSlot)
require(senderBalance >= amount)
stateDB.SetState(tokenAddress, senderSlot, senderBalance - amount)

两种扣费路径:
  1. balanceSlot != 0 → 直接修改 storage slot（快，省 gas）
  2. balanceSlot == 0 → 标准 ERC-20 transfer 调用
```

### 3.6 限制

```
1. 只能自付 — 没有 feePayer 字段，从 tx.from 扣
2. 和 EIP-7702 互斥 — 一笔交易只能是 0x04 或 0x7f
3. Morph 独有 — 其他链没有这个 tx type
4. L1DataFee 不可精确估算 — altfee-estimate 只算 L2 部分
```

---

## 4. ERC-4337 Paymaster 详解

### 4.1 核心概念

```
Paymaster 合约代替用户付 gas:

用户 → UserOp(paymasterAndData) → Bundler → EntryPoint
                                               ↓
                                     Paymaster.validatePaymasterUserOp()
                                               ↓
                                     验证通过 → Paymaster 的 deposit 扣 ETH 付 gas
                                               ↓
                                     Paymaster.postOp() → 从用户/赞助方扣 USDC 结算
```

### 4.2 和 Alt-Fee / 7702 的区别

```
链上 gas 结算:
  Alt-Fee:   ERC-20（链原生）
  7702:      ETH（Sponsor 垫付）
  Paymaster: ETH（Paymaster deposit 垫付）

用户需要什么:
  Alt-Fee:   自己有对应的 ERC-20 token
  7702:      只需签名（可以什么都没有）
  Paymaster: 只需签 UserOp（可以什么都没有）

基础设施:
  Alt-Fee:   无（链原生）
  7702:      委托合约
  Paymaster: Bundler + EntryPoint + Paymaster 合约 + Smart Account
```

### 4.3 Morph 上的 Paymaster

```
已部署合约:
  Verifying Paymaster V1.1: 0x00000f79b7faf42eebadba19acc07cd08af44789
  Token Paymaster:          0x00000f7365cA6C59A2C93719ad53d567ed49c14C

问题:
  Biconomy Bundler 已宕机 → 无法提交 UserOp → Paymaster 不可用
  需要自建 Bundler 或等第三方支持
```

---

## 5. 代付 Gas 场景分析

### 场景 1：我用 USDC 付自己的 gas

| 方案 | 可行 | 说明 |
|------|:----:|------|
| **Alt-Fee** | ✅ 最佳 | 链原生，一个 feeTokenID 搞定 |
| 7702 | ✅ 过重 | 需要委托合约，杀鸡用牛刀 |
| 4337 | ⚠️ | 需要 Bundler（Morph 上宕机） |

### 场景 2：别人用 ETH 帮我付 gas

| 方案 | 可行 | 说明 |
|------|:----:|------|
| Alt-Fee | ❌ | 只能自付，无 feePayer 字段 |
| **7702** | ✅ 最佳 | Sponsor 提交 0x04 交易，Sponsor 付 ETH |
| 4337 | ✅ | Paymaster deposit 付 ETH，但需要 Bundler |

### 场景 3：别人用 USDC 帮我付 gas（链上层面）

| 方案 | 可行 | 说明 |
|------|:----:|------|
| Alt-Fee | ❌ | 只能从 sender 扣，不能从别人扣 |
| 7702 | ❌ | 链上 gas 结算始终是 ETH |
| 4337 | ❌ | 链上 gas 结算始终是 ETH |

**链上层面只有 Alt-Fee 能真正用 USDC 结算 gas，但 Alt-Fee 不支持代付。所以"别人用 USDC 在链上层面帮我付 gas"目前不可能。**

### 场景 4：别人用 USDC 帮我付 gas（业务层面）

| 方案 | 可行 | 说明 |
|------|:----:|------|
| Alt-Fee | ❌ | 不支持代付 |
| **7702** | ✅ 变通 | Sponsor 用 ETH 付链上 gas → 合约从用户 USDC 扣手续费补偿 |
| **4337** | ✅ 标准 | Paymaster 用 ETH deposit 付 gas → postOp 从赞助方 USDC 扣除 |

### 场景 5：用户什么 token 都没有，第一笔交易

| 方案 | 可行 | 说明 |
|------|:----:|------|
| Alt-Fee | ❌ | 需要有 ERC-20 |
| **7702** | ✅ 最佳 | 只需签名，Sponsor 付一切 |
| 4337 | ✅ | Paymaster 全额代付，但需要 Bundler |

---

## 6. 各 CLI 的 7702 集成

### OKX — 最深度（代码级别原生支持）

```rust
// transfer.rs — 自动检测是否需要 7702
if !unsigned.auth_hash_for7702.is_empty() {
    let sig = crypto::ed25519_sign_hex(&unsigned.auth_hash_for7702, &signing_seed_b64)?;
    msg_for_sign_map.insert("authSignatureFor7702".into(), json!(sig));
}
```

**用户无感**：执行 `onchainos wallet transfer`，后端判断需不需要 7702，需要就自动多签一个授权。

```
有 ETH:  transfer → 普通交易 → ETH 付 gas
没 ETH:  transfer → 自动 7702 → Sponsor 合约代付 → 用户无感
```

安全检测 5 条规则 + `alloy-eip7702` Rust 库原生支持。

### Bitget — Gasless Swap 底层能力

```
零 ETH 余额 swap:
  用户: 100 USDC + 0 ETH
  → 7702 委托给 Bitget swap 合约
  → 合约: 从 100 USDC 扣 $0.01 gas 费 → 剩余 swap → ETH
  → 用户收到 ETH，整个过程不需要预先有 ETH

实现: order_make_sign_send.py 一步完成
  makeOrder → 签交易 + 签 7702 授权 → sendOrder → 60s 内完成
```

### Morph — 不用 7702（有 Alt-Fee 替代）

```
Alt-Fee (0x7f) 和 7702 (0x04) 互斥，不能合并

Morph 的策略:
  自付场景 → Alt-Fee（更简单，链原生）
  代付场景 → 7702 或 4337（需要额外开发）

目前 morph-skill 只实现了 Alt-Fee，没有 7702 命令
```

### Polygon / AgentKit / Agentic — 不用 7702

```
Polygon:  Sequence Relayer 代付 gas（自有基础设施）
AgentKit: 4337 Paymaster（CDP SDK 集成）
Agentic:  服务端完全托管（用户不碰 gas）
```

### 汇总

| 项目 | 7702 支持 | 使用方式 | 深度 |
|------|:---------:|----------|:----:|
| **OKX** | ✅ | 自动检测 + 签名 + 安全检测 | ⭐⭐⭐⭐⭐ |
| **Bitget** | ✅ | Gasless swap 底层 | ⭐⭐⭐ |
| **Morph** | 文档提及 | 和 Alt-Fee 互斥，未实现 | ⭐ |
| **Polygon** | ❌ | 用 Sequence Relayer | — |
| **AgentKit** | ❌ | 用 4337 Paymaster | — |
| **Agentic** | ❌ | 服务端托管 | — |

---

## 7. 私钥存储方案对比

### Polygon — AES-256-GCM 文件加密

```
存储位置: ~/.polygon-agent/
密钥文件: .encryption-key (32 字节随机, mode 0o600)
密文文件: builder.json → { iv, encrypted, authTag }

流程:
  生成: randomBytes(32) → .encryption-key
  加密: AES-256-GCM(key, iv=random(16), plaintext=privateKey) → { iv, encrypted, authTag }
  解密: 读 key + 读密文 → AES-256-GCM decrypt → 私钥

安全: 目录 0o700，文件 0o600，密钥和密文分开
弱点: 同用户的其他进程 / root 可以读到两个文件
```

### OKX — OS Keyring + HPKE + TEE（三层）

```
Layer 1 — TEE（服务端）:
  OKX 服务器在 TEE 中生成 Ed25519 签名种子
  原始私钥从未离开 TEE

Layer 2 — HPKE 加密（传输）:
  CLI 生成 X25519 密钥对
  服务器用 HPKE(X25519 + HKDF-SHA256 + AES-256-GCM, info="okx-tee-sign") 加密种子
  CLI 用 session_private_key 解密

Layer 3 — OS Keyring（本地）:
  敏感数据 → keyring::Entry("onchainos", "agentic-wallet")
    macOS:   Keychain Access（Touch ID / 密码）
    Windows: Credential Manager（2560 字节限制）
    Linux:   GNOME Keyring / KWallet
  非敏感数据 → ~/.onchainos/session.json（明文）

签名流程:
  Keyring 读 session_key → session.json 读 encryptedSessionSk
  → HPKE 解密 → Ed25519 seed → 签名 → 丢弃 seed
```

### Bitget — 用完即弃

```
存储: 只存 BIP-39 助记词（加密方式未公开），永不存私钥

签名流程:
  1. 读助记词
  2. BIP-44 推导: m/44'/60'/0'/0/0 → 私钥
  3. 写 mktemp 临时文件: /tmp/.pk_evm_xxxx
  4. 签名脚本读取 → 签名
  5. 立即删除临时文件
  6. 私钥从内存释放

为什么用临时文件:
  CLI 参数: ps aux 能看到 → ❌
  环境变量: /proc/<pid>/environ 能看到 → ❌
  临时文件: 只有 owner 能读 + 存活几秒 → ✅
```

### 对比

| | Polygon | OKX | Bitget |
|---|---|---|---|
| **存了什么** | AES 加密的私钥 | HPKE 加密的签名种子 | 助记词（不存私钥） |
| **保护手段** | 文件加密 | OS Keyring + HPKE + TEE | 用完即弃 |
| **攻击需要** | 拿到两个文件 | 突破 OS 认证 + HPKE | 拿到助记词 |
| **私钥暴露窗口** | 解密后在内存中 | 解密后在内存中 | 签名的几秒 |
| **离线可用** | ✅ | ❌ 首次需联网 | ✅ |
| **复杂度** | 低（~60 行） | 高 | 中 |

---

## 8. Morph 上的完整 Gas 方案

### 当前支持

```
✅ Alt-Fee (0x7f)  — 已上线，自付 USDC/USDT 替代 ETH
✅ EIP-7702 (0x04) — 已上线（2025.10 Viridian 升级），可代付
⚠️ 4337 Paymaster  — 合约已部署，Bundler 宕机中
```

### 选择建议

```
我自己有 USDC，想省 ETH gas:
  → Alt-Fee（最简单，一个字段搞定）

项目方想帮用户付 gas:
  → EIP-7702 + Sponsor 合约（现在就能做）
  → 4337 Paymaster（等 Bundler 恢复/自建）

用户什么都没有，首次交易:
  → EIP-7702（只需签名，Sponsor 全额代付）

批量操作（approve + swap 一笔完成）:
  → EIP-7702（batching 是核心用例之一）

最高安全要求（权限隔离）:
  → 4337 Smart Account + Session Key
```

### 三者关系

```
不是竞争关系，是互补关系:

Alt-Fee:   解决"我不想持有 ETH"           → 最简单
EIP-7702:  解决"我想让 EOA 有合约能力"     → 最灵活
4337:      解决"我要完整的账户抽象体系"     → 最完整

可以组合:
  7702 + Paymaster = EOA 有合约能力 + Paymaster 代付
  Alt-Fee 独立使用 = 最轻量的 gas 替代
  但 7702 + Alt-Fee 不能在同一笔交易中组合（tx type 互斥）
```
