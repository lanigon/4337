# ERC-4337 Account Abstraction CLI

Morph 主网 ERC-4337 Smart Account + ERC-8004 Agent Identity CLI 工具。

## 用法

```bash
python3 skills/4337/aa_api.py <command> [options]
```

## 命令

### 基础设施

| 命令 | 用途 |
|------|------|
| `contracts` | 列出所有已部署合约及状态 |
| `supported-entrypoints` | 查询 Bundler 支持的 EntryPoint |
| `gas-price` | 当前 gas 价格 |

### Smart Account

| 命令 | 用途 |
|------|------|
| `create-wallet` | 生成新 EOA 密钥对 |
| `account-address --owner 0x...` | 计算 Smart Account 地址 |
| `balance --address 0x...` | 查询 ETH 余额 |
| `nonce --address 0x...` | 查询 EntryPoint nonce |
| `estimate-userop --sender 0x... --to 0x... --data 0x` | 估算 UserOp gas |

### ERC-8004 Agent Identity

| 命令 | 用途 |
|------|------|
| `agent-count --address 0x...` | 查询地址拥有的 Agent 数量 |
| `agent-info --agent-id 1` | 查询 Agent 信息 |
| `agent-reputation --agent-id 1` | 查询 Agent 声誉评分 |

## 示例

```bash
# 查看所有合约
python3 skills/4337/aa_api.py contracts

# 计算 Smart Account 地址
python3 skills/4337/aa_api.py account-address --owner 0xYourEOA

# 查询 Agent 信息
python3 skills/4337/aa_api.py agent-info --agent-id 1

# 查询声誉
python3 skills/4337/aa_api.py agent-reputation --agent-id 1
```

## 环境变量

| 变量 | 默认值 | 用途 |
|------|--------|------|
| `AA_RPC` | `https://rpc-quicknode.morph.network` | Morph RPC |
| `AA_BUNDLER_KEY` | 内置 key | Biconomy Bundler API key |

无外部依赖（Python 标准库 + urllib）。
