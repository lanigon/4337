"use client";

import Link from "next/link";
import { AgentWalletSession } from "@/components/AgentWalletSession";

export default function AgentPage() {
  return (
    <div
      className="min-h-screen py-8 px-4"
      style={{ background: "var(--bg-deep)" }}
    >
      <div className="w-full max-w-4xl mx-auto">
        <div className="mb-6">
          <Link
            href="/"
            className="text-xs hover:underline"
            style={{ color: "var(--text-muted)" }}
          >
            &larr; Home
          </Link>
        </div>
        <AgentWalletSession />
      </div>
    </div>
  );
}
