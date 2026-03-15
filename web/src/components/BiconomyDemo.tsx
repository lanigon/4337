"use client";

import { useState, useCallback } from "react";
import { useAccount, useConnect, useDisconnect, useWalletClient } from "wagmi";
import { injected } from "wagmi/connectors";
import {
  createSmartAccountClient,
  BiconomySmartAccountV2,
  PaymasterMode,
} from "@biconomy/account";
import { morphHoodi } from "@/lib/wagmi";

const BICONOMY_BUNDLER_URL = `https://bundler.biconomy.io/api/v2/${morphHoodi.id}/nJPK7B3ru.dd7f7861-190d-41bd-af80-6877f74b8f44`;

type Log = {
  time: string;
  msg: string;
  type: "info" | "success" | "error";
};

export function BiconomyDemo() {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const { data: walletClient } = useWalletClient();

  const [smartAccount, setSmartAccount] =
    useState<BiconomySmartAccountV2 | null>(null);
  const [smartAccountAddress, setSmartAccountAddress] = useState<string>("");
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(false);

  const addLog = useCallback(
    (msg: string, type: Log["type"] = "info") => {
      const time = new Date().toLocaleTimeString();
      setLogs((prev) => [...prev, { time, msg, type }]);
    },
    []
  );

  const handleConnect = () => {
    connect({ connector: injected() });
  };

  const handleCreateSmartAccount = async () => {
    if (!walletClient) {
      addLog("Wallet client not ready", "error");
      return;
    }

    setLoading(true);
    addLog("Creating Biconomy Smart Account...");

    try {
      const account = await createSmartAccountClient({
        signer: walletClient,
        bundlerUrl: BICONOMY_BUNDLER_URL,
        biconomyPaymasterApiKey: "demo-key",
        chainId: morphHoodi.id,
      });

      const saAddress = await account.getAccountAddress();
      setSmartAccount(account);
      setSmartAccountAddress(saAddress);
      addLog(`Smart Account created: ${saAddress}`, "success");
      addLog(
        `EntryPoint: 0x5ff137d4b0fdcd49dca30c7cf57e578a026d2789`,
        "info"
      );
    } catch (err) {
      addLog(`Error: ${(err as Error).message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSendTx = async () => {
    if (!smartAccount) {
      addLog("Create Smart Account first", "error");
      return;
    }

    setLoading(true);
    addLog("Building UserOperation...");

    try {
      const tx = {
        to: smartAccountAddress as `0x${string}`,
        value: BigInt(0),
        data: "0x" as `0x${string}`,
      };

      addLog("Sending UserOperation to Bundler...");
      const userOpResponse = await smartAccount.sendTransaction(tx, {
        paymasterServiceData: { mode: PaymasterMode.SPONSORED },
      });

      addLog("Waiting for transaction...");
      const receipt = await userOpResponse.wait();
      addLog(
        `Transaction confirmed! Hash: ${receipt.receipt.transactionHash}`,
        "success"
      );
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes("paymaster") || msg.includes("Paymaster")) {
        addLog(
          "Paymaster not configured for this network. This is expected in demo mode — you need a valid Biconomy API key with Paymaster enabled for Morph.",
          "error"
        );
      } else {
        addLog(`Error: ${msg}`, "error");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-2">Biconomy AA Wallet Demo</h2>
        <p className="text-zinc-400 text-sm">
          ERC-4337 Account Abstraction on Morph L2 — powered by Biconomy
        </p>
      </div>

      {/* Architecture Info */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 mb-6 text-sm font-mono text-zinc-400">
        <div className="text-zinc-300 mb-2 font-sans font-medium">
          Architecture
        </div>
        <div>
          EOA Signer → Smart Account (ERC-4337) → Bundler → EntryPoint →
          Morph L2
        </div>
        <div className="mt-1 text-zinc-500">
          Chain: Morph Holesky Testnet (2810) | EntryPoint v0.6.0
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-4 mb-8">
        {/* Step 1: Connect */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs text-zinc-500 uppercase tracking-wider">
                Step 1
              </span>
              <h3 className="text-lg font-semibold mt-1">Connect EOA Wallet</h3>
              {isConnected && (
                <p className="text-sm text-zinc-400 mt-1 font-mono">
                  {address?.slice(0, 6)}...{address?.slice(-4)}
                </p>
              )}
            </div>
            {isConnected ? (
              <button
                onClick={() => {
                  disconnect();
                  setSmartAccount(null);
                  setSmartAccountAddress("");
                  setLogs([]);
                }}
                className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition text-sm"
              >
                Disconnect
              </button>
            ) : (
              <button
                onClick={handleConnect}
                className="px-4 py-2 rounded-lg bg-white text-black hover:bg-zinc-200 transition text-sm font-medium"
              >
                Connect MetaMask
              </button>
            )}
          </div>
        </div>

        {/* Step 2: Create Smart Account */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs text-zinc-500 uppercase tracking-wider">
                Step 2
              </span>
              <h3 className="text-lg font-semibold mt-1">
                Create Smart Account
              </h3>
              {smartAccountAddress && (
                <p className="text-sm text-emerald-400 mt-1 font-mono">
                  {smartAccountAddress.slice(0, 6)}...
                  {smartAccountAddress.slice(-4)}
                </p>
              )}
            </div>
            <button
              onClick={handleCreateSmartAccount}
              disabled={!isConnected || !!smartAccount || loading}
              className="px-4 py-2 rounded-lg bg-white text-black hover:bg-zinc-200 transition text-sm font-medium disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {smartAccount ? "Created" : "Create"}
            </button>
          </div>
        </div>

        {/* Step 3: Send Transaction */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs text-zinc-500 uppercase tracking-wider">
                Step 3
              </span>
              <h3 className="text-lg font-semibold mt-1">
                Send Gasless Transaction
              </h3>
              <p className="text-sm text-zinc-500 mt-1">
                Paymaster sponsors gas fees
              </p>
            </div>
            <button
              onClick={handleSendTx}
              disabled={!smartAccount || loading}
              className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 transition text-sm font-medium disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {loading ? "Processing..." : "Send TX"}
            </button>
          </div>
        </div>
      </div>

      {/* Log Console */}
      {logs.length > 0 && (
        <div className="bg-black border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-zinc-500 uppercase tracking-wider">
              Console
            </span>
            <button
              onClick={() => setLogs([])}
              className="text-xs text-zinc-600 hover:text-zinc-400"
            >
              Clear
            </button>
          </div>
          <div className="space-y-1 font-mono text-xs max-h-64 overflow-y-auto">
            {logs.map((log, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-zinc-600 shrink-0">{log.time}</span>
                <span
                  className={
                    log.type === "success"
                      ? "text-emerald-400"
                      : log.type === "error"
                        ? "text-red-400"
                        : "text-zinc-400"
                  }
                >
                  {log.msg}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info Footer */}
      <div className="mt-8 text-xs text-zinc-600 space-y-1">
        <p>
          Key contracts: EntryPoint{" "}
          <span className="font-mono">0x5ff1...2789</span> | Smart Account
          Factory{" "}
          <span className="font-mono">0x0000...34F5</span>
        </p>
        <p>
          Note: Gasless transactions require a funded Paymaster via Biconomy
          Dashboard.
        </p>
      </div>
    </div>
  );
}
