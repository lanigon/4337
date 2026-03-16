"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useSwitchChain,
  useWalletClient,
  usePublicClient,
  useSendTransaction,
} from "wagmi";
import { injected } from "wagmi/connectors";
import { formatEther, parseEther } from "viem";
import {
  createSmartAccountClient,
  createSession,
  createSessionKeyEOA,
  createSessionSmartAccountClient,
  getSingleSessionTxParams,
  PaymasterMode,
  type BiconomySmartAccountV2,
  type Policy,
  type SessionLocalStorage,
} from "@biconomy/account";
import { morph } from "@/lib/wagmi";
import {
  BUNDLER_URL,
  PAYMASTER_API_KEY,
  CONTRACTS,
  KNOWN_CONTRACTS,
  MORPH_CHAIN_ID,
} from "@/lib/contracts";

// ── Types ──────────────────────────────────────────────────

interface Log {
  time: string;
  msg: string;
  type: "info" | "success" | "error" | "warn";
}

interface SessionInfo {
  id: string;
  sessionKeyAddress: string;
  contractAddress: string;
  functionSelector: string;
  validUntil: number;
  createdAt: number;
  status: "active" | "expired";
}

type Tab = "setup" | "sessions" | "agent" | "security";

// ── Helpers ────────────────────────────────────────────────

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatCountdown(until: number): string {
  const diff = until * 1000 - Date.now();
  if (diff <= 0) return "Expired";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

const EXPIRY_OPTIONS = [
  { label: "1 hour", hours: 1 },
  { label: "6 hours", hours: 6 },
  { label: "24 hours", hours: 24 },
  { label: "7 days", hours: 168 },
];

// Session key target options (without ERC-8004)
const SESSION_TARGETS = [
  {
    label: "Self-transfer (test)",
    contract: "self", // will use SA address
    fn: "execute(address,uint256,bytes)",
    description: "Transfer ETH from Smart Account",
  },
];

// ── Component ──────────────────────────────────────────────

export function AgentWalletSession() {
  const { address, isConnected, chainId } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const { data: walletClient, isLoading: walletClientLoading } =
    useWalletClient();
  const publicClient = usePublicClient();
  const { sendTransactionAsync } = useSendTransaction();

  const wrongChain = isConnected && chainId !== MORPH_CHAIN_ID;

  // Keep a ref to walletClient so async functions can read the latest value
  const walletClientRef = useRef(walletClient);
  useEffect(() => {
    walletClientRef.current = walletClient;
  }, [walletClient]);

  const handleSwitchToMorph = () => {
    switchChain({ chainId: MORPH_CHAIN_ID });
    addLog(`Switching to Morph Mainnet (${MORPH_CHAIN_ID})...`);
  };

  // Core state
  const [tab, setTab] = useState<Tab>("setup");
  const [logs, setLogs] = useState<Log[]>([]);
  const [smartAccount, setSmartAccount] =
    useState<BiconomySmartAccountV2 | null>(null);
  const [saAddress, setSaAddress] = useState("");
  const [saBalance, setSaBalance] = useState("0");
  const [loading, setLoading] = useState(false);

  // Session state — keep full session data so Agent can resume without localStorage
  const sessionStorageRef = useRef<SessionLocalStorage | null>(null);
  const sessionIdsRef = useRef<string[]>([]);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [formExpiry, setFormExpiry] = useState(24);
  const [formContract, setFormContract] = useState<string>("");
  const [formFunction, setFormFunction] = useState<string>(
    "execute(address,uint256,bytes)"
  );

  // Agent state
  const [selectedSessionIdx, setSelectedSessionIdx] = useState(0);
  const [agentTarget, setAgentTarget] = useState("");
  const [agentValue, setAgentValue] = useState("0");

  const consoleRef = useRef<HTMLDivElement>(null);

  // ── Logging ────────────────────────────────────────────

  const addLog = useCallback((msg: string, type: Log["type"] = "info") => {
    const time = new Date().toLocaleTimeString("en-US", { hour12: false });
    setLogs((prev) => [...prev, { time, msg, type }]);
  }, []);

  useEffect(() => {
    consoleRef.current?.scrollTo(0, consoleRef.current.scrollHeight);
  }, [logs]);

  // ── Tick for countdown ─────────────────────────────────

  const [, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => {
      setSessions((prev) =>
        prev.map((s) =>
          s.status === "active" && Date.now() > s.validUntil * 1000
            ? { ...s, status: "expired" }
            : s
        )
      );
      setTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  // ── Balance refresh ────────────────────────────────────

  const refreshBalance = useCallback(async () => {
    if (!publicClient || !saAddress) return;
    try {
      const bal = await publicClient.getBalance({
        address: saAddress as `0x${string}`,
      });
      setSaBalance(formatEther(bal));
    } catch {
      // ignore
    }
  }, [publicClient, saAddress]);

  useEffect(() => {
    if (saAddress) refreshBalance();
  }, [saAddress, refreshBalance]);

  // ── Smart Account ──────────────────────────────────────

  const handleCreateSmartAccount = async () => {
    // walletClient may not be ready immediately after connect.
    // Wait up to 5 seconds for it to become available.
    let wc = walletClient;
    if (!wc) {
      addLog("Waiting for wallet client...");
      for (let i = 0; i < 10; i++) {
        await new Promise((r) => setTimeout(r, 500));
        // Re-read from the ref we'll set below
        wc = walletClientRef.current;
        if (wc) break;
      }
    }
    if (!wc) {
      addLog(
        "Wallet client not available. Try disconnecting and reconnecting.",
        "error"
      );
      return;
    }
    setLoading(true);
    addLog("Creating Biconomy Smart Account...");

    try {
      const opts: Record<string, unknown> = {
        signer: wc,
        bundlerUrl: BUNDLER_URL,
        chainId: MORPH_CHAIN_ID,
      };
      if (PAYMASTER_API_KEY) {
        opts.biconomyPaymasterApiKey = PAYMASTER_API_KEY;
        addLog("Paymaster enabled (gasless mode)");
      } else {
        addLog("No Paymaster — Smart Account pays gas in ETH", "warn");
      }

      const account = await createSmartAccountClient(
        opts as Parameters<typeof createSmartAccountClient>[0]
      );
      const addr = await account.getAccountAddress();

      setSmartAccount(account);
      setSaAddress(addr);
      setFormContract(addr); // default session target = self

      addLog(`Smart Account: ${addr}`, "success");
      addLog(`EntryPoint: ${shortAddr(CONTRACTS.ENTRYPOINT)}`);
      addLog(`Network: Morph Mainnet (${MORPH_CHAIN_ID})`);

      if (publicClient) {
        const bal = await publicClient.getBalance({
          address: addr as `0x${string}`,
        });
        const ethBal = formatEther(bal);
        setSaBalance(ethBal);
        if (bal === 0n && !PAYMASTER_API_KEY) {
          addLog(
            `Balance: 0 ETH — fund your Smart Account to send transactions`,
            "warn"
          );
        } else {
          addLog(`Balance: ${parseFloat(ethBal).toFixed(6)} ETH`);
        }
      }
    } catch (err) {
      addLog(`Error: ${(err as Error).message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleFundAccount = async () => {
    if (!saAddress) return;
    setLoading(true);
    addLog(`Sending 0.001 ETH from EOA to Smart Account...`);
    try {
      const hash = await sendTransactionAsync({
        to: saAddress as `0x${string}`,
        value: parseEther("0.001"),
      });
      addLog(`Funding tx: ${shortAddr(hash)}`, "success");
      addLog("Waiting for confirmation...");
      await publicClient?.waitForTransactionReceipt({ hash });
      addLog("Funded!", "success");
      await refreshBalance();
    } catch (err) {
      addLog(`Error: ${(err as Error).message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  // ── Session Keys ───────────────────────────────────────

  const handleCreateSession = async () => {
    if (!smartAccount) {
      addLog("Create Smart Account first", "error");
      return;
    }
    setLoading(true);
    addLog("Creating Session Key...");

    try {
      const { sessionKeyAddress, sessionStorageClient } =
        await createSessionKeyEOA(smartAccount, morph);
      sessionStorageRef.current = sessionStorageClient as SessionLocalStorage;
      addLog(`Session Key: ${shortAddr(sessionKeyAddress)}`);

      const validUntil = Math.floor(Date.now() / 1000) + formExpiry * 3600;
      const targetContract =
        formContract === "" || formContract === "self"
          ? saAddress
          : formContract;

      const policy: Policy[] = [
        {
          sessionKeyAddress: sessionKeyAddress as `0x${string}`,
          contractAddress: targetContract as `0x${string}`,
          functionSelector: formFunction,
          rules: [],
          interval: { validUntil, validAfter: 0 },
          valueLimit: BigInt(0),
        },
      ];

      addLog(`Policy: ${formFunction.split("(")[0]}() on ${shortAddr(targetContract)}`);
      addLog(`Expires: ${new Date(validUntil * 1000).toLocaleString()}`);
      addLog("Submitting UserOp to enable session on-chain...");

      const paymasterOpts = PAYMASTER_API_KEY
        ? { paymasterServiceData: { mode: PaymasterMode.SPONSORED } }
        : undefined;

      const sessionResult = await createSession(
        smartAccount,
        policy,
        sessionStorageClient as SessionLocalStorage,
        paymasterOpts
      );

      const txHash = (sessionResult as Record<string, unknown>)
        .transactionHash as string | undefined;
      addLog(
        `Session created on-chain!${txHash ? ` Tx: ${shortAddr(txHash)}` : ""}`,
        "success"
      );

      // Save session IDs for agent execution
      try {
        const leafArray = await (sessionStorageClient as SessionLocalStorage).getAllSessionData();
        const ids = leafArray
          .map((leaf: Record<string, unknown>) => leaf.sessionID as string)
          .filter(Boolean);
        sessionIdsRef.current = ids;
        addLog(`Session IDs stored: ${ids.length}`);
      } catch {
        addLog("Warning: could not read session IDs from storage", "warn");
      }

      const sessionInfo: SessionInfo = {
        id: `sk-${Date.now().toString(36)}`,
        sessionKeyAddress,
        contractAddress: targetContract,
        functionSelector: formFunction,
        validUntil,
        createdAt: Math.floor(Date.now() / 1000),
        status: "active",
      };
      setSessions((prev) => [...prev, sessionInfo]);
      addLog("Session stored in browser localStorage");
      await refreshBalance();
    } catch (err) {
      addLog(`Error: ${(err as Error).message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  // ── Agent Execute via Session Key ──────────────────────

  const handleAgentExecute = async () => {
    const session = sessions[selectedSessionIdx];
    if (!session || !smartAccount) {
      addLog("No session or smart account", "error");
      return;
    }
    if (session.status !== "active") {
      addLog("Session is not active", "error");
      return;
    }

    setLoading(true);
    addLog(
      `[Agent] Executing via session key ${shortAddr(session.sessionKeyAddress)}...`
    );

    try {
      const to = (agentTarget || session.contractAddress) as `0x${string}`;
      const value = parseEther(agentValue || "0");

      addLog(`[Agent] Target: ${shortAddr(to)}, Value: ${agentValue} ETH`);
      addLog("[Agent] Creating session-based smart account client...");

      // Build full session object so resumeSession() skips localStorage lookup
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let sessionParam: any;
      if (sessionStorageRef.current && sessionIdsRef.current.length > 0) {
        sessionParam = {
          sessionIDInfo: sessionIdsRef.current,
          sessionStorageClient: sessionStorageRef.current,
        };
        addLog(`[Agent] Using stored session (${sessionIdsRef.current.length} IDs)`);
      } else {
        // Fallback: try address-based lookup
        sessionParam = saAddress as `0x${string}`;
        addLog("[Agent] Falling back to address-based session lookup", "warn");
      }

      const sessionSmartAccount = await createSessionSmartAccountClient(
        {
          accountAddress: saAddress as `0x${string}`,
          bundlerUrl: BUNDLER_URL,
          chainId: MORPH_CHAIN_ID,
        },
        sessionParam
      );

      const txParams = await getSingleSessionTxParams(
        session.sessionKeyAddress as `0x${string}`,
        morph as Parameters<typeof getSingleSessionTxParams>[1],
        0
      );

      addLog("[Agent] Signing with session key (no user approval needed)...");

      const userOpResponse = await sessionSmartAccount.sendTransaction(
        { to, data: "0x" as `0x${string}`, value },
        txParams
      );

      addLog("[Agent] UserOp submitted, waiting for confirmation...");
      const receipt = await userOpResponse.wait();
      addLog(
        `[Agent] Transaction confirmed! Tx: ${shortAddr(receipt.receipt.transactionHash)}`,
        "success"
      );
      await refreshBalance();
    } catch (err) {
      addLog(`[Agent] Error: ${(err as Error).message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  // ── Tab Helpers ────────────────────────────────────────

  const activeSessions = sessions.filter((s) => s.status === "active");

  const tabs: { key: Tab; label: string }[] = [
    { key: "setup", label: "Setup" },
    { key: "sessions", label: "Sessions" },
    { key: "agent", label: "Agent" },
    { key: "security", label: "Security" },
  ];

  // ── Render ─────────────────────────────────────────────

  return (
    <div className="animate-fade-up">
      {/* Header */}
      <div className="mb-8">
        <h1
          className="text-3xl font-semibold tracking-tight"
          style={{ color: "var(--text-primary)" }}
        >
          Agent Wallet
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
          ERC-4337 Smart Account + Session Keys on Morph L2
        </p>

        {/* Architecture flow */}
        <div className="flex items-center gap-0 mt-5 overflow-x-auto pb-2">
          {[
            "Owner EOA",
            "Smart Account",
            "Session Key",
            "Agent",
            "EntryPoint",
            "Morph L2",
          ].map((node, i, arr) => (
            <div key={node} className="flex items-center shrink-0">
              <div className={`flow-node rounded ${i === 3 ? "active" : ""}`}>
                {node}
              </div>
              {i < arr.length - 1 && (
                <div className="flow-connector w-6 shrink-0" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Tab bar */}
      <div
        className="flex gap-0 mb-6 overflow-x-auto"
        style={{ borderBottom: "1px solid var(--border-dim)" }}
      >
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm transition-colors shrink-0 ${
              tab === t.key ? "tab-active" : ""
            }`}
            style={{
              color: tab === t.key ? "var(--gold)" : "var(--text-muted)",
              background: "transparent",
              border: "none",
              cursor: "pointer",
            }}
          >
            {t.label}
            {t.key === "sessions" && activeSessions.length > 0 && (
              <span
                className="ml-1.5 text-xs px-1.5 py-0.5 rounded-full"
                style={{
                  background: "var(--bg-elevated)",
                  color: "var(--gold)",
                }}
              >
                {activeSessions.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="min-h-[400px]">
        {/* ── SETUP ────────────────────────────── */}
        {tab === "setup" && (
          <div className="space-y-4 animate-fade-in">
            {/* Connect */}
            <div className="card rounded-lg p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p
                    className="text-xs uppercase tracking-wider mb-1"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Step 1
                  </p>
                  <h3
                    className="text-lg font-medium"
                    style={{ color: "var(--text-primary)" }}
                  >
                    Connect Owner Wallet
                  </h3>
                  {isConnected && address && (
                    <p
                      className="text-sm mt-1 font-mono"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {shortAddr(address)}
                      {wrongChain && (
                        <span style={{ color: "var(--red)" }}>
                          {" "}
                          (chain {chainId})
                        </span>
                      )}
                    </p>
                  )}
                </div>
                {isConnected ? (
                  <div className="flex gap-2">
                    {wrongChain && (
                      <button
                        onClick={handleSwitchToMorph}
                        className="btn-primary rounded-lg"
                      >
                        Switch to Morph
                      </button>
                    )}
                    <button
                      onClick={() => {
                        disconnect();
                        setSmartAccount(null);
                        setSaAddress("");
                        setSessions([]);
                        setLogs([]);
                      }}
                      className="btn-secondary rounded-lg"
                    >
                      Disconnect
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      connect({ connector: injected() });
                      addLog("Connecting wallet...");
                    }}
                    className="btn-primary rounded-lg"
                  >
                    Connect MetaMask
                  </button>
                )}
              </div>
            </div>

            {/* Smart Account */}
            {isConnected && (
              <div className="card rounded-lg p-5 animate-fade-in stagger-1">
                <p
                  className="text-xs uppercase tracking-wider mb-1"
                  style={{ color: "var(--text-muted)" }}
                >
                  Step 2
                </p>
                <h3
                  className="text-lg font-medium mb-3"
                  style={{ color: "var(--text-primary)" }}
                >
                  Smart Account
                </h3>

                {wrongChain && (
                  <div
                    className="text-xs p-3 rounded mb-3 flex items-center justify-between"
                    style={{
                      background: "var(--red-dim)",
                      color: "var(--red)",
                      border: "1px solid var(--red)",
                    }}
                  >
                    <span>
                      Wrong chain ({chainId}). Need Morph Mainnet (
                      {MORPH_CHAIN_ID}).
                    </span>
                    <button
                      onClick={handleSwitchToMorph}
                      className="ml-3 px-2 py-1 rounded text-xs font-medium shrink-0"
                      style={{
                        background: "var(--red)",
                        color: "white",
                      }}
                    >
                      Switch
                    </button>
                  </div>
                )}

                {!smartAccount ? (
                  <button
                    onClick={handleCreateSmartAccount}
                    disabled={loading || wrongChain}
                    className="btn-primary rounded-lg w-full"
                  >
                    {loading
                      ? "Creating..."
                      : wrongChain
                        ? "Switch to Morph first"
                        : "Create Smart Account"}
                  </button>
                ) : (
                  <div className="space-y-3">
                    <div className="space-y-2 text-sm font-mono">
                      <div className="flex justify-between">
                        <span style={{ color: "var(--text-muted)" }}>
                          Address
                        </span>
                        <span style={{ color: "var(--gold)" }}>
                          {shortAddr(saAddress)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span style={{ color: "var(--text-muted)" }}>
                          Balance
                        </span>
                        <span
                          style={{
                            color:
                              parseFloat(saBalance) > 0
                                ? "var(--green)"
                                : "var(--red)",
                          }}
                        >
                          {parseFloat(saBalance).toFixed(6)} ETH
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span style={{ color: "var(--text-muted)" }}>
                          EntryPoint
                        </span>
                        <span style={{ color: "var(--text-secondary)" }}>
                          {shortAddr(CONTRACTS.ENTRYPOINT)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span style={{ color: "var(--text-muted)" }}>
                          Paymaster
                        </span>
                        <span
                          style={{
                            color: PAYMASTER_API_KEY
                              ? "var(--green)"
                              : "var(--text-muted)",
                          }}
                        >
                          {PAYMASTER_API_KEY ? "Enabled" : "Off (self-pay)"}
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={handleFundAccount}
                        disabled={loading}
                        className="btn-secondary rounded-lg flex-1"
                      >
                        {loading ? "Sending..." : "Fund 0.001 ETH"}
                      </button>
                      <button
                        onClick={refreshBalance}
                        className="btn-secondary rounded-lg"
                      >
                        Refresh
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Info */}
            <div
              className="rounded-lg p-4 text-xs"
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--border-dim)",
                color: "var(--text-muted)",
              }}
            >
              <p
                className="font-medium mb-1"
                style={{ color: "var(--text-secondary)" }}
              >
                How it works
              </p>
              <p>
                Smart Account is deployed on first transaction. Fund it with ETH
                to pay gas, or enable a Paymaster for gasless transactions.
                Session Keys allow an AI agent to act autonomously within scoped
                permissions — all enforced on-chain by the Session Key Manager
                contract.
              </p>
            </div>
          </div>
        )}

        {/* ── SESSIONS ─────────────────────────── */}
        {tab === "sessions" && (
          <div className="space-y-5 animate-fade-in">
            <div className="card card-gold rounded-lg p-5">
              <h3
                className="text-sm font-medium mb-4"
                style={{ color: "var(--gold)" }}
              >
                Create Session Key (On-Chain)
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    className="block text-xs mb-1.5"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Target Contract
                  </label>
                  <input
                    type="text"
                    value={formContract}
                    onChange={(e) => setFormContract(e.target.value)}
                    className="input-field rounded w-full"
                    placeholder={saAddress || "Smart Account address"}
                  />
                  <p
                    className="text-xs mt-1"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Leave as Smart Account address for self-transfers
                  </p>
                </div>
                <div>
                  <label
                    className="block text-xs mb-1.5"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Expiry
                  </label>
                  <select
                    value={formExpiry}
                    onChange={(e) => setFormExpiry(Number(e.target.value))}
                    className="input-field rounded w-full"
                  >
                    {EXPIRY_OPTIONS.map((o) => (
                      <option key={o.hours} value={o.hours}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-4">
                <label
                  className="block text-xs mb-1.5"
                  style={{ color: "var(--text-muted)" }}
                >
                  Allowed Function
                </label>
                <input
                  type="text"
                  value={formFunction}
                  onChange={(e) => setFormFunction(e.target.value)}
                  className="input-field rounded w-full"
                  placeholder="execute(address,uint256,bytes)"
                />
              </div>

              <button
                onClick={handleCreateSession}
                disabled={!smartAccount || loading}
                className="btn-primary rounded-lg w-full mt-5"
              >
                {loading
                  ? "Creating session on-chain..."
                  : "Grant Session Key (UserOp)"}
              </button>

              <p
                className="text-xs mt-2"
                style={{ color: "var(--text-muted)" }}
              >
                Sends a UserOp to enable the Session Key Manager module and
                register the session policy on-chain.
              </p>
            </div>

            {/* Session list */}
            {sessions.length > 0 && (
              <div>
                <h3
                  className="text-xs uppercase tracking-wider mb-3"
                  style={{ color: "var(--text-muted)" }}
                >
                  Sessions ({sessions.length})
                </h3>
                <div className="space-y-2">
                  {sessions.map((s) => (
                    <div
                      key={s.id}
                      className="card rounded-lg p-4"
                      style={{
                        borderColor:
                          s.status === "active"
                            ? "var(--border-gold)"
                            : "var(--border-dim)",
                        opacity: s.status === "active" ? 1 : 0.5,
                      }}
                    >
                      <div className="space-y-1 text-xs font-mono">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-1.5 h-1.5 rounded-full inline-block"
                            style={{
                              background:
                                s.status === "active"
                                  ? "var(--green)"
                                  : "var(--text-muted)",
                            }}
                          />
                          <span style={{ color: "var(--text-primary)" }}>
                            {shortAddr(s.sessionKeyAddress)}
                          </span>
                          <span
                            className="px-1.5 py-0.5 rounded"
                            style={{
                              background:
                                s.status === "active"
                                  ? "var(--green-dim)"
                                  : "var(--bg-elevated)",
                              color:
                                s.status === "active"
                                  ? "var(--green)"
                                  : "var(--text-muted)",
                            }}
                          >
                            {s.status}
                          </span>
                        </div>
                        <p style={{ color: "var(--text-muted)" }}>
                          {shortAddr(s.contractAddress)} —{" "}
                          {s.functionSelector.split("(")[0]}()
                        </p>
                        <p style={{ color: "var(--text-muted)" }}>
                          {s.status === "active"
                            ? formatCountdown(s.validUntil)
                            : "Expired"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── AGENT ────────────────────────────── */}
        {tab === "agent" && (
          <div className="space-y-5 animate-fade-in">
            <div className="card rounded-lg p-5">
              <h3
                className="text-sm font-medium mb-2"
                style={{ color: "var(--text-primary)" }}
              >
                Agent Autonomous Execution
              </h3>
              <p
                className="text-xs mb-4"
                style={{ color: "var(--text-muted)" }}
              >
                Agent uses session key to sign UserOps — no owner approval
                needed. Permissions are enforced on-chain by the Session Key
                Manager contract.
              </p>

              {activeSessions.length === 0 ? (
                <div className="text-center py-8">
                  <p
                    className="text-sm mb-3"
                    style={{ color: "var(--text-muted)" }}
                  >
                    No active sessions. Create one first.
                  </p>
                  <button
                    onClick={() => setTab("sessions")}
                    className="btn-secondary rounded-lg"
                  >
                    Create Session Key
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label
                      className="block text-xs mb-1.5"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Session Key
                    </label>
                    <select
                      value={selectedSessionIdx}
                      onChange={(e) =>
                        setSelectedSessionIdx(Number(e.target.value))
                      }
                      className="input-field rounded w-full"
                    >
                      {sessions.map((s, i) => (
                        <option
                          key={s.id}
                          value={i}
                          disabled={s.status !== "active"}
                        >
                          {shortAddr(s.sessionKeyAddress)} —{" "}
                          {s.functionSelector.split("(")[0]}(){" "}
                          {s.status !== "active" ? `(${s.status})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label
                        className="block text-xs mb-1.5"
                        style={{ color: "var(--text-muted)" }}
                      >
                        Target Address
                      </label>
                      <input
                        type="text"
                        value={agentTarget}
                        onChange={(e) => setAgentTarget(e.target.value)}
                        className="input-field rounded w-full"
                        placeholder={saAddress || "0x..."}
                      />
                    </div>
                    <div>
                      <label
                        className="block text-xs mb-1.5"
                        style={{ color: "var(--text-muted)" }}
                      >
                        ETH Value
                      </label>
                      <input
                        type="text"
                        value={agentValue}
                        onChange={(e) => setAgentValue(e.target.value)}
                        className="input-field rounded w-full"
                        placeholder="0"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleAgentExecute}
                    disabled={loading}
                    className="btn-primary rounded-lg w-full"
                  >
                    {loading
                      ? "Executing via session key..."
                      : "Execute as Agent (No Approval)"}
                  </button>
                </div>
              )}
            </div>

            <div
              className="rounded-lg p-4 text-xs"
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--border-dim)",
                color: "var(--text-muted)",
              }}
            >
              <p
                className="font-medium mb-1"
                style={{ color: "var(--text-secondary)" }}
              >
                How Session Keys Work
              </p>
              <p>
                The Session Key Manager contract validates each UserOp on-chain:
                target contract whitelist, function selector, parameter rules,
                value limit, and expiry. If any check fails, the transaction
                reverts. The session key&apos;s private key never leaves the
                browser — it signs locally and the proof is verified on-chain.
              </p>
            </div>
          </div>
        )}

        {/* ── SECURITY ─────────────────────────── */}
        {tab === "security" && (
          <div className="space-y-5 animate-fade-in">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              {[
                {
                  label: "Smart Account",
                  value: saAddress ? shortAddr(saAddress) : "—",
                  color: "var(--gold)",
                },
                {
                  label: "Balance",
                  value: saAddress
                    ? `${parseFloat(saBalance).toFixed(4)} ETH`
                    : "—",
                  color:
                    parseFloat(saBalance) > 0 ? "var(--green)" : "var(--red)",
                },
                {
                  label: "Active Sessions",
                  value: activeSessions.length,
                  color: "var(--blue)",
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="card rounded-lg p-4 text-center"
                >
                  <p
                    className="text-lg font-semibold font-mono truncate"
                    style={{ color: stat.color }}
                  >
                    {stat.value}
                  </p>
                  <p
                    className="text-xs mt-1"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>

            {/* Key contracts */}
            <div className="card rounded-lg p-5">
              <h3
                className="text-xs uppercase tracking-wider mb-3"
                style={{ color: "var(--text-muted)" }}
              >
                Deployed Contracts (Morph 2818)
              </h3>
              <div className="space-y-1.5 text-xs font-mono">
                {[
                  ["ENTRYPOINT", CONTRACTS.ENTRYPOINT],
                  ["FACTORY", CONTRACTS.FACTORY],
                  ["ECDSA MODULE", CONTRACTS.ECDSA_MODULE],
                  ["SESSION KEY MANAGER", CONTRACTS.SESSION_KEY_MANAGER],
                  ["BATCHED SESSION ROUTER", CONTRACTS.BATCHED_SESSION_ROUTER],
                  ["ABI SVM", CONTRACTS.ABI_SVM],
                  ["PAYMASTER V1.1", CONTRACTS.PAYMASTER_V1_1],
                ].map(([key, addr]) => (
                  <div key={key} className="flex justify-between">
                    <span style={{ color: "var(--text-muted)" }}>{key}</span>
                    <span style={{ color: "var(--text-secondary)" }}>
                      {shortAddr(addr)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Session details */}
            {sessions.map((s) => (
              <div key={s.id} className="card rounded-lg p-5">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full inline-block"
                      style={{
                        background:
                          s.status === "active"
                            ? "var(--green)"
                            : "var(--text-muted)",
                      }}
                    />
                    <span
                      className="text-sm font-mono"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {shortAddr(s.sessionKeyAddress)}
                    </span>
                  </div>
                  <span
                    className="text-xs font-mono"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {s.status === "active"
                      ? formatCountdown(s.validUntil)
                      : s.status}
                  </span>
                </div>
                <div
                  className="text-xs font-mono space-y-1"
                  style={{ color: "var(--text-muted)" }}
                >
                  <p>Contract: {shortAddr(s.contractAddress)}</p>
                  <p>Function: {s.functionSelector.split("(")[0]}()</p>
                  <p>
                    Created: {new Date(s.createdAt * 1000).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}

            {sessions.length === 0 && (
              <div
                className="text-center py-8 text-sm"
                style={{ color: "var(--text-muted)" }}
              >
                No sessions created yet.
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Console ──────────────────────────────── */}
      <div className="terminal rounded-lg p-4 mt-6">
        <div className="flex items-center justify-between mb-3">
          <span
            className="text-xs uppercase tracking-wider"
            style={{ color: "var(--text-muted)" }}
          >
            Console
          </span>
          <button
            onClick={() => setLogs([])}
            className="text-xs"
            style={{
              color: "var(--text-muted)",
              background: "none",
              border: "none",
              cursor: "pointer",
            }}
          >
            Clear
          </button>
        </div>
        <div
          ref={consoleRef}
          className="space-y-0.5 font-mono text-xs max-h-52 overflow-y-auto"
          style={{ position: "relative", zIndex: 2 }}
        >
          {logs.length === 0 ? (
            <p
              className="terminal-cursor"
              style={{ color: "var(--text-muted)" }}
            >
              Ready — connect wallet to begin
            </p>
          ) : (
            logs.map((log, i) => (
              <div key={i} className="flex gap-2">
                <span
                  className="shrink-0"
                  style={{ color: "var(--text-muted)" }}
                >
                  {log.time}
                </span>
                <span
                  style={{
                    color:
                      log.type === "success"
                        ? "var(--green)"
                        : log.type === "error"
                          ? "var(--red)"
                          : log.type === "warn"
                            ? "var(--gold)"
                            : "var(--text-secondary)",
                  }}
                >
                  {log.msg}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
