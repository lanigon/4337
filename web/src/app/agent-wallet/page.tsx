import Link from "next/link";
import { AgentWalletDemo } from "@/components/AgentWalletDemo";

export default function AgentWalletPage() {
  return (
    <div
      className="min-h-screen py-12 px-4 sm:px-6"
      style={{ background: "var(--bg-deep)" }}
    >
      <div className="max-w-2xl mx-auto">
        <nav className="mb-10 animate-fade-in">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs tracking-wider uppercase transition-colors duration-200"
            style={{
              color: "var(--text-muted)",
              fontFamily: "var(--font-geist-mono), monospace",
            }}
          >
            <span style={{ color: "var(--gold-dim)" }}>&larr;</span>
            <span className="hover:text-[var(--text-secondary)]">Back</span>
          </Link>
        </nav>
        <AgentWalletDemo />
      </div>
    </div>
  );
}
