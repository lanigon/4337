// Morph Mainnet (Chain ID 2818) contract addresses

export const MORPH_CHAIN_ID = 2818;

export const BUNDLER_URL = `https://bundler.biconomy.io/api/v2/${MORPH_CHAIN_ID}/nJPK7B3ru.dd7f7861-190d-41bd-af80-6877f74b8f44`;

// Optional: set via env var for gasless transactions
export const PAYMASTER_API_KEY =
  process.env.NEXT_PUBLIC_BICONOMY_PAYMASTER_KEY || "";

// ── Contract Addresses ──────────────────────────────────

export const CONTRACTS = {
  ENTRYPOINT: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
  SMART_ACCOUNT_IMPL: "0x0000002512019Dafb59528B82CB92D3c5D2423Ac",
  FACTORY: "0x000000a56Aaca3e9a4C479ea6b6CD0DbcB6634F5",
  ECDSA_MODULE: "0x0000001c5b32F37F5beA87BDD5374eB2Ac54eA8e",
  SESSION_KEY_MANAGER: "0x000002FbFfedd9B33F4E7156F2DE8D48945E7489",
  BATCHED_SESSION_ROUTER: "0x00000D09967410f8C76752A104c9848b57ebba55",
  ABI_SVM: "0x000006bC2eCdAe38113929293d241Cf252D91861",
  PAYMASTER_V1_1: "0x00000f79b7faf42eebadba19acc07cd08af44789",
  TOKEN_PAYMASTER: "0x00000f7365cA6C59A2C93719ad53d567ed49c14C",
} as const;

// ── Known contracts for UI display ──────────────────────

export const KNOWN_CONTRACTS: Record<string, string> = {
  [CONTRACTS.ENTRYPOINT]: "EntryPoint v0.6.0",
  [CONTRACTS.SESSION_KEY_MANAGER]: "Session Key Manager",
  [CONTRACTS.FACTORY]: "SmartAccount Factory V2",
};
