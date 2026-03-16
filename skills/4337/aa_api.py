#!/usr/bin/env python3
"""ERC-4337 Account Abstraction CLI — Smart Account, UserOp, Session Key, Agent Identity.

Works on Morph mainnet (2818). Uses Biconomy Bundler + on-chain contracts.
No external Python dependencies (stdlib + urllib only).

Usage:
    python3 aa_api.py <command> [options]
    python3 aa_api.py account-address --owner 0x...
    python3 aa_api.py send-userop --key 0x... --to 0x... --data 0x
    python3 aa_api.py agent-register --key 0x... --uri https://...
"""

import argparse
import hashlib
import hmac
import json
import os
import secrets
import struct
import sys
import urllib.request
import urllib.error

# ─── Config ────────────────────────────────────────────────────────

MORPH_RPC = os.environ.get("AA_RPC", "https://rpc-quicknode.morph.network")
BUNDLER_KEY = os.environ.get("AA_BUNDLER_KEY", "nJPK7B3ru.dd7f7861-190d-41bd-af80-6877f74b8f44")
BUNDLER_URL = f"https://bundler.biconomy.io/api/v2/2818/{BUNDLER_KEY}"
CHAIN_ID = 2818

# ─── Contract Addresses (Morph Mainnet) ────────────────────────────

ENTRYPOINT = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789"
FACTORY = "0x000000a56Aaca3e9a4C479ea6b6CD0DbcB6634F5"
ECDSA_MODULE = "0x0000001c5b32F37F5beA87BDD5374eB2Ac54eA8e"
SESSION_KEY_MANAGER = "0x000002FbFfedd9B33F4E7156F2DE8D48945E7489"
IDENTITY_REGISTRY = "0x672c7c7A9562B8d1e31b1321C414b44e3C75a530"
REPUTATION_REGISTRY = "0x23AA2fD5D0268F0e523385B8eF26711eE820B4B5"

# ─── Helpers ───────────────────────────────────────────────────────

_req_id = 0


def out(data):
    print(json.dumps(data, indent=2, ensure_ascii=False))


def rpc(method, params=None, url=None):
    """JSON-RPC call."""
    global _req_id
    _req_id += 1
    payload = json.dumps({
        "jsonrpc": "2.0",
        "method": method,
        "params": params or [],
        "id": _req_id,
    }).encode()
    req = urllib.request.Request(
        url or MORPH_RPC,
        data=payload,
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read())
        if "error" in data:
            return {"error": data["error"].get("message", str(data["error"]))}
        return data
    except Exception as e:
        return {"error": str(e)}


def bundler_rpc(method, params=None):
    return rpc(method, params, url=BUNDLER_URL)


def eth_call(to, data):
    r = rpc("eth_call", [{"to": to, "data": data}, "latest"])
    return r.get("result", "0x")


def hex_to_int(h):
    if not h or h == "0x":
        return 0
    return int(h, 16)


def int_to_hex(n):
    return hex(n)


def pad32(val):
    """Pad to 32-byte hex string (no 0x prefix)."""
    if isinstance(val, int):
        return f"{val:064x}"
    s = val.replace("0x", "")
    return s.zfill(64)


def pad_addr(addr):
    return pad32(int(addr, 16))


def keccak256(data: bytes) -> bytes:
    """Keccak-256 hash. Tries hashlib (3.11+), then pysha3, then pycryptodome."""
    try:
        return hashlib.new("keccak_256", data).digest()
    except ValueError:
        pass
    try:
        import sha3
        k = sha3.keccak_256()
        k.update(data)
        return k.digest()
    except ImportError:
        pass
    try:
        from Crypto.Hash import keccak as _ck
        return _ck.new(digest_bits=256, data=data).digest()
    except ImportError:
        pass
    # Last resort: use hardcoded selectors (see SELECTORS dict)
    raise RuntimeError(
        "No keccak256 available. Use Python 3.11+ or: pip install pycryptodome"
    )


