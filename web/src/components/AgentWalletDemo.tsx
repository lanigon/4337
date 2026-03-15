"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  useAccount,
  useConnect,
  useDisconnect,
  usePublicClient,
  useWalletClient,
} from "wagmi";
import { injected } from "wagmi/connectors";
import {
  encodeFunctionData,
  formatEther,
  parseEther,
  concat,
  type Address,
} from "viem";
import { morphHoodi } from "@/lib/wagmi";

// ─── 合约地址 & ABI ────────────────────────────────────────────────

const ENTRY_POINT: Address = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";
const SIMPLE_ACCOUNT_FACTORY: Address =
  "0x9406Cc6185a346906296840746125a0E44976454";

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
] as const;

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
] as const;

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
  {
    name: "executeBatch",
    type: "function",
    inputs: [
      { name: "dest", type: "address[]" },
      { name: "func", type: "bytes[]" },
    ],
    outputs: [],
  },
] as const;

// ─── 类型 ──────────────────────────────────────────────────────────

type Log = {
  time: string;
  msg: string;
  type: "info" | "success" | "error" | "step";
};

type Tab = "userop" | "batch" | "nonce" | "deposit";

// ─── 辅助组件 ──────────────────────────────────────────────────────

function FlowDiagram({ loading }: { loading: boolean }) {
  return (
    <div className="flex items-center gap-0 overflow-x-auto py-2">
      <div className={`flow-node ${loading ? "active" : ""}`}>EOA</div>
      <div className="flow-connector w-8 shrink-0" />
      <div className={`flow-node ${loading ? "active" : ""}`}>sign</div>
      <div className="flow-connector w-8 shrink-0" />
      <div className={`flow-node ${loading ? "active" : ""}`}>EntryPoint</div>
      <div className="flow-connector w-8 shrink-0" />
      <div className={`flow-node ${loading ? "active" : ""}`}>
        handleOps()
      </div>
      <div className="flow-connector w-8 shrink-0" />
      <div className={`flow-node ${loading ? "active" : ""}`}>
        SmartAccount
      </div>
    </div>
  );
}

function Mono({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontFamily: "var(--font-geist-mono), monospace" }}>
      {children}
    </span>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="text-[10px] tracking-[0.15em] uppercase"
      style={{ color: "var(--text-muted)" }}
    >
      {children}
    </span>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div>
      <div
        className="text-[10px] tracking-[0.1em] uppercase mb-0.5"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </div>
      <div
        className="text-sm"
        style={{
          fontFamily: "var(--font-geist-mono), monospace",
          color: accent ? "var(--gold)" : "var(--text-primary)",
        }}
      >
        {value}
      </div>
    </div>
  );
}

// ─── 组件 ──────────────────────────────────────────────────────────

