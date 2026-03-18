/**
 * Send a real UserOp using Biconomy SDK on Morph mainnet.
 * Uses MEE key with v0.6 bundler endpoint.
 */

import { createSmartAccountClient } from "@biconomy/account";
import { createWalletClient, http, parseEther, formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { defineChain, createPublicClient } from "viem";

const PRIVATE_KEY = "0x8de25b147e0dc0004df05427cc2480bf4df9a9bebf8ed8f7df00afd159ba2ddd";
const MEE_KEY = "mee_WbRaLNUhGHyYqm9MXUZoSz";
const BUNDLER_URL = `https://bundler.biconomy.io/api/v2/2818/${MEE_KEY}`;

const morph = defineChain({
  id: 2818,
  name: "Morph",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc-quicknode.morph.network"] } },
});

async function main() {
  console.log("=== Biconomy SDK UserOp Test (Morph Mainnet) ===\n");

  // 1. Create signer
  const account = privateKeyToAccount(PRIVATE_KEY);
  console.log("EOA:", account.address);

  const walletClient = createWalletClient({
    account,
    chain: morph,
    transport: http(),
  });

  const publicClient = createPublicClient({
    chain: morph,
    transport: http(),
  });

  // 2. Create Smart Account
  console.log("\n--- Creating Smart Account ---");
  const smartAccount = await createSmartAccountClient({
    signer: walletClient,
    bundlerUrl: BUNDLER_URL,
    chainId: 2818,
  });

  const saAddress = await smartAccount.getAccountAddress();
  console.log("Smart Account:", saAddress);

  // 3. Check balance
  const balance = await publicClient.getBalance({ address: saAddress });
  console.log("SA Balance:", formatEther(balance), "ETH");

  // 4. Send a self-transfer (0 ETH to self)
  console.log("\n--- Sending UserOp (self-transfer 0 ETH) ---");
  try {
    const tx = {
      to: saAddress,
      value: BigInt(0),
      data: "0x",
    };

    console.log("Building UserOp...");
    const userOpResponse = await smartAccount.sendTransaction(tx);
    console.log("UserOp submitted!");
    console.log("Waiting for confirmation...");

    const receipt = await userOpResponse.wait();
    console.log("\n✅ Transaction confirmed!");
    console.log("  Tx hash:", receipt.receipt.transactionHash);
    console.log("  Block:", receipt.receipt.blockNumber);
    console.log("  Success:", receipt.success);
  } catch (err) {
    console.log("\n❌ Error:", err.message);
    if (err.message.includes("AA")) {
      console.log("\nThis is an Account Abstraction error.");
      console.log("AA23 = signature validation failed");
      console.log("AA21 = didn't pay prefund");
      console.log("AA25 = nonce error");
    }
  }

  // 5. Check balance after
  const balanceAfter = await publicClient.getBalance({ address: saAddress });
  console.log("\nSA Balance after:", formatEther(balanceAfter), "ETH");
}

main().catch(console.error);
