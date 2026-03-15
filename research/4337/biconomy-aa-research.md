# Biconomy Account Abstraction (ERC-4337) 在 Morph L2 上的调研报告

## 目录

1. [Biconomy 产品架构概览](#1-biconomy-产品架构概览)
2. [Morph 链上的部署情况](#2-morph-链上的部署情况)
3. [SDK 选型与安装](#3-sdk-选型与安装)
4. [Dashboard 和 API Key 配置](#4-dashboard-和-api-key-配置)
5. [核心功能代码示例](#5-核心功能代码示例)
6. [Next.js 前端集成完整方案](#6-nextjs-前端集成完整方案)
7. [Smart Sessions (Session Keys)](#7-smart-sessions-session-keys)
8. [注意事项与限制](#8-注意事项与限制)

---

## 1. Biconomy 产品架构概览

Biconomy 提供完整的 ERC-4337 Account Abstraction 基础设施栈，包含以下核心组件：

### 1.1 Nexus Smart Account

- **标准**: ERC-7579 兼容的模块化智能账户
- **特性**: 比竞品低约 25% 的 gas 成本
- **安全性**: 经 Spearbit 和 Cyfrin 审计
- **模块化**: 支持验证模块、执行模块、Session Keys 等扩展
- **跨链**: 统一地址，支持 20+ EVM 链

### 1.2 Bundler

- 追踪替代 mempool 中的 UserOperations，打包后发送给 EntryPoint 合约执行
- Biconomy 提供托管的 Bundler 服务
- URL 格式: `https://bundler.biconomy.io/api/v2/{chainId}/{apiKey}`
- 支持 v3 格式: `https://bundler.biconomy.io/api/v3/{chainId}/{apiKey}`

### 1.3 Paymaster

- 智能合约，充当 Gas Tank，代付交易费用
- 支持两种模式:
  - **Sponsored (代付模式)**: dApp 为用户代付 gas
  - **ERC-20 Token 支付**: 用户使用 ERC-20 代币支付 gas
- URL 格式: `https://paymaster.biconomy.io/api/v1/{chainId}/{apiKey}` 或 `v2`

### 1.4 产品演进路线

Biconomy 目前有三代产品体系：

| 产品 | 包名 | 状态 | 说明 |
|------|------|------|------|
| SDK V2/V3 (Legacy) | `@biconomy/account` | 维护模式 | SmartAccountV2，ERC-4337 v0.6.0 |
| Nexus SDK | `@biconomy/sdk` | 过渡版本 | Nexus 智能账户，ERC-7579 |
| **AbstractJS (最新)** | `@biconomy/abstractjs` | **活跃开发** | MEE 跨链编排，推荐新项目使用 |

> **重要**: 对于 Morph 链（EntryPoint v0.6.0），需要使用 Legacy SDK (`@biconomy/account`) 或者 AbstractJS 的兼容模式。

---

## 2. Morph 链上的部署情况

### 2.1 Morph 网络基本信息

| 参数 | 主网 | 测试网 (Hoodi) |
|------|------|-------------|
| Chain ID | **2818** | 2910 |
| RPC URL | `https://rpc-quicknode.morph.network` | `https://rpc-hoodi.morph.network` |
| 区块浏览器 | `https://explorer.morph.network` | `https://explorer-hoodi.morph.network` |
| 原生代币 | ETH | ETH |
| 官方桥 | `https://bridge.morph.network/` | `https://bridge-hoodi.morph.network/` |

### 2.2 Biconomy 在 Morph 上的支持情况

根据 Biconomy 官方文档 (docs.biconomy.io/contracts-and-audits/supported-chains)：

- **Morph 属于 Legacy ERC-4337 EntryPoint v0.6.0 支持链列表**
- Biconomy 在 Morph 生态系统应用列表中被列为基础设施合作伙伴

### 2.3 合约地址

| 合约 | 地址 |
|------|------|
| **EntryPoint v0.6.0** | `0x5ff137d4b0fdcd49dca30c7cf57e578a026d2789` |
| **Smart Account Implementation V2** | `0x0000002512019Dafb59528B82CB92D3c5D2423Ac` |
| **Smart Account Factory V2** | `0x000000a56Aaca3e9a4C479ea6b6CD0DbcB6634F5` |
| **ECDSA Ownership Module** | `0x0000001c5b32F37F5beA87BDD5374eB2Ac54eA8e` |
| **Multichain Validation Module** | `0x000000824dc138db84FD9109fc154bdad332Aa8E` |
| **Session Key Manager V1** | `0x000002FbFfedd9B33F4E7156F2DE8D48945E7489` |
| **Batched Session Router Module** | `0x00000D09967410f8C76752A104c9848b57ebba55` |
| **Verifying Paymaster V1** | `0x000031DD6D9D3A133E663660b959162870D755D4` |
| **Verifying Paymaster V1.1.0** | `0x00000f79b7faf42eebadba19acc07cd08af44789` |
| **Token Paymaster** | `0x00000f7365cA6C59A2C93719ad53d567ed49c14C` |

> **注意**: 上述 Biconomy 合约使用 CREATE2 确定性部署，理论上在所有 EVM 链上地址一致。但建议在 Morph 区块浏览器 (explorer.morph.network) 上验证这些合约是否已实际部署。

### 2.4 Bundler 和 Paymaster Endpoint

```
# Bundler URL (需要 API Key)
https://bundler.biconomy.io/api/v2/2818/{YOUR_API_KEY}

# Paymaster URL (需要 API Key)
https://paymaster.biconomy.io/api/v1/2818/{YOUR_API_KEY}
```

> **重要提醒**: Morph 属于 Legacy 支持链，Biconomy Dashboard 上是否已开放 Morph 主网的 Paymaster 创建，需要在 dashboard.biconomy.io 上实际验证。如果 Dashboard 不支持直接创建，可能需要联系 Biconomy 团队。

---

## 3. SDK 选型与安装

### 3.1 方案 A: Legacy SDK (推荐用于 Morph，v0.6.0 EntryPoint)

```bash
npm install @biconomy/account viem
```

`@biconomy/account` 包已内置 Bundler 和 Paymaster 模块，不需要单独安装。

### 3.2 方案 B: AbstractJS SDK (最新，跨链编排)

```bash
npm install @biconomy/abstractjs viem
```

AbstractJS 是最新的 SDK，主要面向 MEE (Modular Execution Environment) 跨链编排场景。如果 Morph 在 MEE 支持列表中（目前 MEE 支持 19 条主网链，Morph 暂不在其中），可以使用此方案。

### 3.3 推荐策略

对于当前 Morph 集成，建议使用 **方案 A (`@biconomy/account`)**，原因：
- Morph 在 Biconomy 的 EntryPoint v0.6.0 Legacy 支持列表中
- `@biconomy/account` 直接支持 SmartAccountV2 + v0.6.0 EntryPoint
- 文档和示例更成熟

---

## 4. Dashboard 和 API Key 配置

### 4.1 注册与登录

1. 访问 **https://dashboard.biconomy.io**
2. 支持 Email、Github、Gitlab 登录
3. 创建账户后进入主面板

### 4.2 创建 Paymaster

1. 在 Dashboard 中点击 "Create Paymaster" 或类似按钮
2. 填写:
   - **Paymaster Name**: 自定义名称（如 `morph-mainnet-paymaster`）
   - **Blockchain Network**: 选择 Morph (Chain ID: 2818)
   - **Paymaster Version**: 选择对应版本
   - **Type**: `HYBRID`（支持 Sponsored 和 Token 模式）
3. 点击 Register 完成创建

### 4.3 获取 API Key

创建 Paymaster 后，在 Overview 页面可以获取:
- **Paymaster API Key**: 用于 SDK 配置
- **Paymaster URL**: 完整的 Paymaster 端点

### 4.4 配置 Gas Sponsorship 策略

在 Dashboard 中可以设置：
- **白名单合约**: 仅为指定合约的交互代付 gas
- **白名单方法**: 仅为指定的合约方法代付 gas
- **Spending Limits**: 设置全局或每用户的 gas 花费上限
- **充值 Gas Tank**: 向 Paymaster 合约充值 ETH 用于代付

### 4.5 Dashboard API (程序化管理)

```bash
# 获取 Paymaster 列表
curl -X GET \
  'https://paymaster-dashboard-backend.prod.biconomy.io/api/v2/public/sdk/paymaster' \
  -H 'authToken: YOUR_AUTH_TOKEN'

# 创建新 Paymaster
curl -X POST \
  'https://paymaster-dashboard-backend.prod.biconomy.io/api/v2/public/sdk/paymaster' \
  -H 'authToken: YOUR_AUTH_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "morph-paymaster",
    "type": "HYBRID",
    "chainId": 2818,
    "version": "1.1.0"
  }'

# 注册白名单合约
curl -X POST \
  'https://paymaster-dashboard-backend.prod.biconomy.io/api/v2/public/sdk/smart-contract' \
  -H 'authToken: YOUR_AUTH_TOKEN' \
  -H 'apiKey: YOUR_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "MyContract",
    "address": "0x...",
    "abi": "[...]",
    "whitelistedMethods": ["transfer", "approve"]
  }'
```

---

## 5. 核心功能代码示例

### 5.1 环境变量配置

创建 `.env.local` 文件:

```bash
# Biconomy 配置
NEXT_PUBLIC_BICONOMY_PAYMASTER_API_KEY=your-paymaster-api-key
NEXT_PUBLIC_BICONOMY_BUNDLER_URL=https://bundler.biconomy.io/api/v2/2818/your-api-key

# Morph 网络
NEXT_PUBLIC_MORPH_RPC_URL=https://rpc-quicknode.morph.network
NEXT_PUBLIC_MORPH_CHAIN_ID=2818
```

### 5.2 创建 Smart Account (Node.js / 脚本)

```typescript
import { createWalletClient, http, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  createSmartAccountClient,
  PaymasterMode,
} from "@biconomy/account";

// Morph 链定义
const morph = {
  id: 2818,
  name: "Morph",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc-quicknode.morph.network"] },
  },
  blockExplorers: {
    default: { name: "Morph Explorer", url: "https://explorer.morph.network" },
  },
} as const;

// 配置
const PRIVATE_KEY = process.env.PRIVATE_KEY as `0x${string}`;
const BUNDLER_URL = process.env.NEXT_PUBLIC_BICONOMY_BUNDLER_URL!;
const PAYMASTER_API_KEY = process.env.NEXT_PUBLIC_BICONOMY_PAYMASTER_API_KEY!;

async function main() {
  // 1. 创建 EOA Signer
  const account = privateKeyToAccount(PRIVATE_KEY);
  const walletClient = createWalletClient({
    account,
    chain: morph,
    transport: http(),
  });

  // 2. 创建 Smart Account
  const smartAccount = await createSmartAccountClient({
    signer: walletClient,
    chainId: 2818,
    bundlerUrl: BUNDLER_URL,
    biconomyPaymasterApiKey: PAYMASTER_API_KEY,
  });

  const saAddress = await smartAccount.getAccountAddress();
  console.log("Smart Account Address:", saAddress);

  return smartAccount;
}
```

### 5.3 发送 UserOperation (原生 ETH 转账)

```typescript
async function sendNativeTransfer(smartAccount: any) {
  const transaction = {
    to: "0xRecipientAddress" as `0x${string}`,
    data: "0x" as `0x${string}`,
    value: parseEther("0.001"),
  };

  // 不使用 Paymaster，用户自付 gas
  const userOpResponse = await smartAccount.sendTransaction(transaction);
  const receipt = await userOpResponse.wait();

  console.log("Transaction Hash:", receipt.receipt.transactionHash);
  console.log(
    "Explorer:",
    `https://explorer.morph.network/tx/${receipt.receipt.transactionHash}`
  );
}
```

### 5.4 发送 Gasless 交易 (使用 Paymaster)

```typescript
async function sendGaslessTransaction(smartAccount: any) {
  const transaction = {
    to: "0xContractAddress" as `0x${string}`,
    data: "0xEncodedCalldata" as `0x${string}`,
  };

  // 使用 Paymaster 代付 gas (Sponsored 模式)
  const userOpResponse = await smartAccount.sendTransaction(transaction, {
    paymasterServiceData: {
      mode: PaymasterMode.SPONSORED,
    },
  });

  const receipt = await userOpResponse.wait();
  console.log("Gasless Transaction Hash:", receipt.receipt.transactionHash);
}
```

### 5.5 批量交易 (Batch Transactions)

```typescript
async function sendBatchTransactions(smartAccount: any) {
  const transactions = [
    {
      to: "0xTokenAddress" as `0x${string}`,
      data: "0xApproveCalldata" as `0x${string}`,
    },
    {
      to: "0xDexAddress" as `0x${string}`,
      data: "0xSwapCalldata" as `0x${string}`,
    },
  ];

  // 批量执行 + gasless
  const userOpResponse = await smartAccount.sendTransaction(transactions, {
    paymasterServiceData: {
      mode: PaymasterMode.SPONSORED,
    },
  });

  const receipt = await userOpResponse.wait();
  console.log("Batch Transaction Hash:", receipt.receipt.transactionHash);
}
```

### 5.6 使用 ERC-20 代币支付 Gas

```typescript
async function sendERC20GasTransaction(smartAccount: any) {
  const transaction = {
    to: "0xContractAddress" as `0x${string}`,
    data: "0xCalldata" as `0x${string}`,
  };

  // 使用 ERC-20 代币支付 gas
  const userOpResponse = await smartAccount.sendTransaction(transaction, {
    paymasterServiceData: {
      mode: PaymasterMode.ERC20,
      preferredToken: "0xUSDCAddressOnMorph", // USDC 或其他支持的代币
    },
  });

  const receipt = await userOpResponse.wait();
  console.log("ERC20 Gas Transaction Hash:", receipt.receipt.transactionHash);
}
```

---

## 6. Next.js 前端集成完整方案

### 6.1 安装依赖

```bash
npm install @biconomy/account viem wagmi @tanstack/react-query
```

### 6.2 Morph 链定义

创建 `src/config/chains.ts`:

```typescript
import { defineChain } from "viem";

export const morph = defineChain({
  id: 2818,
  name: "Morph",
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
});

export const morphTestnet = defineChain({
  id: 2910,
  name: "Morph Hoodi Testnet",
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
  testnet: true,
});
```

### 6.3 Biconomy 配置

创建 `src/config/biconomy.ts`:

```typescript
export const biconomyConfig = {
  bundlerUrl: process.env.NEXT_PUBLIC_BICONOMY_BUNDLER_URL!,
  paymasterApiKey: process.env.NEXT_PUBLIC_BICONOMY_PAYMASTER_API_KEY!,
  chainId: 2818,
};
```

### 6.4 Wagmi 配置

创建 `src/config/wagmi.ts`:

```typescript
import { createConfig, http } from "wagmi";
import { injected, walletConnect } from "wagmi/connectors";
import { morph } from "./chains";

export const wagmiConfig = createConfig({
  chains: [morph],
  connectors: [
    injected(),
    // 可选: WalletConnect
    // walletConnect({ projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID! }),
  ],
  transports: {
    [morph.id]: http("https://rpc-quicknode.morph.network"),
  },
});
```

### 6.5 Provider 组件

创建 `src/providers/Web3Provider.tsx`:

```typescript
"use client";

import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { wagmiConfig } from "@/config/wagmi";
import { useState, type ReactNode } from "react";

export function Web3Provider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
```

### 6.6 Biconomy Smart Account Hook

创建 `src/hooks/useSmartAccount.ts`:

```typescript
"use client";

import { useState, useCallback } from "react";
import { useWalletClient } from "wagmi";
import {
  createSmartAccountClient,
  PaymasterMode,
  type BiconomySmartAccountV2,
} from "@biconomy/account";
import { biconomyConfig } from "@/config/biconomy";

export function useSmartAccount() {
  const { data: walletClient } = useWalletClient();
  const [smartAccount, setSmartAccount] =
    useState<BiconomySmartAccountV2 | null>(null);
  const [smartAccountAddress, setSmartAccountAddress] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const createSmartAccount = useCallback(async () => {
    if (!walletClient) {
      setError("Please connect your wallet first");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const account = await createSmartAccountClient({
        signer: walletClient,
        chainId: biconomyConfig.chainId,
        bundlerUrl: biconomyConfig.bundlerUrl,
        biconomyPaymasterApiKey: biconomyConfig.paymasterApiKey,
      });

      const address = await account.getAccountAddress();
      setSmartAccount(account);
      setSmartAccountAddress(address);

      console.log("Smart Account created:", address);
    } catch (err: any) {
      console.error("Failed to create smart account:", err);
      setError(err.message || "Failed to create smart account");
    } finally {
      setLoading(false);
    }
  }, [walletClient]);

  const sendGaslessTransaction = useCallback(
    async (to: string, data: string, value?: bigint) => {
      if (!smartAccount) {
        throw new Error("Smart account not initialized");
      }

      const tx = {
        to: to as `0x${string}`,
        data: data as `0x${string}`,
        ...(value ? { value } : {}),
      };

      const userOpResponse = await smartAccount.sendTransaction(tx, {
        paymasterServiceData: {
          mode: PaymasterMode.SPONSORED,
        },
      });

      const receipt = await userOpResponse.wait();
      return receipt;
    },
    [smartAccount]
  );

  const sendBatchGaslessTransactions = useCallback(
    async (transactions: Array<{ to: string; data: string; value?: bigint }>) => {
      if (!smartAccount) {
        throw new Error("Smart account not initialized");
      }

      const txs = transactions.map((tx) => ({
        to: tx.to as `0x${string}`,
        data: tx.data as `0x${string}`,
        ...(tx.value ? { value: tx.value } : {}),
      }));

      const userOpResponse = await smartAccount.sendTransaction(txs, {
        paymasterServiceData: {
          mode: PaymasterMode.SPONSORED,
        },
      });

      const receipt = await userOpResponse.wait();
      return receipt;
    },
    [smartAccount]
  );

  return {
    smartAccount,
    smartAccountAddress,
    loading,
    error,
    createSmartAccount,
    sendGaslessTransaction,
    sendBatchGaslessTransactions,
  };
}
```

### 6.7 完整页面组件

创建 `src/components/SmartAccountDemo.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { parseEther, encodeFunctionData } from "viem";
import { useSmartAccount } from "@/hooks/useSmartAccount";

export function SmartAccountDemo() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const {
    smartAccountAddress,
    loading,
    error,
    createSmartAccount,
    sendGaslessTransaction,
  } = useSmartAccount();

  const [txHash, setTxHash] = useState("");
  const [sending, setSending] = useState(false);
  const [recipient, setRecipient] = useState("");

  // 连接钱包
  const handleConnect = () => {
    const connector = connectors[0];
    if (connector) {
      connect({ connector });
    }
  };

  // 创建 Smart Account
  const handleCreateSmartAccount = async () => {
    await createSmartAccount();
  };

  // 发送 gasless 交易示例
  const handleSendGasless = async () => {
    if (!recipient) return;
    setSending(true);
    try {
      const receipt = await sendGaslessTransaction(
        recipient,
        "0x", // 简单 ETH 转账，无 calldata
        parseEther("0.001")
      );
      setTxHash(receipt.receipt.transactionHash);
    } catch (err: any) {
      console.error("Transaction failed:", err);
      alert(`Transaction failed: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  // 发送 ERC-20 approve + transfer 批量交易示例
  const handleBatchTransaction = async () => {
    setSending(true);
    try {
      const erc20Abi = [
        {
          name: "approve",
          type: "function",
          inputs: [
            { name: "spender", type: "address" },
            { name: "amount", type: "uint256" },
          ],
          outputs: [{ type: "bool" }],
        },
        {
          name: "transfer",
          type: "function",
          inputs: [
            { name: "to", type: "address" },
            { name: "amount", type: "uint256" },
          ],
          outputs: [{ type: "bool" }],
        },
      ] as const;

      const tokenAddress = "0xYourTokenAddress";
      const spenderAddress = "0xSpenderAddress";
      const recipientAddress = "0xRecipientAddress";
      const amount = parseEther("10");

      const approveData = encodeFunctionData({
        abi: erc20Abi,
        functionName: "approve",
        args: [spenderAddress as `0x${string}`, amount],
      });

      const transferData = encodeFunctionData({
        abi: erc20Abi,
        functionName: "transfer",
        args: [recipientAddress as `0x${string}`, amount],
      });

      const receipt = await sendGaslessTransaction(tokenAddress, approveData);
      setTxHash(receipt.receipt.transactionHash);
    } catch (err: any) {
      console.error("Batch transaction failed:", err);
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ padding: "2rem", maxWidth: "600px", margin: "0 auto" }}>
      <h1>Biconomy AA on Morph</h1>

      {/* 钱包连接 */}
      <section>
        <h2>1. Connect Wallet</h2>
        {isConnected ? (
          <div>
            <p>EOA: {address}</p>
            <button onClick={() => disconnect()}>Disconnect</button>
          </div>
        ) : (
          <button onClick={handleConnect}>Connect MetaMask</button>
        )}
      </section>

      {/* Smart Account 创建 */}
      {isConnected && (
        <section>
          <h2>2. Create Smart Account</h2>
          <button onClick={handleCreateSmartAccount} disabled={loading}>
            {loading ? "Creating..." : "Create Smart Account"}
          </button>
          {smartAccountAddress && (
            <p>
              Smart Account:{" "}
              <a
                href={`https://explorer.morph.network/address/${smartAccountAddress}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {smartAccountAddress}
              </a>
            </p>
          )}
          {error && <p style={{ color: "red" }}>{error}</p>}
        </section>
      )}

      {/* 发送交易 */}
      {smartAccountAddress && (
        <section>
          <h2>3. Send Gasless Transaction</h2>
          <input
            type="text"
            placeholder="Recipient address (0x...)"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            style={{ width: "100%", padding: "8px", marginBottom: "8px" }}
          />
          <button onClick={handleSendGasless} disabled={sending}>
            {sending ? "Sending..." : "Send 0.001 ETH (Gasless)"}
          </button>

          {txHash && (
            <p>
              TX:{" "}
              <a
                href={`https://explorer.morph.network/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {txHash.slice(0, 10)}...{txHash.slice(-8)}
              </a>
            </p>
          )}
        </section>
      )}
    </div>
  );
}
```

### 6.8 App Layout 集成

在 `src/app/layout.tsx` 中添加 Provider:

```typescript
import { Web3Provider } from "@/providers/Web3Provider";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Web3Provider>{children}</Web3Provider>
      </body>
    </html>
  );
}
```

在页面中使用:

```typescript
// src/app/page.tsx
import { SmartAccountDemo } from "@/components/SmartAccountDemo";

export default function Home() {
  return <SmartAccountDemo />;
}
```

---

## 7. Smart Sessions (Session Keys)

Session Keys 允许在有限权限和时间范围内，代表用户自动执行交易，无需每次都要求用户签名。

### 7.1 概念

- **Session Key**: 一个临时的密钥对，被授予有限的操作权限
- **Session Validation Module**: 验证 Session Key 权限范围的智能合约
- **权限范围**: 可限制可调用的合约地址、方法、参数范围、有效期

### 7.2 Legacy V2 Session Keys 示例

```typescript
import {
  createSmartAccountClient,
  createSession,
  PaymasterMode,
  Policy,
  Rule,
  createSessionKeyEOA,
} from "@biconomy/account";

// 1. 创建 Session Key EOA
const { sessionKeyAddress, sessionStorageClient } =
  await createSessionKeyEOA(smartAccount, morph);

// 2. 定义策略规则
const rules: Rule[] = [
  {
    offset: 0, // 方法参数偏移量
    condition: 0, // 0 = equal, 1 = less_than, 2 = greater_than, etc.
    referenceValue: "0xRecipientAddress", // 允许的参数值
  },
];

const policy: Policy[] = [
  {
    sessionKeyAddress,
    contractAddress: "0xTokenContractAddress",
    functionSelector: "transfer(address,uint256)",
    rules,
    interval: {
      validUntil: Math.floor(Date.now() / 1000) + 86400, // 24 小时有效
      validAfter: 0,
    },
    valueLimit: BigInt(0),
  },
];

// 3. 创建 Session
const { session, transactionHash } = await createSession(
  smartAccount,
  policy,
  sessionStorageClient,
  {
    paymasterServiceData: {
      mode: PaymasterMode.SPONSORED,
    },
  }
);

console.log("Session created, tx:", transactionHash);
```

### 7.3 Nexus Smart Sessions (新版)

使用 `@biconomy/abstractjs` 或 `@biconomy/sdk` 的 Smart Sessions:

```typescript
import {
  createSmartAccountClient,
  toSmartSessionsValidator,
} from "@biconomy/sdk"; // 或 @biconomy/abstractjs

// 1. 创建 Nexus Client
const nexusClient = await createSmartAccountClient({
  chain: morph,
  signer: account,
  transport: http(),
  bundlerTransport: http(bundlerUrl),
});

// 2. 授予 Session 权限
const createSessionsResponse = await nexusSessionClient.grantPermission({
  sessionRequestedInfo: [
    {
      sessionPublicKey: sessionPublicKey,
      actionPoliciesInfo: [
        {
          contractAddress: "0xTargetContract",
          functionSelector: "0x...", // 函数选择器
          rules: [
            // ABI 参数验证规则
          ],
          valueLimit: BigInt(0),
        },
      ],
    },
  ],
});

// 3. 使用 Session Key 发送交易
const smartSessionNexusClient = await createSmartAccountClient({
  chain: morph,
  accountAddress: sessionData.granter,
  signer: sessionOwner,
  transport: http(),
  bundlerTransport: http(bundlerUrl),
});

const sessionModule = toSmartSessionsValidator({
  account: smartSessionNexusClient.account,
  signer: sessionOwner,
  moduleData: sessionData.moduleData,
});
```

---

## 8. 注意事项与限制

### 8.1 Morph 链特殊注意

1. **EntryPoint 版本**: Morph 仅支持 EntryPoint v0.6.0 (Legacy)，不支持 v0.7.0
2. **MEE 不支持**: Morph 不在 Biconomy MEE (Modular Execution Environment) 的 19 条主网支持链列表中，因此不能使用 AbstractJS 的跨链编排功能
3. **合约验证**: 在实际开发前，务必通过 Morph Explorer 验证 Biconomy 合约是否已部署在 Morph 主网上
4. **Dashboard 支持**: 需在 Biconomy Dashboard 上确认 Morph 网络是否可创建 Paymaster

### 8.2 Bundler 注意事项

- 测试网 Bundler URL 可直接使用示例 API Key 测试
- 主网 Bundler URL 需要正式的 API Key，可能需要联系 Biconomy 团队获取
- Bundler 的 gas 估算可能需要根据 Morph L2 的 gas 模型做调整

### 8.3 Paymaster 注意事项

- Sponsored 模式需要在 Dashboard 上为 Paymaster 充值 ETH
- 需要设置白名单合约和方法，防止恶意使用
- ERC-20 支付模式需要确认 Morph 上支持的 Token 列表

### 8.4 SDK 版本兼容性

| 包 | 推荐版本 | 兼容 EntryPoint | 备注 |
|---|---------|----------------|------|
| `@biconomy/account` | 最新 4.x | v0.6.0, v0.7.0 | Legacy 但稳定 |
| `@biconomy/sdk` | 最新 | v0.7.0 | Nexus 过渡版 |
| `@biconomy/abstractjs` | 最新 | v0.7.0 + MEE | 最新，Morph 暂不支持 MEE |

### 8.5 建议的开发流程

1. 先在 **Morph Explorer** 上验证 EntryPoint 和 Biconomy 合约是否已部署
2. 在 **Biconomy Dashboard** 上尝试创建 Morph 的 Paymaster
3. 如果 Dashboard 不支持，联系 Biconomy 团队确认 Morph 支持状态
4. 使用 `@biconomy/account` SDK 进行开发
5. 先在测试网验证完整流程
6. 迁移到主网

### 8.6 替代方案

如果 Biconomy 在 Morph 上的支持不够成熟，可考虑以下替代 AA 基础设施:

- **Pimlico**: 通用 ERC-4337 Bundler + Paymaster 服务
- **Alchemy AA**: Account Kit
- **ZeroDev**: Kernel Smart Account
- **StackUp**: 开源 Bundler

---

## 参考资料

- Biconomy 官方文档: https://docs.biconomy.io
- Biconomy Legacy 文档: https://legacy-docs.biconomy.io
- Biconomy Dashboard: https://dashboard.biconomy.io
- Biconomy GitHub: https://github.com/bcnmy
- AbstractJS SDK: https://github.com/bcnmy/abstractjs
- Nexus Smart Account: https://github.com/bcnmy/nexus
- Biconomy 支持链列表: https://docs.biconomy.io/contracts-and-audits/supported-chains
- Morph 官方文档: https://docs.morph.network
- Morph Explorer: https://explorer.morph.network
- ERC-4337 标准: https://eips.ethereum.org/EIPS/eip-4337
- EntryPoint v0.6.0: `0x5ff137d4b0fdcd49dca30c7cf57e578a026d2789`
