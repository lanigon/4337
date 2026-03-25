# Morph Agent CLI 架构设计

> 2026-03-25 | 基于 Polygon / Base / OKX / Bitget / Morph Skill 对比分析

---

## 四层架构

```
Layer 4: Agent 层          ← AI Agent 经济
Layer 3: 应用层            ← DeFi / DEX / Bridge / Lending
Layer 2: Morph 基础设施层   ← Alt-Fee / 7702 / Explorer
Layer 1: 钱包层            ← 创建 / 余额 / 转账 / 私钥管理
```

---

## Layer 1: 钱包层

### 功能

| 命令 | 说明 | 参考 |
|------|------|------|
| `wallet create` | 生成 EOA + 加密存储 | Polygon setup |
| `wallet import --private-key-file` | 从文件导入（不用 CLI 参数） | Bitget 临时文件模式 |
| `wallet list` | 列出所有钱包 | Polygon wallet list |
| `wallet address --name main` | 查地址 | Polygon wallet address |
| `wallet remove --name main` | 删除钱包 | Polygon wallet remove |
| `wallet balance --name main` | 查余额（native + ERC-20） | 各家都有 |
| `wallet transfer --to --amount --broadcast` | 基础转账 | Polygon send |
| `wallet transfer-token --symbol USDC --to --amount --broadcast` | ERC-20 转账 | Polygon send-token |

### 私钥存储（参考 Polygon AES-256-GCM）

```
~/.morph-agent/
├── .encryption-key          ← 32 字节随机密钥（mode 0o600，首次生成）
├── wallets/
│   ├── main.json            ← { privateKey: {nonce, ciphertext}, address, name }
│   ├── trading.json         ←   privateKey 是 AES-256-GCM 加密的
│   └── ...
└── config.json              ← 默认钱包名、默认链等配置

加密: AES-256-GCM(key, nonce=random(12), plaintext=privateKey) → {nonce, ciphertext}
解密: 读 .encryption-key → 读 wallets/main.json → AES-GCM decrypt → 内存中私钥 → 签名 → 丢弃
文件权限: 目录 0o700，文件 0o600
```

### 安全规则

```
✅ 私钥从文件导入（--private-key-file），读完立即删除临时文件
✅ 不通过 CLI 参数传私钥（避免 ps aux / shell history 泄露）
✅ 支持环境变量 MORPH_PRIVATE_KEY 作为备选
✅ 所有写操作默认 dry-run，加 --broadcast 才真发
✅ 大额转账提示用户逐字核对地址
❌ 绝不将私钥写入日志、stdout、任何可能被 git 跟踪的文件
```

---

## Layer 2: Morph 基础设施层

### Morph 独有优势：三种 Gas 方案共存

```
其他链只有一两种，Morph 三种都有:

1. Alt-Fee (0x7f)  — 链原生 ERC-20 付 gas（Morph 独有）
2. EIP-7702 (0x04) — EOA 临时合约能力（2025.10 Viridian 升级）
3. 标准 ETH 付 gas  — 普通 EIP-1559 交易
```

### 功能

| 命令 | 说明 | 对应方案 |
|------|------|----------|
| **Alt-Fee** | | |
| `altfee tokens` | 查支持的 fee token 列表 | 0x7f |
| `altfee estimate --token-id 5` | 估算需要多少 token 付 gas | 0x7f |
| `altfee send --to --value --fee-token-id 5 --broadcast` | 用 ERC-20 付 gas 发交易 | 0x7f |
| **EIP-7702** | | |
| `7702 delegate --contract 0x... --broadcast` | 签署 7702 授权 | 0x04 |
| `7702 send --to --amount --sponsor 0x... --broadcast` | Sponsor 代付 gas | 0x04 |
| **Explorer** | | |
| `explorer address --address 0x...` | 地址信息 | Blockscout v2 |
| `explorer txs --address 0x...` | 交易历史 | Blockscout v2 |
| `explorer tx --hash 0x...` | 交易详情 | Blockscout v2 |
| `explorer tokens --address 0x...` | Token 持仓 | Blockscout v2 |
| `explorer contract --address 0x...` | 合约信息/ABI | Blockscout v2 |
| `explorer token-search --query USDC` | Token 搜索 | Blockscout v2 |
| **链基础** | | |
| `gas-price` | 当前 gas 价格 | RPC |
| `tx-receipt --hash 0x...` | 交易回执 | RPC |

### Alt-Fee 技术细节

