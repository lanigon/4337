# Morph ERC-4337 Agent Wallet 方案

> 2026-03-17

## 现状

- Biconomy bundler 已永久下线，v0.6 合约在 Morph 上但无链下服务
- EntryPoint v0.6.0 + v0.7.0 都在 Morph 上
- CoinbaseSmartWallet + Factory 也在 Morph 上（CREATE2 自动部署）
- Biconomy SmartAccountV2 全套合约在 Morph 上
- 无任何 Bundler 服务支持 Morph

---

## 方案对比

| 方案 | 成本 | 时间 | 自主可控 | 稳定性 |
|------|------|------|:--------:|:------:|
| **A. 自建 Bundler** | 服务器费用 | 2-3 周 | 完全 | 高 |
| **B. Pimlico 托管** | 免费/付费 tier | 1 周 | 中 | 高 |
| **C. 付费 Biconomy MEE** | $2500/月 | 1 周 | 低 | 中（已有宕机前科） |
| **D. Coinbase CDP** | 免费 | 1 周 | 中 | 高（但不确定支持 Morph） |

---

## 推荐：方案 A + B 组合

自建 Bundler 保底 + 尝试接入 Pimlico 作为备选。

---

## 方案 A：自建 Bundler

### 架构

```
                    你的服务器
                    ┌──────────────────────┐
                    │  Bundler 服务         │
                    │  (eth-infinitism)     │
                    │                      │
                    │  ├── 收 UserOp        │
                    │  ├── 模拟验证         │
                    │  ├── 打包            │
                    │  └── 提交到 EntryPoint│
                    └──────────┬───────────┘
                               │ handleOps()
                               ▼
                    EntryPoint v0.6.0
                    0x5FF137D4...2789
                               │
                    ┌──────────┴──────────┐
                    │                     │
              Biconomy SA            Coinbase SA
              (已有用户)            (可选替代)
```

### 技术选型

**Bundler 实现：**

| 实现 | 语言 | 开源 | 推荐 |
|------|------|:----:|:----:|
| eth-infinitism/bundler | TypeScript | ✅ | ⭐ 官方参考实现 |
| Stackup bundler | Go | ✅ | 性能好 |
| Pimlico Alto | TypeScript | ✅ | 功能全 |
| Candide Voltaire | Python | ✅ | Python 生态 |

推荐用 **eth-infinitism/bundler** 或 **Pimlico Alto**（TypeScript，跟我们前端技术栈一致）。

### 部署步骤

```bash
# 1. 克隆 bundler
git clone https://github.com/eth-infinitism/bundler.git
cd bundler
yarn install

# 2. 配置
# .env
MORPH_RPC=https://rpc-quicknode.morph.network
ENTRYPOINT=0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789
BENEFICIARY=0x你的收款地址      # 收 gas 手续费
PRIVATE_KEY=0xBundler的私钥     # Bundler 用来提交交易的 EOA
PORT=3300

# 3. 给 Bundler EOA 充 ETH（需要少量 ETH 垫付 gas）

# 4. 启动
yarn run bundler --network morph
```

### 服务器要求

```
最低配置:
  CPU: 2 核
  RAM: 4GB
  磁盘: 20GB
  网络: 稳定连接 Morph RPC

推荐:
  AWS t3.medium / 阿里云 ecs.c6.large
  月费: ~$30-50
```

### Bundler 需要做的事

```
1. 暴露 JSON-RPC 端点:
   - eth_sendUserOperation(userOp, entryPoint)
   - eth_estimateUserOperationGas(userOp, entryPoint)
   - eth_getUserOperationReceipt(hash)
   - eth_getUserOperationByHash(hash)
   - eth_supportedEntryPoints()

2. 内部逻辑:
   - 验证 UserOp（签名、nonce、gas、余额）
   - 模拟执行（eth_call simulateValidation）
   - 打包多个 UserOp 成一笔交易
   - 调用 EntryPoint.handleOps()
   - 监控交易确认
   - 处理 revert 和重发

3. 安全:
   - 限制每个 sender 的频率
   - 防止 DoS 攻击
   - Bundler EOA 余额监控
```

### Smart Account 选择

**选项 1：继续用 Biconomy SmartAccountV2**
```
优点: 合约已部署，已有用户的 SA 地址不变
缺点: SDK deprecated，Session Key 有兼容问题
前端: 继续用 @biconomy/account，只改 bundlerUrl 指向自建
```

**选项 2：用 CoinbaseSmartWallet**
```
优点: 合约已在 Morph 上，开源，Coinbase 维护
缺点: 不支持 Session Key（用 Passkey 代替），需要重新创建 SA
前端: 用 viem + permissionless.js
```

**选项 3：部署 SimpleAccount**
```
优点: 最简单，标准参考实现，所有 Bundler 天然兼容
缺点: 功能少（没有 module 系统、没有 Session Key）
前端: 用 viem + permissionless.js
```

**推荐选项 1**（改动最小）：保持 Biconomy SmartAccountV2，只换 Bundler URL。已有用户的钱包地址不变，SDK 虽然 deprecated 但功能完整。

---

## 方案 B：接入 Pimlico

### 检查 Pimlico 是否支持 Morph

