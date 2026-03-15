/**
 * ERC-4337 测试 — Morph Hoodi 测试网
 *
 * 不用 Biconomy、不用 Paymaster、自己当 Bundler
 * 直接调用 EntryPoint.handleOps() 展示完整 4337 流程
 *
 * 前提：
 *   1. EOA 需要有测试网 ETH（用于部署 Smart Account 和垫付 gas）
 *   2. Morph Hoodi 水龙头：https://bridge-hoodi.morph.network/
 *
 * 用法：
 *   PRIVATE_KEY=0x... node test-morph-4337.mjs
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  encodeFunctionData,
  encodeAbiParameters,
  parseAbiParameters,
  keccak256,
  concat,
  pad,
  toHex,
  formatEther,
  parseEther,
  defineChain,
} from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";

// ─── Morph Hoodi 链定义 ───────────────────────────────────────────

const morphHoodi = defineChain({
  id: 2910,
  name: "Morph Hoodi Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc-hoodi.morph.network"] },
  },
  blockExplorers: {
    default: {
      name: "Morph Hoodi Explorer",
      url: "https://explorer-hoodi.morph.network",
    },
  },
  testnet: true,
});

// ─── 合约地址 ─────────────────────────────────────────────────────

// EntryPoint v0.6.0 — 所有 EVM 链上地址相同
const ENTRY_POINT = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";

// SimpleAccountFactory v0.6.0 — 标准部署地址
const SIMPLE_ACCOUNT_FACTORY = "0x9406Cc6185a346906296840746125a0E44976454";

// ─── ABI 片段 ─────────────────────────────────────────────────────

const entryPointAbi = [
  {
    name: "handleOps",
    type: "function",
    inputs: [
      {
        name: "ops",
        type: "tuple[]",
        components: [
          { name: "sender", type: "address" },
          { name: "nonce", type: "uint256" },
          { name: "initCode", type: "bytes" },
          { name: "callData", type: "bytes" },
          { name: "callGasLimit", type: "uint256" },
          { name: "verificationGasLimit", type: "uint256" },
          { name: "preVerificationGas", type: "uint256" },
          { name: "maxFeePerGas", type: "uint256" },
          { name: "maxPriorityFeePerGas", type: "uint256" },
          { name: "paymasterAndData", type: "bytes" },
          { name: "signature", type: "bytes" },
        ],
      },
      { name: "beneficiary", type: "address" },
    ],
    outputs: [],
  },
  {
    name: "getNonce",
    type: "function",
    inputs: [
      { name: "sender", type: "address" },
      { name: "key", type: "uint192" },
    ],
    outputs: [{ name: "nonce", type: "uint256" }],
    stateMutability: "view",
  },
  {
    name: "getUserOpHash",
    type: "function",
    inputs: [
      {
        name: "userOp",
        type: "tuple",
        components: [
          { name: "sender", type: "address" },
          { name: "nonce", type: "uint256" },
          { name: "initCode", type: "bytes" },
          { name: "callData", type: "bytes" },
          { name: "callGasLimit", type: "uint256" },
          { name: "verificationGasLimit", type: "uint256" },
          { name: "preVerificationGas", type: "uint256" },
          { name: "maxFeePerGas", type: "uint256" },
          { name: "maxPriorityFeePerGas", type: "uint256" },
          { name: "paymasterAndData", type: "bytes" },
          { name: "signature", type: "bytes" },
        ],
      },
    ],
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "view",
  },
  {
    name: "depositTo",
    type: "function",
    inputs: [{ name: "account", type: "address" }],
    outputs: [],
    stateMutability: "payable",
  },
  {
    name: "balanceOf",
    type: "function",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
];

const factoryAbi = [
  {
    name: "createAccount",
    type: "function",
    inputs: [
      { name: "owner", type: "address" },
      { name: "salt", type: "uint256" },
    ],
    outputs: [{ name: "ret", type: "address" }],
  },
  {
    name: "getAddress",
    type: "function",
    inputs: [
      { name: "owner", type: "address" },
      { name: "salt", type: "uint256" },
    ],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
];

const simpleAccountAbi = [
  {
    name: "execute",
    type: "function",
    inputs: [
      { name: "dest", type: "address" },
      { name: "value", type: "uint256" },
      { name: "func", type: "bytes" },
    ],
    outputs: [],
  },
];

// ─── 主流程 ───────────────────────────────────────────────────────

async function main() {
  console.log("=== ERC-4337 测试 — Morph Hoodi 测试网 ===\n");

  // 检查私钥
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.error("❌ 需要设置 PRIVATE_KEY 环境变量");
    console.error("   用法: PRIVATE_KEY=0x... node test-morph-4337.mjs");
    console.error("\n   如果还没有测试网 ETH，先去水龙头领：");
    console.error("   https://bridge-hoodi.morph.network/");
    process.exit(1);
  }

  const signer = privateKeyToAccount(privateKey);
  const publicClient = createPublicClient({
    chain: morphHoodi,
    transport: http(),
  });
  const walletClient = createWalletClient({
    account: signer,
    chain: morphHoodi,
    transport: http(),
  });

  console.log(`1. EOA Signer: ${signer.address}`);

  // 查 EOA 余额
  const eoaBalance = await publicClient.getBalance({
    address: signer.address,
  });
  console.log(`   EOA 余额: ${formatEther(eoaBalance)} ETH`);

  if (eoaBalance === 0n) {
    console.error("\n❌ EOA 余额为 0，需要先领测试网 ETH");
    console.error("   水龙头: https://bridge-hoodi.morph.network/");
    process.exit(1);
  }

  // ─── Step 2: 计算 Smart Account 地址 ───────────────────────────

  console.log("\n2. 计算 Smart Account 地址...");

  // 先检查 Factory 合约是否存在
  const factoryCode = await publicClient.getCode({
    address: SIMPLE_ACCOUNT_FACTORY,
  });

  if (!factoryCode || factoryCode === "0x") {
    console.error("❌ SimpleAccountFactory 未在 Morph Hoodi 上部署");
    console.error(`   地址: ${SIMPLE_ACCOUNT_FACTORY}`);
    console.error("   可能需要先部署 Factory 合约");
    process.exit(1);
  }

  const salt = 0n;
  const smartAccountAddress = await publicClient.readContract({
    address: SIMPLE_ACCOUNT_FACTORY,
    abi: factoryAbi,
    functionName: "getAddress",
    args: [signer.address, salt],
  });

  console.log(`   Smart Account: ${smartAccountAddress}`);
  console.log(
    `   Explorer: https://explorer-hoodi.morph.network/address/${smartAccountAddress}`
  );

  // 检查是否已部署
  const saCode = await publicClient.getCode({ address: smartAccountAddress });
  const isDeployed = saCode && saCode !== "0x";
  console.log(`   已部署: ${isDeployed ? "是" : "否（首次交易时自动部署）"}`);

  // ─── Step 3: 检查 EntryPoint ────────────────────────────────────

  console.log("\n3. 检查 EntryPoint...");
  const epCode = await publicClient.getCode({ address: ENTRY_POINT });
  if (!epCode || epCode === "0x") {
    console.error("❌ EntryPoint v0.6.0 未在 Morph Hoodi 上部署");
    console.error(`   地址: ${ENTRY_POINT}`);
    process.exit(1);
  }
  console.log(`   EntryPoint v0.6.0: ${ENTRY_POINT} ✓`);

  // ─── Step 4: 给 Smart Account 预存 ETH ─────────────────────────

  const saBalance = await publicClient.getBalance({
    address: smartAccountAddress,
  });
  console.log(`\n4. Smart Account 余额: ${formatEther(saBalance)} ETH`);

  if (saBalance < parseEther("0.001")) {
    console.log("   余额不足，转入 0.005 ETH...");
    const fundTx = await walletClient.sendTransaction({
      to: smartAccountAddress,
      value: parseEther("0.005"),
    });
    console.log(`   充值 tx: ${fundTx}`);
    await publicClient.waitForTransactionReceipt({ hash: fundTx });
    console.log("   充值完成 ✓");
  }

  // ─── Step 5: 构建 UserOperation ────────────────────────────────

  console.log("\n5. 构建 UserOperation...");

  // 获取 nonce
  const nonce = await publicClient.readContract({
    address: ENTRY_POINT,
    abi: entryPointAbi,
    functionName: "getNonce",
    args: [smartAccountAddress, 0n],
  });
  console.log(`   Nonce: ${nonce}`);

  // initCode：如果 Smart Account 未部署，需要包含 Factory 调用
  let initCode = "0x";
  if (!isDeployed) {
    const factoryCallData = encodeFunctionData({
      abi: factoryAbi,
      functionName: "createAccount",
      args: [signer.address, salt],
    });
    initCode = concat([SIMPLE_ACCOUNT_FACTORY, factoryCallData]);
    console.log("   包含 initCode（首次部署 Smart Account）");
  }

  // callData：让 Smart Account 执行一笔 0 ETH 转账给自己（测试用）
  const callData = encodeFunctionData({
    abi: simpleAccountAbi,
    functionName: "execute",
    args: [signer.address, 0n, "0x"],
  });

  // Gas 参数
  const gasPrice = await publicClient.getGasPrice();

  const userOp = {
    sender: smartAccountAddress,
    nonce: nonce,
    initCode: initCode,
    callData: callData,
    callGasLimit: 200000n,
    verificationGasLimit: isDeployed ? 200000n : 500000n,
    preVerificationGas: 60000n,
    maxFeePerGas: gasPrice * 2n,
    maxPriorityFeePerGas: gasPrice,
    paymasterAndData: "0x", // 不用 Paymaster
    signature: "0x", // 先占位，后面签名
  };

  // ─── Step 6: 签名 UserOperation ────────────────────────────────

  console.log("\n6. 签名 UserOperation...");

  // 获取 userOpHash
  const userOpHash = await publicClient.readContract({
    address: ENTRY_POINT,
    abi: entryPointAbi,
    functionName: "getUserOpHash",
    args: [userOp],
  });
  console.log(`   UserOp Hash: ${userOpHash}`);

  // 用 EOA 签名
  const signature = await signer.signMessage({
    message: { raw: userOpHash },
  });
  userOp.signature = signature;
  console.log(`   签名完成 ✓`);

  // ─── Step 7: 发送到 EntryPoint（自己当 Bundler）─────────────────

  console.log("\n7. 提交 UserOperation 到 EntryPoint...");
  console.log("   （我们自己当 Bundler，直接调用 handleOps）");

  try {
    const txHash = await walletClient.writeContract({
      address: ENTRY_POINT,
      abi: entryPointAbi,
      functionName: "handleOps",
      args: [[userOp], signer.address], // beneficiary = 我们自己
      gas: 1000000n,
    });

    console.log(`\n   ✅ 交易已提交!`);
    console.log(`   Tx Hash: ${txHash}`);
    console.log(
      `   Explorer: https://explorer-hoodi.morph.network/tx/${txHash}`
    );

    console.log("\n   等待确认...");
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
    });
    console.log(`   状态: ${receipt.status === "success" ? "成功 ✓" : "失败 ✗"}`);
    console.log(`   Gas Used: ${receipt.gasUsed}`);
    console.log(`   Block: ${receipt.blockNumber}`);
  } catch (err) {
    console.error(`\n   ❌ 交易失败: ${err.message}`);
    if (err.message.includes("AA")) {
      // ERC-4337 错误码
      console.error("   这是 EntryPoint 验证错误，常见原因：");
      console.error("   - AA10: sender already constructed（initCode 不应有）");
      console.error("   - AA21: didn't pay prefund（Smart Account 余额不足）");
      console.error("   - AA25: invalid signature（签名验证失败）");
    }
  }

  // ─── 最终状态 ──────────────────────────────────────────────────

  console.log("\n=== 最终状态 ===");
  const finalEoaBalance = await publicClient.getBalance({
    address: signer.address,
  });
  const finalSaBalance = await publicClient.getBalance({
    address: smartAccountAddress,
  });
  console.log(`EOA 余额:           ${formatEther(finalEoaBalance)} ETH`);
  console.log(`Smart Account 余额: ${formatEther(finalSaBalance)} ETH`);
}

main().catch(console.error);