export function AgentWalletDemo() {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const publicClient = usePublicClient({ chainId: morphHoodi.id });
  const { data: walletClient } = useWalletClient({ chainId: morphHoodi.id });

  const [smartAccountAddress, setSmartAccountAddress] = useState<string>("");
  const [isDeployed, setIsDeployed] = useState(false);
  const [eoaBalance, setEoaBalance] = useState<string>("—");
  const [saBalance, setSaBalance] = useState<string>("—");
  const [epDeposit, setEpDeposit] = useState<string>("—");
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(false);
  const [txHash, setTxHash] = useState<string>("");
  const [activeTab, setActiveTab] = useState<Tab>("userop");

  // Batch state
  const [batchTargets, setBatchTargets] = useState<string[]>(["", ""]);
  const [batchValues, setBatchValues] = useState<string[]>(["0", "0"]);

  // Nonce state
  const [nonceKeys, setNonceKeys] = useState<{ key: bigint; nonce: bigint }[]>(
    []
  );

  // Deposit state
  const [depositAmount, setDepositAmount] = useState("0.001");

  const logRef = useRef<HTMLDivElement>(null);

  const addLog = useCallback(
    (msg: string, type: Log["type"] = "info") => {
      const time = new Date().toLocaleTimeString();
      setLogs((prev) => [...prev, { time, msg, type }]);
    },
    []
  );

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

  const refreshBalances = useCallback(async () => {
    if (!address || !publicClient) return;
    try {
      const bal = await publicClient.getBalance({ address });
      setEoaBalance(formatEther(bal));

      const saAddr = await publicClient.readContract({
        address: SIMPLE_ACCOUNT_FACTORY,
        abi: factoryAbi,
        functionName: "getAddress",
        args: [address, 0n],
      });
      setSmartAccountAddress(saAddr as string);

      const code = await publicClient.getCode({
        address: saAddr as `0x${string}`,
      });
      const deployed = !!code && code !== "0x";
      setIsDeployed(deployed);

      const saBal = await publicClient.getBalance({
        address: saAddr as `0x${string}`,
      });
      setSaBalance(formatEther(saBal));

      const dep = await publicClient.readContract({
        address: ENTRY_POINT,
        abi: entryPointAbi,
        functionName: "balanceOf",
        args: [saAddr as Address],
      });
      setEpDeposit(formatEther(dep as bigint));
    } catch {
      // Factory 可能未部署
    }
  }, [address, publicClient]);

  useEffect(() => {
    refreshBalances();
  }, [refreshBalances]);

  const handleConnect = () => {
    connect({ connector: injected() });
  };

  // ─── 通用：构建并发送 UserOp ─────────────────────────────────────

  const buildAndSendUserOp = async (
    callData: `0x${string}`,
    description: string,
    nonceKey: bigint = 0n
  ) => {
    if (!walletClient || !publicClient || !address || !smartAccountAddress)
      return;

    addLog(`获取 nonce (key=${nonceKey})...`, "step");
    const nonce = await publicClient.readContract({
      address: ENTRY_POINT,
      abi: entryPointAbi,
      functionName: "getNonce",
      args: [smartAccountAddress as Address, nonceKey],
    });
    addLog(`   Nonce: ${nonce}`, "info");

    const code = await publicClient.getCode({
      address: smartAccountAddress as Address,
    });
    const needsDeploy = !code || code === "0x";
    let initCode: `0x${string}` = "0x";
    if (needsDeploy) {
      addLog("Smart Account 未部署，initCode 包含 Factory 调用", "step");
      const factoryCallData = encodeFunctionData({
        abi: factoryAbi,
        functionName: "createAccount",
        args: [address, 0n],
      });
      initCode = concat([
        SIMPLE_ACCOUNT_FACTORY,
        factoryCallData,
      ]) as `0x${string}`;
    }

    const gasPrice = await publicClient.getGasPrice();
    addLog(
      `Gas Price: ${(Number(gasPrice) / 1e9).toFixed(4)} Gwei`,
      "info"
    );

    const userOp = {
      sender: smartAccountAddress as Address,
      nonce,
      initCode,
      callData,
      callGasLimit: 300000n,
      verificationGasLimit: needsDeploy ? 500000n : 200000n,
      preVerificationGas: 60000n,
      maxFeePerGas: gasPrice * 2n,
      maxPriorityFeePerGas: gasPrice,
      paymasterAndData: "0x" as `0x${string}`,
      signature: "0x" as `0x${string}`,
    };

    addLog("计算 UserOp Hash 并签名...", "step");
    const userOpHash = (await publicClient.readContract({
      address: ENTRY_POINT,
      abi: entryPointAbi,
      functionName: "getUserOpHash",
      args: [userOp],
    })) as `0x${string}`;
    addLog(`UserOp Hash: ${userOpHash.slice(0, 18)}...`, "info");

    const signature = await walletClient.signMessage({
      message: { raw: userOpHash },
    });
    userOp.signature = signature;
    addLog("MetaMask 签名完成", "success");

    addLog(`提交到 EntryPoint: ${description}`, "step");
    const hash = await walletClient.writeContract({
      address: ENTRY_POINT,
      abi: entryPointAbi,
      functionName: "handleOps",
      args: [[userOp], address],
      chain: morphHoodi,
      gas: 2000000n,
    });

    addLog(`Tx Hash: ${hash}`, "info");
    addLog("等待确认...", "info");

    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    if (receipt.status === "success") {
      addLog(
        `交易成功! Block #${receipt.blockNumber}, Gas: ${receipt.gasUsed}`,
        "success"
      );
      setTxHash(hash);
      if (needsDeploy) {
        setIsDeployed(true);
        addLog("Smart Account 已在链上部署!", "success");
      }
    } else {
      addLog("交易失败", "error");
    }

    await refreshBalances();
    return receipt;
  };

  // ─── Handlers ────────────────────────────────────────────────────

  const handleSendUserOp = async () => {
    if (!address) return;
    setLoading(true);
    try {
      addLog("=== 发送基础 UserOp (execute: 0 ETH → EOA) ===", "step");
      const callData = encodeFunctionData({
        abi: simpleAccountAbi,
        functionName: "execute",
        args: [address, 0n, "0x"],
      });
      await buildAndSendUserOp(callData, "基础 execute 调用");
    } catch (err) {
      const msg = (err as Error).message;
      addLog(`错误: ${msg.slice(0, 200)}`, "error");
      if (msg.includes("AA21"))
        addLog("Smart Account ETH 不足，请先充值", "error");
      else if (msg.includes("AA25"))
        addLog("签名验证失败", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSendBatch = async () => {
    if (!address) return;
    setLoading(true);
    try {
      const validTargets = batchTargets.filter(
        (t) => t && t.startsWith("0x") && t.length === 42
      );
      if (validTargets.length < 2) {
        addLog("至少需要 2 个有效目标地址", "error");
        return;
      }

      addLog(
        `=== Batch Transaction: ${validTargets.length} 笔调用合并为一个 UserOp ===`,
        "step"
      );

      const destinations = validTargets.map((t) => t as Address);
      const funcs = validTargets.map(() => "0x" as `0x${string}`);

      const callData = encodeFunctionData({
        abi: simpleAccountAbi,
        functionName: "executeBatch",
        args: [destinations, funcs],
      });

      addLog(
        `目标: ${destinations.map((d) => d.slice(0, 8) + "...").join(", ")}`,
        "info"
      );
      addLog(
        `每笔转账: ${batchValues.slice(0, validTargets.length).join(", ")} ETH`,
        "info"
      );

      await buildAndSendUserOp(
        callData,
        `executeBatch (${validTargets.length} calls)`
      );
    } catch (err) {
      addLog(`Batch 错误: ${(err as Error).message.slice(0, 200)}`, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleFetchNonces = async () => {
    if (!publicClient || !smartAccountAddress) return;
    setLoading(true);
    try {
      addLog("=== 查询 Nonce Channels ===", "step");
      const keys = [0n, 1n, 2n, 3n, 4n];
      const results: { key: bigint; nonce: bigint }[] = [];

      for (const key of keys) {
        const nonce = await publicClient.readContract({
          address: ENTRY_POINT,
          abi: entryPointAbi,
          functionName: "getNonce",
          args: [smartAccountAddress as Address, key],
        });
        results.push({ key, nonce: nonce as bigint });
        addLog(`   Channel ${key}: nonce = ${nonce}`, "info");
      }
      setNonceKeys(results);

      addLog("", "info");
      addLog("Nonce 结构: uint256 = (key << 64) | seq", "info");
      addLog("不同 key 的 nonce 互不影响，可以并行发 UserOp", "info");
    } catch (err) {
      addLog(
        `Nonce 查询错误: ${(err as Error).message.slice(0, 200)}`,
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSendWithNonceKey = async (nonceKey: bigint) => {
    if (!address) return;
    setLoading(true);
    try {
      addLog(`=== 使用 Nonce Channel ${nonceKey} 发送 UserOp ===`, "step");
      const callData = encodeFunctionData({
        abi: simpleAccountAbi,
        functionName: "execute",
        args: [address, 0n, "0x"],
      });
      await buildAndSendUserOp(
        callData,
        `execute via nonce channel ${nonceKey}`,
        nonceKey
      );
    } catch (err) {
      addLog(`错误: ${(err as Error).message.slice(0, 200)}`, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDeposit = async () => {
    if (!walletClient || !smartAccountAddress) return;
    setLoading(true);
    try {
      const amount = parseEther(depositAmount);
      addLog(
        `=== 向 EntryPoint 预存 ${depositAmount} ETH ===`,
        "step"
      );
      addLog("EntryPoint.depositTo() — 预存 gas 资金", "info");

      const hash = await walletClient.writeContract({
        address: ENTRY_POINT,
        abi: entryPointAbi,
        functionName: "depositTo",
        args: [smartAccountAddress as Address],
        chain: morphHoodi,
        value: amount,
      });

      addLog(`Tx: ${hash}`, "info");
      addLog("等待确认...", "info");
      await publicClient!.waitForTransactionReceipt({ hash });
      addLog("Deposit 完成!", "success");
      await refreshBalances();
    } catch (err) {
      addLog(
        `Deposit 错误: ${(err as Error).message.slice(0, 200)}`,
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleFundSA = async () => {
    if (!walletClient || !smartAccountAddress) return;
    setLoading(true);
    addLog("向 Smart Account 转入 0.005 ETH...", "step");

    try {
      const hash = await walletClient.sendTransaction({
        to: smartAccountAddress as Address,
        value: parseEther("0.005"),
        chain: morphHoodi,
      });
      addLog(`充值 tx: ${hash}`, "info");
      addLog("等待确认...", "info");
      await publicClient!.waitForTransactionReceipt({ hash });
      addLog("充值完成!", "success");
      await refreshBalances();
    } catch (err) {
      addLog(`充值失败: ${(err as Error).message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  const explorerUrl = morphHoodi.blockExplorers.default.url;

  const tabs: { id: Tab; label: string; desc: string }[] = [
    { id: "userop", label: "UserOp", desc: "Send a single UserOperation" },
    { id: "batch", label: "Batch", desc: "Multiple calls in one UserOp" },
    {
      id: "nonce",
      label: "Nonce",
      desc: "Parallel nonce channels for concurrent UserOps",
    },
    {
      id: "deposit",
      label: "Deposit",
      desc: "Pre-fund gas at EntryPoint",
    },
  ];

  const logColor = (type: Log["type"]) => {
    switch (type) {
      case "success":
        return "var(--green)";
      case "error":
        return "var(--red)";
      case "step":
        return "var(--gold)";
      default:
        return "var(--text-muted)";
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* ── Header ── */}
      <div className="mb-10 animate-fade-up">
        <h1
          className="text-4xl mb-2"
          style={{
            fontFamily: "var(--font-display)",
            color: "var(--text-primary)",
            letterSpacing: "-0.02em",
          }}
        >
          Agent Wallet
        </h1>
        <p
          className="text-sm"
          style={{
            fontFamily: "var(--font-geist-mono), monospace",
            color: "var(--text-muted)",
          }}
        >
          ERC-4337 &middot; Morph Hoodi &middot; Self-Bundled
        </p>
      </div>

      {/* ── Flow Diagram ── */}
      <div className="card p-4 mb-6 animate-fade-up stagger-1">
        <Label>Pipeline</Label>
        <div className="mt-2">
          <FlowDiagram loading={loading} />
        </div>
        <div
          className="mt-3 text-[10px] flex gap-4"
          style={{
            fontFamily: "var(--font-geist-mono), monospace",
            color: "var(--text-muted)",
          }}
        >
          <span>EntryPoint v0.6.0</span>
          <span>No Paymaster</span>
          <span>No Bundler</span>
        </div>
      </div>

      {/* ── Connect Wallet ── */}
      <div className="card p-5 mb-4 animate-fade-up stagger-2">
        <div className="flex items-start justify-between">
          <div>
            <Label>Wallet</Label>
            {isConnected ? (
              <div className="mt-2">
                <p
                  className="text-sm"
                  style={{
                    fontFamily: "var(--font-geist-mono), monospace",
                    color: "var(--text-primary)",
                  }}
                >
                  {address?.slice(0, 6)}
                  <span style={{ color: "var(--text-muted)" }}>
                    ...{address?.slice(-4)}
                  </span>
                </p>
                <p
                  className="text-xs mt-1"
                  style={{
                    fontFamily: "var(--font-geist-mono), monospace",
                    color: "var(--text-secondary)",
                  }}
                >
                  {eoaBalance} ETH
                </p>
              </div>
            ) : (
              <p
                className="text-sm mt-2"
                style={{ color: "var(--text-muted)" }}
              >
                Connect to begin
              </p>
            )}
          </div>
          {isConnected ? (
            <button
              onClick={() => {
                disconnect();
                setSmartAccountAddress("");
                setLogs([]);
                setTxHash("");
                setNonceKeys([]);
              }}
              className="btn-secondary"
            >
              Disconnect
            </button>
          ) : (
            <button onClick={handleConnect} className="btn-primary">
              Connect
            </button>
          )}
        </div>
      </div>

      {/* ── Smart Account ── */}
      {smartAccountAddress && (
        <div className="card card-gold p-5 mb-6 animate-fade-up stagger-3">
          <Label>Smart Account</Label>

          <a
            href={`${explorerUrl}/address/${smartAccountAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block mt-2 text-sm hover:opacity-80 transition-opacity"
            style={{
              fontFamily: "var(--font-geist-mono), monospace",
              color: "var(--gold)",
            }}
          >
            {smartAccountAddress}
          </a>

          <div className="grid grid-cols-3 gap-4 mt-4">
            <Stat label="Balance" value={`${saBalance} ETH`} />
            <Stat label="EP Deposit" value={`${epDeposit} ETH`} />
            <Stat
              label="Status"
              value={isDeployed ? "Deployed" : "Not deployed"}
              accent={!isDeployed}
            />
          </div>

          <div
            className="mt-3 text-[10px]"
            style={{
              fontFamily: "var(--font-geist-mono), monospace",
              color: "var(--text-muted)",
            }}
          >
            CREATE2 &middot; salt: 0 &middot; owner:{" "}
            {address?.slice(0, 8)}...
          </div>

          {Number(saBalance) < 0.001 && (
            <button
              onClick={handleFundSA}
              disabled={loading || Number(eoaBalance) < 0.006}
              className="btn-primary mt-4"
            >
              {loading ? "Processing..." : "Fund 0.005 ETH"}
            </button>
          )}
        </div>
      )}

      {/* ── Tabs ── */}
      {smartAccountAddress && (
        <>
          <div
            className="flex gap-0 mb-px animate-fade-up stagger-4"
            style={{ borderBottom: "1px solid var(--border-dim)" }}
          >
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-xs tracking-wider uppercase transition-colors ${
                  activeTab === tab.id ? "tab-active" : ""
                }`}
                style={{
                  fontFamily: "var(--font-geist-mono), monospace",
                  color:
                    activeTab === tab.id
                      ? "var(--gold)"
                      : "var(--text-muted)",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="card p-5 mb-6 animate-fade-in" style={{ borderTop: "none" }}>
            <p
              className="text-xs mb-5"
              style={{ color: "var(--text-muted)" }}
            >
              {tabs.find((t) => t.id === activeTab)?.desc}
            </p>

            {/* ── UserOp ── */}
            {activeTab === "userop" && (
              <div>
                <p
                  className="text-sm mb-4"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Execute a 0 ETH transfer to your EOA. The Smart Account pays
                  gas, and your EOA acts as the Bundler by calling
                  handleOps() directly.
                </p>
                <button
                  onClick={handleSendUserOp}
                  disabled={loading || Number(saBalance) < 0.001}
                  className="btn-primary"
                >
                  {loading ? "Processing..." : "Send UserOp"}
                </button>
              </div>
            )}

            {/* ── Batch ── */}
            {activeTab === "batch" && (
              <div>
                <div className="space-y-2 mb-4">
                  {batchTargets.map((target, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        type="text"
                        placeholder={`Target ${i + 1} (0x...)`}
                        value={target}
                        onChange={(e) => {
                          const next = [...batchTargets];
                          next[i] = e.target.value;
                          setBatchTargets(next);
                        }}
                        className="input-field flex-1"
                      />
                      <input
                        type="text"
                        placeholder="ETH"
                        value={batchValues[i] || "0"}
                        onChange={(e) => {
                          const next = [...batchValues];
                          next[i] = e.target.value;
                          setBatchValues(next);
                        }}
                        className="input-field w-20"
                      />
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setBatchTargets((prev) => [...prev, ""]);
                      setBatchValues((prev) => [...prev, "0"]);
                    }}
                    className="btn-secondary"
                  >
                    + Add
                  </button>
                  <button
                    onClick={handleSendBatch}
                    disabled={loading || Number(saBalance) < 0.001}
                    className="btn-primary"
                  >
                    {loading ? "Processing..." : "Send Batch"}
                  </button>
                </div>
                <p
                  className="text-[11px] mt-4"
                  style={{
                    color: "var(--text-muted)",
                    fontFamily: "var(--font-geist-mono), monospace",
                  }}
                >
                  executeBatch(address[], bytes[]) — atomic, all-or-nothing
                </p>
              </div>
            )}

            {/* ── Nonce ── */}
            {activeTab === "nonce" && (
              <div>
                <button
                  onClick={handleFetchNonces}
                  disabled={loading}
                  className="btn-primary mb-4"
                >
                  {loading ? "Loading..." : "Query Channels"}
                </button>

                {nonceKeys.length > 0 && (
                  <div className="space-y-1">
                    {nonceKeys.map((nk) => (
                      <div
                        key={Number(nk.key)}
                        className="flex items-center justify-between p-3"
                        style={{
                          background: "var(--bg-deep)",
                          border: "1px solid var(--border-dim)",
                        }}
                      >
                        <div>
                          <Mono>
                            <span style={{ color: "var(--text-primary)" }}>
                              Ch.{nk.key.toString()}
                            </span>
                          </Mono>
                          <Mono>
                            <span
                              className="ml-3 text-xs"
                              style={{ color: "var(--text-muted)" }}
                            >
                              seq={nk.nonce.toString()}
                            </span>
                          </Mono>
                        </div>
                        <button
                          onClick={() => handleSendWithNonceKey(nk.key)}
                          disabled={loading || Number(saBalance) < 0.001}
                          className="btn-secondary text-xs px-3 py-1"
                        >
                          Send
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <p
                  className="text-[11px] mt-4"
                  style={{
                    color: "var(--text-muted)",
                    fontFamily: "var(--font-geist-mono), monospace",
                  }}
                >
                  nonce = (key &lt;&lt; 64) | seq — parallel channels for
                  concurrent ops
                </p>
              </div>
            )}

            {/* ── Deposit ── */}
            {activeTab === "deposit" && (
              <div>
                <div
                  className="p-4 mb-4"
                  style={{
                    background: "var(--bg-deep)",
                    border: "1px solid var(--border-dim)",
                  }}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <Label>Current Deposit</Label>
                    <span
                      className="text-sm"
                      style={{
                        fontFamily: "var(--font-geist-mono), monospace",
                        color: "var(--gold)",
                      }}
                    >
                      {epDeposit} ETH
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      className="input-field w-28"
                    />
                    <span
                      className="py-2 text-xs"
                      style={{ color: "var(--text-muted)" }}
                    >
                      ETH
                    </span>
                    <button
                      onClick={handleDeposit}
                      disabled={loading}
                      className="btn-primary"
                    >
                      {loading ? "Processing..." : "Deposit"}
                    </button>
                  </div>
                </div>
                <p
                  className="text-[11px]"
                  style={{
                    color: "var(--text-muted)",
                    fontFamily: "var(--font-geist-mono), monospace",
                  }}
                >
                  EntryPoint.depositTo() — pre-fund gas for your Smart Account
                </p>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Tx Hash ── */}
      {txHash && (
        <div
          className="mb-6 p-3 animate-fade-in"
          style={{
            background: "var(--green-dim)",
            border: "1px solid #2d4a2d",
          }}
        >
          <span
            className="text-xs"
            style={{ color: "var(--green)" }}
          >
            Latest:{" "}
          </span>
          <a
            href={`${explorerUrl}/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs break-all hover:opacity-80 transition-opacity"
            style={{
              fontFamily: "var(--font-geist-mono), monospace",
              color: "var(--green)",
            }}
          >
            {txHash.slice(0, 22)}...{txHash.slice(-6)}
          </a>
        </div>
      )}

      {/* ── Terminal Console ── */}
      {logs.length > 0 && (
        <div className="terminal p-4 animate-fade-in">
          <div className="flex items-center justify-between mb-3 relative z-10">
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ background: "var(--red)" }}
                />
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ background: "var(--gold)" }}
                />
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ background: "var(--green)" }}
                />
              </div>
              <span
                className="text-[10px] tracking-wider uppercase ml-2"
                style={{ color: "var(--text-muted)" }}
              >
                console
              </span>
            </div>
            <button
              onClick={() => setLogs([])}
              className="text-[10px] tracking-wider uppercase transition-colors"
              style={{ color: "var(--text-muted)" }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.color = "var(--text-secondary)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.color = "var(--text-muted)")
              }
            >
              Clear
            </button>
          </div>
          <div
            ref={logRef}
            className="space-y-0.5 max-h-72 overflow-y-auto relative z-10"
            style={{ fontFamily: "var(--font-geist-mono), monospace" }}
          >
            {logs.map((log, i) => (
              <div key={i} className="flex gap-3 text-[11px] leading-relaxed">
                <span
                  className="shrink-0"
                  style={{ color: "var(--text-muted)", opacity: 0.5 }}
                >
                  {log.time}
                </span>
                <span style={{ color: logColor(log.type) }}>{log.msg}</span>
              </div>
            ))}
            <div className="terminal-cursor text-[11px]">&nbsp;</div>
          </div>
        </div>
      )}

      {/* ── Footer ── */}
      <div
        className="mt-10 pb-8 flex items-center justify-between"
        style={{
          borderTop: "1px solid var(--border-dim)",
          paddingTop: "1rem",
        }}
      >
        <div
          className="text-[10px] space-y-1"
          style={{
            fontFamily: "var(--font-geist-mono), monospace",
            color: "var(--text-muted)",
          }}
        >
          <p>
            <a
              href={`${explorerUrl}/address/${ENTRY_POINT}`}
              target="_blank"
              className="hover:opacity-70 transition-opacity"
            >
              EntryPoint {ENTRY_POINT.slice(0, 8)}...{ENTRY_POINT.slice(-4)}
            </a>
          </p>
          <p>
            <a
              href={`${explorerUrl}/address/${SIMPLE_ACCOUNT_FACTORY}`}
              target="_blank"
              className="hover:opacity-70 transition-opacity"
            >
              Factory {SIMPLE_ACCOUNT_FACTORY.slice(0, 8)}...
              {SIMPLE_ACCOUNT_FACTORY.slice(-4)}
            </a>
          </p>
        </div>
        <div
          className="text-[10px] text-right"
          style={{
            fontFamily: "var(--font-geist-mono), monospace",
            color: "var(--text-muted)",
          }}
        >
          <p>Morph Hoodi</p>
          <p>Chain 2910</p>
        </div>
      </div>
    </div>
  );
}
