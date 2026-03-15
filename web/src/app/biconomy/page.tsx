import Link from "next/link";
import { BiconomyDemo } from "@/components/BiconomyDemo";

export default function BiconomyPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white py-16 px-6">
      <div className="max-w-2xl mx-auto mb-8">
        <Link
          href="/"
          className="text-sm text-zinc-500 hover:text-zinc-300 transition"
        >
          ← Back
        </Link>
      </div>
      <BiconomyDemo />
    </div>
  );
}
