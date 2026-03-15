import Link from "next/link";

export default function Home() {
  return (
    <div className="home-bg flex min-h-screen items-center justify-center">
      <main className="flex flex-col items-center gap-10 text-center px-6 animate-fade-up">
        {/* Hero */}
        <div>
          <h1 className="hero-title">Morph</h1>
          <p className="hero-subtitle mt-3">AI Agent Infrastructure</p>
        </div>

        {/* Tags */}
        <div className="flex gap-2">
          {["ERC-4337", "Account Abstraction", "Morph L2"].map((tag) => (
            <span
              key={tag}
              className="px-3 py-1 text-xs tracking-wider uppercase"
              style={{
                color: "var(--text-muted)",
                border: "1px solid var(--border-dim)",
                fontFamily: "var(--font-geist-mono), monospace",
              }}
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Links */}
        <div className="flex flex-col gap-3 w-full max-w-sm mt-2">
          <Link href="/agent-wallet" className="hero-link hero-link-primary">
            <span className="flex items-center justify-between">
              <span>
                <span
                  className="block text-sm font-medium"
                  style={{ color: "var(--text-primary)" }}
                >
                  Agent Wallet
                </span>
                <span
                  className="block text-xs mt-0.5"
                  style={{ color: "var(--text-muted)" }}
                >
                  ERC-4337 Smart Account Demo
                </span>
              </span>
              <span style={{ color: "var(--gold)" }}>&rarr;</span>
            </span>
          </Link>
          <Link href="/biconomy" className="hero-link">
            <span className="flex items-center justify-between">
              <span>
                <span
                  className="block text-sm font-medium"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Biconomy AA
                </span>
                <span
                  className="block text-xs mt-0.5"
                  style={{ color: "var(--text-muted)" }}
                >
                  Third-party Bundler Demo
                </span>
              </span>
              <span style={{ color: "var(--text-muted)" }}>&rarr;</span>
            </span>
          </Link>
        </div>

        {/* Footer */}
        <p
          className="text-xs mt-8"
          style={{
            color: "var(--text-muted)",
            fontFamily: "var(--font-geist-mono), monospace",
          }}
        >
          Morph Hoodi Testnet &middot; Chain 2910
        </p>
      </main>
    </div>
  );
}