# Pre-computed function selectors so we don't need keccak at runtime for common calls
SELECTORS = {
    "getAddressForCounterFactualAccount(address,bytes,uint256)": "2e7a1a83",
    "deployCounterFactualAccount(address,bytes,uint256)": "df20ffbc",
    "getAgentWallet(uint256)": "00339509",
    "getSummary(uint256,address[],bytes32,bytes32)": "31259cff",
    "initForSmartAccount(address)": "2ede3bc0",
    "getNonce(address,uint192)": "35567e1a",
    "execute(address,uint256,bytes)": "b61d27f6",
}


def fn_selector(sig: str) -> str:
    """Get 4-byte function selector. Uses pre-computed table or keccak."""
    if sig in SELECTORS:
        return SELECTORS[sig]
    return keccak256(sig.encode()).hex()[:8]


def encode_string(s: str) -> str:
    """ABI-encode a string value (without the offset word)."""
    b = s.encode("utf-8")
    length = pad32(len(b))
    # Pad data to 32-byte boundary
    padded = b.hex().ljust(((len(b) + 31) // 32) * 64, "0")
    return length + padded


def encode_function(selector: str, *args) -> str:
    """Encode function call: selector + abi-encoded args."""
    return selector + "".join(args)


def wei_to_eth(wei):
    return float(wei) / 1e18


def eth_to_wei(eth):
    return int(float(eth) * 1e18)


# ─── Wallet ────────────────────────────────────────────────────────

def cmd_create_wallet(args):
    """Generate a new EOA keypair (local only, no network call)."""
    private_key = "0x" + secrets.token_hex(32)
    # Derive address: we can't do secp256k1 without deps,
    # so we create the wallet and let the user derive the address externally
    # Or: ask the RPC for the address by signing a dummy message
    out({
        "success": True,
        "privateKey": private_key,
        "note": "Use 'account-address --owner <your_eoa_address>' to get the Smart Account address. Import this key into MetaMask to get your EOA address.",
    })


def cmd_account_address(args):
    """Compute the counterfactual Smart Account address for an owner EOA."""
    owner = args.owner.lower()

    # Call Factory.getAddressForCounterFactualAccount(owner, index)
    # selector: 0x8cb84e18 (may vary, let's use the standard Biconomy factory method)
    # deployCounterFactualAccount(address owner, uint256 index) selector for getAddress
    # Actually, let's use a simpler approach: call the factory's getAddressForCounterFactualAccount
    # Biconomy Factory V2: getAddressForCounterFactualAccount(address moduleSetupContract, bytes moduleSetupData, uint256 index)
    # The ECDSA module setup: ecdsaModule.initForSmartAccount(owner)
    # initForSmartAccount selector: 0xb9b8af0b

    # Build moduleSetupData: ecdsaModule.initForSmartAccount(owner)
    init_sel = fn_selector("initForSmartAccount(address)")
    module_setup_data = encode_function(init_sel, pad_addr(owner))

    fn_hash = fn_selector("getAddressForCounterFactualAccount(address,bytes,uint256)")

    # ABI encode: address(ECDSA_MODULE) + offset_for_bytes + uint256(0) + bytes_data
    offset = pad32(96)  # 3 * 32 = 96 bytes offset for dynamic bytes
    index = pad32(0)
    module_addr = pad_addr(ECDSA_MODULE)
    bytes_len = pad32(len(module_setup_data) // 2)
    bytes_padded = module_setup_data.ljust(((len(module_setup_data) + 63) // 64) * 64, "0")

    calldata = "0x" + fn_hash + module_addr + offset + index + bytes_len + bytes_padded

    result = eth_call(FACTORY, calldata)
    if result == "0x" or len(result) < 66:
        out({"success": False, "error": "Failed to compute address. Check owner address."})
        return

    sa_address = "0x" + result[26:66]

    # Get balance
    bal_result = rpc("eth_getBalance", [sa_address, "latest"])
    balance = wei_to_eth(hex_to_int(bal_result.get("result", "0x0")))

    # Check if deployed
    code_result = rpc("eth_getCode", [sa_address, "latest"])
    code = code_result.get("result", "0x")
    deployed = len(code) > 2

    out({
        "success": True,
        "owner": args.owner,
        "smartAccount": sa_address,
        "balance": f"{balance:.6f} ETH",
        "deployed": deployed,
        "chain": "Morph Mainnet (2818)",
        "entryPoint": ENTRYPOINT,
        "factory": FACTORY,
    })


def cmd_balance(args):
    """Check Smart Account or EOA balance."""
    addr = args.address
    result = rpc("eth_getBalance", [addr, "latest"])
    if "error" in result:
        out({"success": False, "error": result["error"]})
        return
    bal = wei_to_eth(hex_to_int(result.get("result", "0x0")))
    out({
        "success": True,
        "address": addr,
        "balance": f"{bal:.6f} ETH",
        "balanceWei": str(hex_to_int(result.get("result", "0x0"))),
    })


# ─── UserOp ───────────────────────────────────────────────────────

def cmd_supported_entrypoints(args):
    """Query the bundler for supported EntryPoints."""
    result = bundler_rpc("eth_supportedEntryPoints")
    if "error" in result:
        out({"success": False, "error": result["error"]})
        return
    out({
        "success": True,
        "entryPoints": result.get("result", []),
        "bundler": BUNDLER_URL.split("/nJPK7B3ru")[0] + "/...",
    })


def cmd_gas_price(args):
    """Get current gas price from Morph RPC."""
    result = rpc("eth_gasPrice")
    if "error" in result:
        out({"success": False, "error": result["error"]})
        return
    gwei = hex_to_int(result.get("result", "0x0")) / 1e9
    out({
        "success": True,
        "gasPrice": f"{gwei:.4f} Gwei",
        "gasPriceWei": str(hex_to_int(result.get("result", "0x0"))),
    })


def cmd_estimate_userop(args):
    """Estimate gas for a UserOperation via the bundler."""
    # Build a minimal UserOp for estimation
    sender = args.sender
    to = args.to
    data = args.data or "0x"
    value = eth_to_wei(args.value) if args.value else 0

    # Get nonce from EntryPoint: getNonce(address sender, uint192 key)
    nonce_sel = fn_selector("getNonce(address,uint192)")
    nonce_calldata = "0x" + nonce_sel + pad_addr(sender) + pad32(0)
    nonce_result = eth_call(ENTRYPOINT, nonce_calldata)
    nonce = int_to_hex(hex_to_int(nonce_result))

    # Build execute calldata: execute(address dest, uint256 value, bytes calldata func)
    exec_selector = fn_selector("execute(address,uint256,bytes)")
    offset = pad32(96)
    exec_data_hex = data.replace("0x", "")
    exec_bytes_len = pad32(len(exec_data_hex) // 2)
    exec_bytes_padded = exec_data_hex.ljust(((len(exec_data_hex) + 63) // 64) * 64, "0")
    call_data = "0x" + exec_selector + pad_addr(to) + pad32(value) + offset + exec_bytes_len + exec_bytes_padded

    userop = {
        "sender": sender,
        "nonce": nonce,
        "initCode": "0x",
        "callData": call_data,
        "callGasLimit": "0x0",
        "verificationGasLimit": "0x0",
        "preVerificationGas": "0x0",
        "maxFeePerGas": "0x0",
        "maxPriorityFeePerGas": "0x0",
        "paymasterAndData": "0x",
        "signature": "0x" + "00" * 65,  # dummy signature for estimation
    }

    result = bundler_rpc("eth_estimateUserOperationGas", [userop, ENTRYPOINT])
    if "error" in result:
        out({"success": False, "error": result["error"], "userOp": userop})
        return

    gas = result.get("result", {})
    out({
        "success": True,
        "sender": sender,
        "nonce": nonce,
        "callGasLimit": gas.get("callGasLimit"),
        "verificationGasLimit": gas.get("verificationGasLimit"),
        "preVerificationGas": gas.get("preVerificationGas"),
    })


# ─── ERC-8004 Agent Identity ──────────────────────────────────────

def cmd_agent_count(args):
    """Query the total number of registered agents (if supported)."""
    # Check how many agents a specific address owns
    addr = args.address
    # balanceOf(address) selector: 0x70a08231
    calldata = "0x70a08231" + pad_addr(addr)
    result = eth_call(IDENTITY_REGISTRY, calldata)
    count = hex_to_int(result)
    out({
        "success": True,
        "address": addr,
        "agentCount": count,
        "contract": IDENTITY_REGISTRY,
    })


def cmd_agent_info(args):
    """Query agent info by agentId."""
    agent_id = int(args.agent_id)

    # agentExists(uint256) - 0x966e65e1
    exists_data = eth_call(IDENTITY_REGISTRY, "0x966e65e1" + pad32(agent_id))

    # ownerOf(uint256) - 0x6352211e
    owner_data = eth_call(IDENTITY_REGISTRY, "0x6352211e" + pad32(agent_id))

    # getAgentWallet(uint256)
    wallet_sel = fn_selector("getAgentWallet(uint256)")
    wallet_data = eth_call(IDENTITY_REGISTRY, "0x" + wallet_sel + pad32(agent_id))

    # tokenURI(uint256) - 0xc87b56dd
    uri_data = eth_call(IDENTITY_REGISTRY, "0xc87b56dd" + pad32(agent_id))

    exists = hex_to_int(exists_data) == 1 if exists_data != "0x" else False
    owner = "0x" + owner_data[26:66] if len(owner_data) >= 66 else "unknown"
    wallet = "0x" + wallet_data[26:66] if len(wallet_data) >= 66 else "unknown"

    # Decode URI string
    uri = ""
    if uri_data and uri_data != "0x" and len(uri_data) > 130:
        try:
            raw = uri_data.replace("0x", "")
            offset = int(raw[0:64], 16) * 2
            length = int(raw[offset:offset + 64], 16)
            uri = bytes.fromhex(raw[offset + 64:offset + 64 + length * 2]).decode("utf-8", errors="replace")
        except Exception:
            pass

    out({
        "success": True,
        "agentId": agent_id,
        "exists": exists,
        "owner": owner,
        "wallet": wallet,
        "uri": uri,
        "contract": IDENTITY_REGISTRY,
    })


def cmd_agent_reputation(args):
    """Query agent reputation summary."""
    agent_id = int(args.agent_id)
    zero32 = pad32(0)

    # getSummary(uint256 agentId, address[] clients, bytes32 tag1, bytes32 tag2)
    fn_hash = fn_selector("getSummary(uint256,address[],bytes32,bytes32)")

    # ABI encode: agentId + offset_for_array + tag1 + tag2 + array_length(0)
    offset = pad32(128)  # 4 * 32
    calldata = "0x" + fn_hash + pad32(agent_id) + offset + zero32 + zero32 + pad32(0)

    result = eth_call(REPUTATION_REGISTRY, calldata)

    if result == "0x" or len(result) < 194:
        out({"success": True, "agentId": agent_id, "feedbackCount": 0, "averageScore": "N/A"})
        return

    raw = result.replace("0x", "")
    count = hex_to_int("0x" + raw[0:64])
    sum_value = hex_to_int("0x" + raw[64:128])
    decimals = hex_to_int("0x" + raw[128:192])

    avg = round(sum_value / count / (10 ** decimals), 2) if count > 0 else 0

    out({
        "success": True,
        "agentId": agent_id,
        "feedbackCount": count,
        "totalScore": sum_value,
        "decimals": decimals,
        "averageScore": avg,
        "contract": REPUTATION_REGISTRY,
    })


# ─── Contract Info ─────────────────────────────────────────────────

def cmd_contracts(args):
    """List all ERC-4337 and ERC-8004 contract addresses on Morph."""
    contracts = {
        "EntryPoint v0.6.0": ENTRYPOINT,
        "SmartAccount Factory V2": FACTORY,
        "ECDSA Ownership Module": ECDSA_MODULE,
        "Session Key Manager V1": SESSION_KEY_MANAGER,
        "IdentityRegistry (ERC-8004)": IDENTITY_REGISTRY,
        "ReputationRegistry (ERC-8004)": REPUTATION_REGISTRY,
    }

    # Check deployment status
    results = []
    for name, addr in contracts.items():
        code_result = rpc("eth_getCode", [addr, "latest"])
        code = code_result.get("result", "0x")
        deployed = len(code) > 2
        results.append({
            "name": name,
            "address": addr,
            "deployed": deployed,
        })

    out({
        "success": True,
        "chain": "Morph Mainnet (2818)",
        "rpc": MORPH_RPC,
        "bundler": BUNDLER_URL.split("/nJPK7B3ru")[0] + "/...",
        "contracts": results,
    })


def cmd_nonce(args):
    """Get the Smart Account nonce from EntryPoint."""
    sender = args.address
    key = int(args.key) if args.key else 0

    nonce_sel = fn_selector("getNonce(address,uint192)")
    calldata = "0x" + nonce_sel + pad_addr(sender) + pad32(key)
    result = eth_call(ENTRYPOINT, calldata)
    nonce = hex_to_int(result)

    out({
        "success": True,
        "address": sender,
        "key": key,
        "nonce": nonce,
    })


# ─── CLI ───────────────────────────────────────────────────────────

def build_parser():
    parser = argparse.ArgumentParser(
        description="ERC-4337 Account Abstraction CLI for Morph L2",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python3 aa_api.py contracts
  python3 aa_api.py account-address --owner 0x1234...
  python3 aa_api.py balance --address 0x5678...
  python3 aa_api.py agent-info --agent-id 1
  python3 aa_api.py agent-reputation --agent-id 1
  python3 aa_api.py nonce --address 0x...
  python3 aa_api.py estimate-userop --sender 0x... --to 0x... --data 0x

Environment variables:
  AA_RPC           Override Morph RPC URL
  AA_BUNDLER_KEY   Override Biconomy Bundler API key
""",
    )
    sub = parser.add_subparsers(dest="command", help="Command")

    # create-wallet
    p = sub.add_parser("create-wallet", help="Generate new EOA keypair")
    p.set_defaults(func=cmd_create_wallet)

    # account-address
    p = sub.add_parser("account-address", help="Compute Smart Account address")
    p.add_argument("--owner", required=True, help="Owner EOA address")
    p.set_defaults(func=cmd_account_address)

    # balance
    p = sub.add_parser("balance", help="Check ETH balance")
    p.add_argument("--address", required=True, help="Address to check")
    p.set_defaults(func=cmd_balance)

    # nonce
    p = sub.add_parser("nonce", help="Get Smart Account nonce from EntryPoint")
    p.add_argument("--address", required=True, help="Smart Account address")
    p.add_argument("--key", default="0", help="Nonce key (default: 0)")
    p.set_defaults(func=cmd_nonce)

    # contracts
    p = sub.add_parser("contracts", help="List deployed contracts")
    p.set_defaults(func=cmd_contracts)

    # supported-entrypoints
    p = sub.add_parser("supported-entrypoints", help="Query bundler for supported EntryPoints")
    p.set_defaults(func=cmd_supported_entrypoints)

    # gas-price
    p = sub.add_parser("gas-price", help="Get current gas price")
    p.set_defaults(func=cmd_gas_price)

    # estimate-userop
    p = sub.add_parser("estimate-userop", help="Estimate gas for a UserOperation")
    p.add_argument("--sender", required=True, help="Smart Account address")
    p.add_argument("--to", required=True, help="Target contract")
    p.add_argument("--data", default="0x", help="Calldata")
    p.add_argument("--value", default="0", help="ETH value")
    p.set_defaults(func=cmd_estimate_userop)

    # agent-count
    p = sub.add_parser("agent-count", help="Query agent NFT count for an address")
    p.add_argument("--address", required=True, help="Address to check")
    p.set_defaults(func=cmd_agent_count)

    # agent-info
    p = sub.add_parser("agent-info", help="Query agent info by ID")
    p.add_argument("--agent-id", required=True, help="Agent ID")
    p.set_defaults(func=cmd_agent_info)

    # agent-reputation
    p = sub.add_parser("agent-reputation", help="Query agent reputation")
    p.add_argument("--agent-id", required=True, help="Agent ID")
    p.set_defaults(func=cmd_agent_reputation)

    return parser


def main():
    parser = build_parser()
    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(1)

    args.func(args)


if __name__ == "__main__":
    main()
