/**
 * Biconomy MEE + Base Sepolia 测试脚本
 *
 * 测试流程：
 * 1. 用 EOA 私钥创建 signer
 * 2. 创建 Multichain Nexus Account（AA 钱包）
 * 3. 连接 MEE Client
 * 4. 查看 Smart Account 地址
 *
 * 用法：
 *   node test-mee.mjs
 *
 * 环境变量：
 *   PRIVATE_KEY   — EOA 私钥（测试用，不需要有钱）
 *   MEE_API_KEY   — Biconomy MEE API Key（mee_ 开头）
 */

import {
  createMeeClient,
  toMultichainNexusAccount,
  getMEEVersion,
  MEEVersion,
} from "@biconomy/abstractjs";
import { http, createPublicClient, formatEther } from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { baseSepolia } from "viem/chains";

// ─── 配置 ──────────────────────────────────────────────────────────

const PRIVATE_KEY = process.env.PRIVATE_KEY || generatePrivateKey();
const MEE_API_KEY = process.env.MEE_API_KEY || "mee_iZi8eDb3zWRye7Lay5C29";

console.log("=== Biconomy MEE + ERC-4337 测试 ===\n");

// ─── Step 1: 创建 EOA Signer ──────────────────────────────────────

const eoa = privateKeyToAccount(PRIVATE_KEY);
console.log("1. EOA Signer:");
console.log(`   Address: ${eoa.address}`);
if (!process.env.PRIVATE_KEY) {
  console.log(`   Private Key: ${PRIVATE_KEY}`);
  console.log("   (自动生成的测试私钥，请保存如需复用)\n");
} else {
  console.log();
}

// ─── Step 2: 创建 Multichain Nexus Account ────────────────────────

console.log("2. 创建 Smart Account (Nexus)...");
try {
  const orchestrator = await toMultichainNexusAccount({
    signer: eoa,
    chainConfigurations: [
      {
        chain: baseSepolia,
        transport: http(),
        version: getMEEVersion(MEEVersion.V2_1_0),
      },
    ],
  });

  // 获取各链上的 Smart Account 地址
  const deployments = orchestrator.deployments;
  console.log("   Smart Account 部署信息:");
  for (const deployment of deployments) {
    console.log(`   - ${deployment.chain.name} (Chain ID: ${deployment.chain.id}): ${deployment.address}`);
  }
  console.log();

  // ─── Step 3: 创建 MEE Client ──────────────────────────────────

  console.log("3. 连接 MEE Client...");
  const meeClient = await createMeeClient({
    account: orchestrator,
    apiKey: MEE_API_KEY,
  });

  console.log("   MEE Client 连接成功!\n");

  // ─── Step 4: 查看余额 ────────────────────────────────────────

  console.log("4. 查看 Smart Account 余额...");
  const baseClient = createPublicClient({
    chain: baseSepolia,
    transport: http(),
  });

  const saAddress = deployments[0].address;
  const balance = await baseClient.getBalance({ address: saAddress });
  console.log(`   Base Sepolia ETH 余额: ${formatEther(balance)} ETH`);

  if (balance === 0n) {
    console.log(`\n   ⚠ Smart Account 余额为 0`);
    console.log(`   如果要测试发送交易，需要先往 Smart Account 充测试 ETH：`);
    console.log(`   地址: ${saAddress}`);
    console.log(`   水龙头: https://www.alchemy.com/faucets/base-sepolia`);
  }

  console.log("\n=== 测试完成 ===");
  console.log("\nSmart Account 地址汇总:");
  for (const deployment of deployments) {
    console.log(`  ${deployment.chain.name}: ${deployment.address}`);
  }

} catch (err) {
  console.error("\n❌ 错误:", err.message);
  if (err.message.includes("API")) {
    console.error("   可能是 API Key 无效或过期，请检查 MEE_API_KEY");
  }
  if (err.message.includes("chain")) {
    console.error("   可能是链不被支持，请确认 Dashboard 配置");
  }
  console.error("\n完整错误:", err);
}