```bash
# 查 Pimlico 支持的链
curl https://api.pimlico.io/v2/2818/rpc?apikey=test
```

### 如果支持

```
1. 注册 https://dashboard.pimlico.io（免费 tier 可用）
2. 拿到 API key
3. Bundler URL: https://api.pimlico.io/v2/2818/rpc?apikey=<key>
4. 前端改一行: BUNDLER_URL = 上面的 URL
5. 完成
```

### Pimlico 的优势

- 兼容所有 Smart Account（Biconomy、Coinbase、Safe、Kernel）
- 提供 Paymaster 服务（Verifying Paymaster）
- 免费 tier 包含测试用量
- TypeScript SDK `permissionless.js`

---

## 方案 A+B 组合实施计划

### 第一阶段：验证（1-2 天）

```
1. 检查 Pimlico 是否支持 Morph
   → 支持: 直接用 Pimlico（最快）
   → 不支持: 走自建 Bundler

2. 如果用 Pimlico:
   - 注册拿 key
   - 前端改 BUNDLER_URL
   - 测试 Smart Account 创建 + 交易
   - 测试 Session Key（可能仍有问题，因为是 Biconomy 合约）

3. 如果自建:
   - 本地跑 eth-infinitism bundler
   - 指向 Morph RPC
   - 测试基础 UserOp 提交
```

### 第二阶段：Session Key 修复（2-3 天）

```
之前排查发现的问题:
  - Session 创建成功（merkle root 写入链上）
  - Agent 执行失败（AA23）
  - 根因: policy 的 functionSelector 跟内部 data 不匹配

修复方案:
  1. policy.contractAddress = 实际要调用的外部合约
  2. policy.functionSelector = 那个合约上的真实函数
  3. sendTransaction 时 data 必须包含匹配的 function call
  4. 不能用空 data (0x) 做纯 ETH 转账测试

测试用例:
  - 创建 session: target = EntryPoint, fn = depositTo(address)
  - Agent 执行: to = EntryPoint, data = depositTo(SA)
```

### 第三阶段：前端更新（1-2 天）

```
1. 更新 BUNDLER_URL（指向 Pimlico 或自建）
2. 修复 Session Key 创建逻辑（正确的 contractAddress + functionSelector）
3. 修复 Agent 执行逻辑（传 sessionStorageClient 而不是地址）
4. 添加 Session Key 功能测试
5. 部署到 Vercel
```

### 第四阶段：可选增强

```
- 自建 Paymaster（gasless 交易）
- 添加更多 Session Key 模板（DeFi、NFT 等）
- Agent CLI 集成（skills/4337/ 接入 Bundler）
- 多 Agent 并行（Nonce Channel）
```

---

## 前端代码改动清单

### 1. 更新 Bundler URL

```typescript
// web/src/lib/contracts.ts

// 方案 A: 自建
export const BUNDLER_URL = "https://your-bundler.example.com/rpc";

// 方案 B: Pimlico
export const BUNDLER_URL = `https://api.pimlico.io/v2/${MORPH_CHAIN_ID}/rpc?apikey=YOUR_KEY`;
```

### 2. 修复 Session Key 创建

```typescript
// web/src/components/AgentWalletSession.tsx

// 修改 handleCreateSession:
const policy: Policy[] = [{
  sessionKeyAddress,
  contractAddress: TARGET_CONTRACT,        // 外部合约地址（不是 SA 自己）
  functionSelector: "depositTo(address)",  // 那个合约上的真实函数
  rules: [],
  interval: { validUntil, validAfter: 0 },
  valueLimit: 0n,
}];
```

### 3. 修复 Agent 执行

```typescript
// 修改 handleAgentExecute:

// getSingleSessionTxParams 传 storageClient 不是 sessionKeyAddress
const params = await getSingleSessionTxParams(
  sessionStorageRef.current,  // ← 修复
  morph,
  0
);

// sendTransaction 的 data 要有真实的 function call
const data = encodeFunctionData({
  abi: parseAbi(["function depositTo(address account)"]),
  functionName: "depositTo",
  args: [saAddress],
});

await sessionSmartAccount.sendTransaction(
  { to: ENTRYPOINT, data, value: 0n },
  params
);
```

---

## 成本估算

| 项目 | 方案 A (自建) | 方案 B (Pimlico) |
|------|:---:|:---:|
| 服务器 | ~$30-50/月 | $0 (免费 tier) |
| Bundler EOA gas | ~$5/月 (Morph gas 便宜) | $0 |
| 域名/SSL | ~$10/年 | $0 |
| 开发时间 | 2-3 周 | 1 周 |
| **总计** | ~$50/月 + 开发 | $0 起步 |

vs Biconomy MEE: $2500/月

---

## 风险

| 风险 | 影响 | 缓解 |
|------|------|------|
| Pimlico 不支持 Morph | 只能自建 | 先查再决定 |
| 自建 Bundler 运维 | 需要监控 | 用 PM2 + 告警 |
| Session Key 兼容性 | 可能仍然 AA23 | 用正确的 policy 参数 |
| Biconomy SDK deprecated | 未来可能有 bug | 长期迁移到 permissionless.js |