```
TokenRegistry 合约: 0x5300000000000000000000000000000000000021

交易结构 (0x7f):
  rlp([chainId, nonce, gasTipCap, gasFeeCap, gas, to, value, data,
       accessList, feeTokenID, feeLimit, v, r, s])

费用计算:
  tokenAmount = ⌈(ethFee × tokenScale) / tokenRate⌉

特性:
  ✅ 链原生，不需要任何合约
  ✅ 自己用 USDC/USDT 付 gas
  ❌ 不能代付（从 sender 扣）
  ❌ 和 7702 互斥（同一笔交易只能选一个 tx type）
```

### EIP-7702 技术细节

```
交易类型: 0x04
上线: 2025.10 Viridian 升级
审计: SlowMist

三大用例:
  1. Batching — approve + swap 一笔搞定
  2. Sponsorship — 别人帮付 gas
  3. Privilege De-escalation — 子密钥有限权限

安全:
  签 7702 = 把 EOA 全部控制权交给委托合约
  必须验证合约白名单（参考 OKX 的 5 条安全规则）
```

---

## Layer 3: 应用层

### 功能

| 命令 | 说明 | 参考 |
|------|------|------|
| **DEX Swap（Bulbaswap）** | | |
| `swap quote --from USDC --to ETH --amount 100` | 获取报价 | Morph Skill dex-quote |
| `swap execute --from USDC --to ETH --amount 100 --broadcast` | 执行 swap | Morph Skill dex-send |
| `swap quote + altfee send` | Swap + Alt-Fee gas 组合 | Morph Skill 组合 |
| **Cross-Chain Bridge（Bulbaswap）** | | |
| `bridge chains` | 支持的链 | Morph Skill bridge-chains |
| `bridge tokens --chain base` | 链上支持的 token | Morph Skill bridge-tokens |
| `bridge quote --from-chain morph --to-chain base --token USDC --amount 100` | 跨链报价 | Morph Skill bridge-quote |
| `bridge swap --from-chain morph --to-chain base --token USDC --amount 100 --broadcast` | 一步跨链 | Morph Skill bridge-swap |
| `bridge status --order-id xxx` | 订单状态 | Morph Skill bridge-order |
| **Lending（待调研）** | | |
| `lend deposit --protocol xxx --asset USDC --amount 100 --broadcast` | 存入借贷协议 | Polygon deposit |
| `lend withdraw --protocol xxx --asset USDC --amount 100 --broadcast` | 取出 | — |
| `lend pools` | 查可用池 + APY | Polygon getEarnPools |

### Bridge 工作流

```
JWT 鉴权:
  bridge login → EIP-191 签名 → 换 JWT（24h 有效）

一步跨链:
  bridge swap
    → 内部: make-order → 签所有 tx → submit-order
    → 返回 orderId

支持 6 条链:
  Morph / Ethereum / Base / BNB / Arbitrum / Polygon

Token 常量（硬编码，100+ token）:
  BRIDGE_TOKENS = {
    "morph": { ETH, USDT.e, USDT0, USDC, USDC.e, BGB, ... },
    "eth": { ETH, USDT, USDC, WBTC, DAI, LINK, ... },
    "base": { ETH, USDC, WETH, cbBTC, AERO, ... },
    ...
  }
```

---

## Layer 4: Agent 层

### 功能

| 命令 | 说明 | 参考 |
|------|------|------|
| **ERC-8004 身份** | | |
| `agent register --name "MyBot" --broadcast` | 注册 Agent（铸 NFT） | Polygon agent register |
| `agent info --agent-id 1` | 查 Agent 信息 | aa_api.py 已有 |
| `agent reputation --agent-id 1` | 查声誉分 | aa_api.py 已有 |
| `agent feedback --agent-id 1 --value 5 --broadcast` | 提交评分 | Polygon agent feedback |
| `agent reviews --agent-id 1` | 查所有评价 | Polygon agent reviews |
| `agent count` | 已注册 Agent 总数 | aa_api.py 已有 |
| **x402 微支付** | | |
| `x402 pay --url https://api.example.com` | 付费调 API | Polygon x402-pay |
| `x402 discover --query "weather"` | 搜索 x402 服务 | Agentic x402 bazaar |
| **MCP Server** | | |
| `mcp` | 启动 MCP Server 模式（JSON-RPC over stdio） | OKX onchainos mcp |

### ERC-8004 合约（Morph 主网已部署）

```
IdentityRegistry:   0x672c...（非规范地址，CREATE 部署）
ReputationRegistry: 0x23AA...（非规范地址，CREATE 部署）

功能:
  register(agentUri, metadata[]) → 铸造 Agent NFT + 设置元数据
  getAgentWallet(agentId) → 查 Agent 钱包地址
  getMetadata(agentId, key) → 查元数据
  getSummary(agentId, clients, tag1, tag2) → 聚合声誉分
  giveFeedback(agentId, value, tag1, tag2) → 提交评分
```

