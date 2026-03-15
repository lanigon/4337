import { http, createConfig } from "wagmi";
import { injected } from "wagmi/connectors";
import { defineChain } from "viem";

export const morph = defineChain({
  id: 2818,
  name: "Morph",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc-quicknode.morph.network"] },
  },
  blockExplorers: {
    default: { name: "Morph Explorer", url: "https://explorer.morph.network" },
  },
});

export const morphHoodi = defineChain({
  id: 2910,
  name: "Morph Hoodi",
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

export const config = createConfig({
  chains: [morph, morphHoodi],
  connectors: [injected()],
  transports: {
    [morph.id]: http(),
    [morphHoodi.id]: http(),
  },
});