---

## 和其他链的对比

### 按层对比

| 层 | Polygon | Base | OKX | Morph（目标） |
|---|---|---|---|---|
| **L4 Agent** | ERC-8004 + x402 + Polymarket | ERC-8004 + x402 + MCP + Bazaar | x402(TEE) + MCP | ERC-8004 + x402 + MCP |
| **L3 应用** | Trails(swap/bridge) + Aave/Morpho | 50+ 协议 | 500+ 源 swap（无 bridge/lending） | Bulbaswap(swap/bridge) + Lending |
| **L2 基础设施** | Sequence(Relayer/Session) | 4337(SA/Paymaster/Bundler) | 7702 自动检测 + 安全审计 | **Alt-Fee + 7702 + Explorer** |
| **L1 钱包** | Builder EOA + Sequence SA | 7 种钱包提供者 | TEE + OS Keyring | EOA + AES-256-GCM |

### Morph 的差异化

```
vs Polygon:
  Polygon 绑定 Sequence 生态（非标准）
  Morph 用标准 EVM 方案（Alt-Fee + 7702）+ 原生 Explorer

vs Base:
  Base 重度依赖 Coinbase 基础设施（CDP SDK）
  Morph 不依赖任何第三方

vs OKX:
  OKX 是交易情报终端（信号/鲸鱼/Meme 扫描）
  Morph 是链上操作全栈工具

Morph 独有:
  ✅ Alt-Fee (0x7f) — 唯一链原生 ERC-20 付 gas 的方案
  ✅ 三种 Gas 方案共存（Alt-Fee + 7702 + 标准 ETH）
  ✅ Blockscout Explorer API（免费，无需 API key）
  ✅ 不绑定任何第三方基础设施
```

---

## 实现优先级

### Phase 1 — 钱包基础（现在做）

```
✅ wallet create / import / list / address / remove
✅ wallet balance（native + ERC-20）
✅ wallet transfer / transfer-token
✅ 私钥 AES-256-GCM 加密存储
✅ --broadcast dry-run 机制
✅ 输入验证（地址、金额、注入防护）
✅ .claude-plugin/ + SKILL.md（Skill 化）
```

### Phase 2 — Morph 基础设施（1-2 周）

```
✅ altfee tokens / estimate / send
✅ explorer address / txs / tx / tokens / contract / token-search
✅ gas-price / tx-receipt
⏳ 7702 delegate / send（需要可信的委托合约）
```

### Phase 3 — 应用层（2-3 周）

```
⏳ swap quote / execute（接 Bulbaswap API）
⏳ bridge chains / tokens / quote / swap / status
⏳ lend deposit / withdraw / pools（调研 Morph 上的 lending 协议）
```

### Phase 4 — Agent 层（3-4 周）

```
⏳ agent register / info / reputation / feedback / reviews
⏳ x402 pay / discover
⏳ mcp server 模式
```

---

## 技术选型

| 决策 | 选择 | 理由 |
|------|------|------|
| **语言** | Python | 和现有 aa_api.py 一致；AI Agent 生态最好；单文件部署 |
| **私钥存储** | AES-256-GCM | 参考 Polygon，纯文件操作，不依赖 OS keyring |
| **CLI 框架** | argparse | 零依赖，现有代码已用 |
| **Token 常量** | 硬编码 dict | 参考 Morph Skill，简单直接 |
| **API** | Morph RPC + Blockscout v2 + Bulbaswap v2 | 全部免费公开端点 |
| **签名** | eth_account + eth_keys | 现有依赖，Alt-Fee 0x7f 签名已实现 |
| **发布** | .claude-plugin/ + SKILL.md | Skill 模式，不发 npm/pip 包 |
| **输出** | JSON | 所有命令 `{"success": true/false, "data": {...}}` |

---

## 文件结构（目标）

```
morph-agent-cli/
├── .claude-plugin/
│   └── plugin.json
├── scripts/
│   └── morph_agent.py          ← 主实现（单文件）
├── skills/
│   ├── wallet/SKILL.md
│   ├── altfee/SKILL.md
│   ├── explorer/SKILL.md
│   ├── swap/SKILL.md
│   ├── bridge/SKILL.md
│   └── agent/SKILL.md
├── SKILL.md                    ← 统一入口
├── README.md
└── CHANGELOG.md
```
