#!/usr/bin/env python3
"""EVM RPC CLI — interact with any EVM chain via JSON-RPC. No API key needed."""

import argparse
import json
import os
import sys
import requests

# ─── Chain Registry ─────────────────────────────────────────────────
# Public RPC endpoints for major EVM chains.
# Override any chain's RPC via env: EVM_RPC_<CHAIN_UPPER>=https://...

CHAINS = {
    "ethereum": {
        "chain_id": 1,
        "rpc": "https://eth.llamarpc.com",
        "symbol": "ETH",
        "name": "Ethereum Mainnet",
    },
    "polygon": {
        "chain_id": 137,
        "rpc": "https://polygon-bor-rpc.publicnode.com",
        "symbol": "MATIC",
        "name": "Polygon PoS",
    },
    "bsc": {
        "chain_id": 56,
        "rpc": "https://bsc-dataseed.binance.org",
        "symbol": "BNB",
        "name": "BNB Smart Chain",
    },
    "arbitrum": {
        "chain_id": 42161,
        "rpc": "https://arb1.arbitrum.io/rpc",
        "symbol": "ETH",
        "name": "Arbitrum One",
    },
    "optimism": {
        "chain_id": 10,
        "rpc": "https://mainnet.optimism.io",
        "symbol": "ETH",
        "name": "Optimism",
    },
    "base": {
        "chain_id": 8453,
        "rpc": "https://mainnet.base.org",
        "symbol": "ETH",
        "name": "Base",
    },
    "avalanche": {
        "chain_id": 43114,
        "rpc": "https://api.avax.network/ext/bc/C/rpc",
        "symbol": "AVAX",
        "name": "Avalanche C-Chain",
    },
    "linea": {
        "chain_id": 59144,
        "rpc": "https://rpc.linea.build",
        "symbol": "ETH",
        "name": "Linea",
    },
    "scroll": {
        "chain_id": 534352,
        "rpc": "https://rpc.scroll.io",
        "symbol": "ETH",
        "name": "Scroll",
    },
    "zksync": {
        "chain_id": 324,
        "rpc": "https://mainnet.era.zksync.io",
        "symbol": "ETH",
        "name": "zkSync Era",
    },
    "fantom": {
        "chain_id": 250,
        "rpc": "https://rpc.ftm.tools",
        "symbol": "FTM",
        "name": "Fantom Opera",
    },
    "gnosis": {
        "chain_id": 100,
        "rpc": "https://rpc.gnosischain.com",
        "symbol": "xDAI",
        "name": "Gnosis Chain",
    },
    "mantle": {
        "chain_id": 5000,
        "rpc": "https://rpc.mantle.xyz",
        "symbol": "MNT",
        "name": "Mantle",
    },
    "celo": {
        "chain_id": 42220,
        "rpc": "https://forno.celo.org",
        "symbol": "CELO",
        "name": "Celo",
    },
    "morph": {
        "chain_id": 2818,
        "rpc": "https://rpc-quicknode.morph.network",
        "symbol": "ETH",
        "name": "Morph Mainnet",
    },
    "sepolia": {
        "chain_id": 11155111,
        "rpc": "https://rpc.sepolia.org",
        "symbol": "ETH",
        "name": "Sepolia Testnet",
    },
}

DEFAULT_CHAIN = os.environ.get("EVM_CHAIN", "ethereum")

_req_id = 0


def get_rpc(chain: str) -> str:
    """Get RPC URL for a chain, checking env override first."""
    env_key = f"EVM_RPC_{chain.upper()}"
    env_val = os.environ.get(env_key)
    if env_val:
        return env_val
    info = CHAINS.get(chain)
    if not info:
        return None
    return info["rpc"]


def rpc_call(chain: str, method: str, params: list = None) -> dict:
    """Make a JSON-RPC call."""
    global _req_id
    _req_id += 1
    rpc_url = get_rpc(chain)
    if not rpc_url:
        return {"error": f"Unknown chain: {chain}. Use --chain with one of: {', '.join(CHAINS.keys())}"}

    payload = {
        "jsonrpc": "2.0",
        "method": method,
        "params": params or [],
        "id": _req_id,
    }
    try:
        r = requests.post(rpc_url, json=payload, timeout=30)
        r.raise_for_status()
        data = r.json()
        if "error" in data:
            return {"error": data["error"].get("message", str(data["error"]))}
        return data
    except Exception as e:
        return {"error": str(e)}


def out(data):
    print(json.dumps(data, indent=2, ensure_ascii=False))


def hex_to_int(h: str) -> int:
    if not h or h == "0x":
        return 0
    return int(h, 16)


# ─── ERC-20 helpers ─────────────────────────────────────────────────

ERC20_BALANCE_OF = "0x70a08231"
ERC20_DECIMALS = "0x313ce567"
ERC20_SYMBOL = "0x95d89b41"
ERC20_NAME = "0x06fdde03"
ERC20_TOTAL_SUPPLY = "0x18160ddd"
ERC20_TRANSFER = "0xa9059cbb"


def pad_address(addr: str) -> str:
    """Pad an address to 32 bytes for ABI encoding."""
    return addr.lower().replace("0x", "").zfill(64)


def pad_uint256(value: int) -> str:
    """Pad a uint256 value to 32 bytes."""
    return hex(value)[2:].zfill(64)


def decode_uint256(hex_data: str) -> int:
    if not hex_data or hex_data == "0x":
        return 0
    return int(hex_data, 16)


def decode_string(hex_data: str) -> str:
    """Decode ABI-encoded string from hex."""
    if not hex_data or hex_data == "0x" or len(hex_data) < 130:
        return ""
    try:
        raw = hex_data.replace("0x", "")
        offset = int(raw[0:64], 16) * 2
        length = int(raw[offset:offset + 64], 16)
        string_hex = raw[offset + 64:offset + 64 + length * 2]
        return bytes.fromhex(string_hex).decode("utf-8", errors="replace")
    except Exception:
        return ""


# ─── Chain Info ─────────────────────────────────────────────────────

def cmd_chains(args):
    """List all supported chains."""
    chains = []
    for key, info in CHAINS.items():
        chains.append({
            "chain": key,
            "name": info["name"],
            "chain_id": info["chain_id"],
            "symbol": info["symbol"],
            "rpc": get_rpc(key),
        })
    out({"success": True, "chains": chains})


def cmd_chain_info(args):
    """Get chain info and latest block."""
    chain = args.chain
    info = CHAINS.get(chain)
    if not info:
        out({"success": False, "error": f"Unknown chain: {chain}"})
        return

    result = rpc_call(chain, "eth_blockNumber")
    if "error" in result:
        out({"success": False, "error": result["error"]})
        return

    block = hex_to_int(result["result"])
    out({
        "success": True,
        "chain": chain,
        "name": info["name"],
        "chain_id": info["chain_id"],
        "symbol": info["symbol"],
        "rpc": get_rpc(chain),
        "latest_block": block,
    })


# ─── Network ───────────────────────────────────────────────────────

def cmd_block_number(args):
    """Get latest block number."""
    result = rpc_call(args.chain, "eth_blockNumber")
    if "error" in result:
        out({"success": False, "error": result["error"]})
        return
    block = hex_to_int(result["result"])
    out({"success": True, "chain": args.chain, "block_number": block})


def cmd_gas_price(args):
    """Get current gas price."""
    result = rpc_call(args.chain, "eth_gasPrice")
    if "error" in result:
        out({"success": False, "error": result["error"]})
        return
    wei = hex_to_int(result["result"])
    out({
        "success": True,
        "chain": args.chain,
        "gas_price_wei": str(wei),
        "gas_price_gwei": f"{wei / 1e9:.2f}",
    })


def cmd_block(args):
    """Get block by number or 'latest'."""
    tag = args.block
    if tag != "latest":
        tag = hex(int(tag))
    result = rpc_call(args.chain, "eth_getBlockByNumber", [tag, False])
    if "error" in result:
        out({"success": False, "error": result["error"]})
        return
    blk = result.get("result")
    if not blk:
        out({"success": False, "error": "Block not found"})
        return
    out({
        "success": True,
        "chain": args.chain,
        "number": hex_to_int(blk.get("number", "0x0")),
        "hash": blk.get("hash"),
        "timestamp": hex_to_int(blk.get("timestamp", "0x0")),
        "transactions": len(blk.get("transactions", [])),
        "gas_used": hex_to_int(blk.get("gasUsed", "0x0")),
        "gas_limit": hex_to_int(blk.get("gasLimit", "0x0")),
        "base_fee_gwei": f"{hex_to_int(blk.get('baseFeePerGas', '0x0')) / 1e9:.4f}" if blk.get("baseFeePerGas") else None,
        "miner": blk.get("miner"),
    })


# ─── Wallet ────────────────────────────────────────────────────────

def cmd_create_wallet(args):
    """Generate a new Ethereum key pair locally."""
    from eth_account import Account
    acct = Account.create()
    out({
        "success": True,
        "address": acct.address,
        "private_key": acct.key.hex(),
        "warning": "Save your private key securely. It cannot be recovered.",
    })


def cmd_balance(args):
    """Get native token balance."""
    result = rpc_call(args.chain, "eth_getBalance", [args.address, "latest"])
    if "error" in result:
        out({"success": False, "error": result["error"]})
        return
    wei = hex_to_int(result["result"])
    symbol = CHAINS.get(args.chain, {}).get("symbol", "ETH")
    out({
        "success": True,
        "chain": args.chain,
        "address": args.address,
        "balance_wei": str(wei),
        "balance": f"{wei / 1e18:.6f}",
        "symbol": symbol,
    })


def cmd_nonce(args):
    """Get transaction count (nonce) for an address."""
    result = rpc_call(args.chain, "eth_getTransactionCount", [args.address, "latest"])
    if "error" in result:
        out({"success": False, "error": result["error"]})
        return
    out({
        "success": True,
        "chain": args.chain,
        "address": args.address,
        "nonce": hex_to_int(result["result"]),
    })


def cmd_transfer(args):
    """Send native token (ETH/MATIC/BNB/etc.)."""
    from eth_account import Account

    chain = args.chain
    chain_info = CHAINS.get(chain)
    if not chain_info:
        out({"success": False, "error": f"Unknown chain: {chain}"})
        return

    acct = Account.from_key(args.private_key)
    value_wei = int(float(args.amount) * 1e18)

    # Get nonce
    nonce_result = rpc_call(chain, "eth_getTransactionCount", [acct.address, "latest"])
    if "error" in nonce_result:
        out({"success": False, "error": nonce_result["error"]})
        return
    nonce = hex_to_int(nonce_result["result"])

    # Get gas price
    gas_result = rpc_call(chain, "eth_gasPrice")
    if "error" in gas_result:
        out({"success": False, "error": gas_result["error"]})
        return
    gas_price = hex_to_int(gas_result["result"])

    tx = {
        "nonce": nonce,
        "to": args.to,
        "value": value_wei,
        "gas": 21000,
        "gasPrice": gas_price,
        "chainId": chain_info["chain_id"],
    }

    signed = acct.sign_transaction(tx)
    raw_tx = "0x" + signed.raw_transaction.hex()

    result = rpc_call(chain, "eth_sendRawTransaction", [raw_tx])
    if "error" in result:
        out({"success": False, "error": result["error"]})
        return

    out({
        "success": True,
        "chain": chain,
        "tx_hash": result["result"],
        "from": acct.address,
        "to": args.to,
        "amount": args.amount,
        "symbol": chain_info["symbol"],
    })


def cmd_transfer_token(args):
    """Send ERC-20 tokens."""
    from eth_account import Account

    chain = args.chain
    chain_info = CHAINS.get(chain)
    if not chain_info:
        out({"success": False, "error": f"Unknown chain: {chain}"})
        return

    acct = Account.from_key(args.private_key)

    # Get token decimals
    dec_result = rpc_call(chain, "eth_call", [
        {"to": args.token, "data": ERC20_DECIMALS}, "latest"
    ])
    if "error" in dec_result:
        out({"success": False, "error": dec_result["error"]})
        return
    decimals = decode_uint256(dec_result.get("result", "0x12"))
    if decimals == 0:
        decimals = 18

    # Encode transfer(to, amount)
    amount_raw = int(float(args.amount) * (10 ** decimals))
    data = ERC20_TRANSFER + pad_address(args.to) + pad_uint256(amount_raw)

    # Get nonce
    nonce_result = rpc_call(chain, "eth_getTransactionCount", [acct.address, "latest"])
    if "error" in nonce_result:
        out({"success": False, "error": nonce_result["error"]})
        return
    nonce = hex_to_int(nonce_result["result"])

    # Estimate gas
    est_result = rpc_call(chain, "eth_estimateGas", [
        {"from": acct.address, "to": args.token, "data": data}
    ])
    if "error" in est_result:
        out({"success": False, "error": f"Gas estimate failed: {est_result['error']}"})
        return
    gas_limit = int(hex_to_int(est_result["result"]) * 1.2)

    # Get gas price
    gas_result = rpc_call(chain, "eth_gasPrice")
    if "error" in gas_result:
        out({"success": False, "error": gas_result["error"]})
        return
    gas_price = hex_to_int(gas_result["result"])

    tx = {
        "nonce": nonce,
        "to": args.token,
        "value": 0,
        "gas": gas_limit,
        "gasPrice": gas_price,
        "chainId": chain_info["chain_id"],
        "data": bytes.fromhex(data.replace("0x", "")),
    }

    signed = acct.sign_transaction(tx)
    raw_tx = "0x" + signed.raw_transaction.hex()

    result = rpc_call(chain, "eth_sendRawTransaction", [raw_tx])
    if "error" in result:
        out({"success": False, "error": result["error"]})
        return

    out({
        "success": True,
        "chain": chain,
        "tx_hash": result["result"],
        "from": acct.address,
        "to": args.to,
        "token": args.token,
        "amount": args.amount,
        "decimals": decimals,
    })


# ─── Transaction ───────────────────────────────────────────────────

def cmd_tx_receipt(args):
    """Get transaction receipt."""
    result = rpc_call(args.chain, "eth_getTransactionReceipt", [args.hash])
    if "error" in result:
        out({"success": False, "error": result["error"]})
        return
    receipt = result.get("result")
    if not receipt:
        out({"success": False, "error": "Transaction not found or pending"})
        return
    out({
        "success": True,
        "chain": args.chain,
        "hash": args.hash,
        "status": "success" if receipt.get("status") == "0x1" else "failed",
        "block": hex_to_int(receipt.get("blockNumber", "0x0")),
        "from": receipt.get("from"),
        "to": receipt.get("to"),
        "contract_address": receipt.get("contractAddress"),
        "gas_used": hex_to_int(receipt.get("gasUsed", "0x0")),
        "effective_gas_price_gwei": f"{hex_to_int(receipt.get('effectiveGasPrice', '0x0')) / 1e9:.4f}",
        "logs_count": len(receipt.get("logs", [])),
    })


def cmd_tx(args):
    """Get transaction by hash."""
    result = rpc_call(args.chain, "eth_getTransactionByHash", [args.hash])
    if "error" in result:
        out({"success": False, "error": result["error"]})
        return
    tx = result.get("result")
    if not tx:
        out({"success": False, "error": "Transaction not found"})
        return
    out({
        "success": True,
        "chain": args.chain,
        "hash": tx.get("hash"),
        "block": hex_to_int(tx.get("blockNumber", "0x0")) if tx.get("blockNumber") else "pending",
        "from": tx.get("from"),
        "to": tx.get("to"),
        "value_eth": f"{hex_to_int(tx.get('value', '0x0')) / 1e18:.6f}",
        "gas_limit": hex_to_int(tx.get("gas", "0x0")),
        "gas_price_gwei": f"{hex_to_int(tx.get('gasPrice', '0x0')) / 1e9:.4f}" if tx.get("gasPrice") else None,
        "nonce": hex_to_int(tx.get("nonce", "0x0")),
        "input": tx.get("input", "0x")[:74] + ("..." if len(tx.get("input", "")) > 74 else ""),
    })


# ─── Token (ERC-20) ───────────────────────────────────────────────

def cmd_token_info(args):
    """Get ERC-20 token info: name, symbol, decimals, total supply."""
    chain = args.chain
    token = args.token

    calls = {
        "name": {"to": token, "data": ERC20_NAME},
        "symbol": {"to": token, "data": ERC20_SYMBOL},
        "decimals": {"to": token, "data": ERC20_DECIMALS},
        "totalSupply": {"to": token, "data": ERC20_TOTAL_SUPPLY},
    }

    results = {}
    for key, call_data in calls.items():
        r = rpc_call(chain, "eth_call", [call_data, "latest"])
        results[key] = r.get("result", "0x")

    decimals = decode_uint256(results["decimals"])
    if decimals == 0:
        decimals = 18

    total_raw = decode_uint256(results["totalSupply"])

    out({
        "success": True,
        "chain": chain,
        "token": token,
        "name": decode_string(results["name"]),
        "symbol": decode_string(results["symbol"]),
        "decimals": decimals,
        "total_supply": f"{total_raw / 10**decimals:.4f}",
        "total_supply_raw": str(total_raw),
    })


def cmd_token_balance(args):
    """Get ERC-20 token balance for an address."""
    chain = args.chain
    data = ERC20_BALANCE_OF + pad_address(args.address)

    # Get balance
    result = rpc_call(chain, "eth_call", [
        {"to": args.token, "data": data}, "latest"
    ])
    if "error" in result:
        out({"success": False, "error": result["error"]})
        return

    # Get decimals
    dec_result = rpc_call(chain, "eth_call", [
        {"to": args.token, "data": ERC20_DECIMALS}, "latest"
    ])
    decimals = decode_uint256(dec_result.get("result", "0x12"))
    if decimals == 0:
        decimals = 18

    # Get symbol
    sym_result = rpc_call(chain, "eth_call", [
        {"to": args.token, "data": ERC20_SYMBOL}, "latest"
    ])
    symbol = decode_string(sym_result.get("result", "0x"))

    raw = decode_uint256(result.get("result", "0x"))
    out({
        "success": True,
        "chain": chain,
        "address": args.address,
        "token": args.token,
        "symbol": symbol,
        "decimals": decimals,
        "balance": f"{raw / 10**decimals:.6f}",
        "balance_raw": str(raw),
    })


# ─── Contract Call ─────────────────────────────────────────────────

def cmd_call(args):
    """Call a named contract function (read-only)."""
    from eth_abi import encode
    from eth_utils import function_signature_to_4byte_selector

    sig = args.signature
    selector = "0x" + function_signature_to_4byte_selector(sig).hex()

    if args.args:
        param_types_str = sig[sig.index("(") + 1 : sig.rindex(")")]
        param_types = [t.strip() for t in param_types_str.split(",") if t.strip()]

        arg_values = []
        for t, v in zip(param_types, args.args):
            if t == "address":
                arg_values.append(v)
            elif t.startswith("uint") or t.startswith("int"):
                arg_values.append(int(v))
            elif t == "bool":
                arg_values.append(v.lower() in ("true", "1"))
            elif t.startswith("bytes"):
                arg_values.append(bytes.fromhex(v.replace("0x", "")))
            elif t == "string":
                arg_values.append(v)
            else:
                arg_values.append(v)

        encoded_args = encode(param_types, arg_values).hex()
        data = selector + encoded_args
    else:
        data = selector

    result = rpc_call(args.chain, "eth_call", [
        {"to": args.to, "data": data}, "latest"
    ])
    if "error" in result:
        out({"success": False, "error": result["error"]})
        return

    raw = result["result"]
    decoded = raw
    if args.returns:
        try:
            from eth_abi import decode as abi_decode
            ret_types = [t.strip() for t in args.returns.split(",")]
            decoded_values = abi_decode(ret_types, bytes.fromhex(raw[2:]))
            decoded = []
            for v in decoded_values:
                if isinstance(v, bytes):
                    decoded.append("0x" + v.hex())
                elif isinstance(v, int):
                    decoded.append(str(v))
                else:
                    decoded.append(v)
            if len(decoded) == 1:
                decoded = decoded[0]
        except Exception as e:
            decoded = {"raw": raw, "decode_error": str(e)}

    out({
        "success": True,
        "chain": args.chain,
        "function": sig,
        "raw_result": raw,
        "decoded": decoded,
    })


def cmd_eth_call(args):
    """Raw eth_call with hex calldata."""
    result = rpc_call(args.chain, "eth_call", [
        {"to": args.to, "data": args.data}, "latest"
    ])
    if "error" in result:
        out({"success": False, "error": result["error"]})
        return
    out({"success": True, "chain": args.chain, "result": result["result"]})


def cmd_get_code(args):
    """Get contract bytecode at an address."""
    result = rpc_call(args.chain, "eth_getCode", [args.address, "latest"])
    if "error" in result:
        out({"success": False, "error": result["error"]})
        return
    code = result.get("result", "0x")
    is_contract = code != "0x" and len(code) > 2
    out({
        "success": True,
        "chain": args.chain,
        "address": args.address,
        "is_contract": is_contract,
        "bytecode_length": len(code) // 2 - 1 if is_contract else 0,
        "bytecode": code[:202] + ("..." if len(code) > 202 else "") if is_contract else "0x",
    })


def cmd_get_storage(args):
    """Get storage slot value at a contract address."""
    slot = args.slot
    if not slot.startswith("0x"):
        slot = hex(int(slot))
    result = rpc_call(args.chain, "eth_getStorageAt", [args.address, slot, "latest"])
    if "error" in result:
        out({"success": False, "error": result["error"]})
        return
    out({
        "success": True,
        "chain": args.chain,
        "address": args.address,
        "slot": slot,
        "value": result["result"],
    })


# ─── Logs ──────────────────────────────────────────────────────────

def cmd_get_logs(args):
    """Get event logs by contract and optional topics."""
    params = {
        "address": args.address,
    }
    if args.from_block:
        params["fromBlock"] = hex(int(args.from_block))
    else:
        # Default: last 1000 blocks
        bn = rpc_call(args.chain, "eth_blockNumber")
        if "error" not in bn:
            latest = hex_to_int(bn["result"])
            params["fromBlock"] = hex(max(0, latest - 1000))
    if args.to_block:
        params["toBlock"] = hex(int(args.to_block))
    else:
        params["toBlock"] = "latest"

    if args.topic0:
        params["topics"] = [args.topic0]

    result = rpc_call(args.chain, "eth_getLogs", [params])
    if "error" in result:
        out({"success": False, "error": result["error"]})
        return

    logs = result.get("result", [])
    limit = args.limit
    out({
        "success": True,
        "chain": args.chain,
        "count": len(logs),
        "showing": min(len(logs), limit),
        "logs": [{
            "address": log.get("address"),
            "topics": log.get("topics", []),
            "data": log.get("data", "0x")[:202] + ("..." if len(log.get("data", "")) > 202 else ""),
            "block": hex_to_int(log.get("blockNumber", "0x0")),
            "tx_hash": log.get("transactionHash"),
            "log_index": hex_to_int(log.get("logIndex", "0x0")),
        } for log in logs[:limit]],
    })


# ─── ENS (Ethereum only) ──────────────────────────────────────────

def cmd_ens_resolve(args):
    """Resolve ENS name to address (Ethereum mainnet only)."""
    try:
        from eth_abi import encode, decode as abi_decode
        from eth_utils import keccak

        name = args.name
        # Namehash algorithm
        node = b'\x00' * 32
        for label in reversed(name.split('.')):
            label_hash = keccak(label.encode())
            node = keccak(node + label_hash)

        # Call resolver
        # addr(bytes32)
        sig = bytes.fromhex("3b3b57de")
        data = "0x" + sig.hex() + node.hex()

        # ENS registry: 0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e
        ens_registry = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e"

        # Get resolver for this name
        # resolver(bytes32)
        resolver_sig = "0x0178b8bf" + node.hex()
        resolver_result = rpc_call("ethereum", "eth_call", [
            {"to": ens_registry, "data": resolver_sig}, "latest"
        ])
        if "error" in resolver_result:
            out({"success": False, "error": resolver_result["error"]})
            return

        resolver_addr = "0x" + resolver_result["result"][-40:]
        if resolver_addr == "0x" + "0" * 40:
            out({"success": False, "error": f"No resolver found for {name}"})
            return

        # Call addr(bytes32) on resolver
        addr_result = rpc_call("ethereum", "eth_call", [
            {"to": resolver_addr, "data": data}, "latest"
        ])
        if "error" in addr_result:
            out({"success": False, "error": addr_result["error"]})
            return

        resolved = "0x" + addr_result["result"][-40:]
        if resolved == "0x" + "0" * 40:
            out({"success": False, "error": f"ENS name {name} not resolved"})
            return

        out({
            "success": True,
            "name": name,
            "address": resolved,
            "resolver": resolver_addr,
        })
    except ImportError:
        out({"success": False, "error": "eth_utils is required for ENS resolution"})


# ─── CLI Parser ────────────────────────────────────────────────────

def build_parser():
    parser = argparse.ArgumentParser(
        description="EVM RPC CLI — interact with any EVM chain",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--chain", "-c",
        choices=list(CHAINS.keys()),
        default=DEFAULT_CHAIN,
        help=f"Target chain (default: {DEFAULT_CHAIN})",
    )
    sub = parser.add_subparsers(dest="command", help="Command to run")

    # Chain info
    sub.add_parser("chains", help="List all supported chains")

    sub.add_parser("chain-info", help="Get chain info and latest block")

    # Network
    sub.add_parser("block-number", help="Get latest block number")
    sub.add_parser("gas-price", help="Get current gas price")

    p = sub.add_parser("block", help="Get block by number or 'latest'")
    p.add_argument("--block", default="latest", help="Block number or 'latest'")

    # Wallet
    sub.add_parser("create-wallet", help="Generate a new key pair")

    p = sub.add_parser("balance", help="Get native token balance")
    p.add_argument("--address", required=True)

    p = sub.add_parser("nonce", help="Get transaction count (nonce)")
    p.add_argument("--address", required=True)

    p = sub.add_parser("transfer", help="Send native token")
    p.add_argument("--to", required=True)
    p.add_argument("--amount", required=True, help="Amount in human units (e.g. 0.1)")
    p.add_argument("--private-key", required=True)

    p = sub.add_parser("transfer-token", help="Send ERC-20 tokens")
    p.add_argument("--token", required=True, help="Token contract address")
    p.add_argument("--to", required=True)
    p.add_argument("--amount", required=True, help="Amount in token units")
    p.add_argument("--private-key", required=True)

    # Transaction
    p = sub.add_parser("tx", help="Get transaction by hash")
    p.add_argument("--hash", required=True)

    p = sub.add_parser("tx-receipt", help="Get transaction receipt")
    p.add_argument("--hash", required=True)

    # Token
    p = sub.add_parser("token-info", help="Get ERC-20 token info")
    p.add_argument("--token", required=True, help="Token contract address")

    p = sub.add_parser("token-balance", help="Get ERC-20 token balance")
    p.add_argument("--token", required=True, help="Token contract address")
    p.add_argument("--address", required=True)

    # Contract
    p = sub.add_parser("call", help="Call a named contract function (read-only)")
    p.add_argument("--to", required=True, help="Contract address")
    p.add_argument("--signature", "-s", required=True, help='e.g. "balanceOf(address)"')
    p.add_argument("--args", nargs="*", help="Function arguments")
    p.add_argument("--returns", "-r", help='Return types, e.g. "uint256"')

    p = sub.add_parser("eth-call", help="Raw eth_call with hex calldata")
    p.add_argument("--to", required=True)
    p.add_argument("--data", required=True, help="Calldata (hex)")

    p = sub.add_parser("get-code", help="Get contract bytecode")
    p.add_argument("--address", required=True)

    p = sub.add_parser("get-storage", help="Get storage slot value")
    p.add_argument("--address", required=True)
    p.add_argument("--slot", required=True, help="Storage slot (decimal or hex)")

    # Logs
    p = sub.add_parser("get-logs", help="Get event logs")
    p.add_argument("--address", required=True)
    p.add_argument("--topic0", default=None, help="Event topic hash")
    p.add_argument("--from-block", default=None)
    p.add_argument("--to-block", default=None)
    p.add_argument("--limit", type=int, default=20)

    # ENS
    p = sub.add_parser("ens-resolve", help="Resolve ENS name to address")
    p.add_argument("--name", required=True, help="ENS name (e.g. vitalik.eth)")

    return parser


COMMANDS = {
    "chains": cmd_chains,
    "chain-info": cmd_chain_info,
    "block-number": cmd_block_number,
    "gas-price": cmd_gas_price,
    "block": cmd_block,
    "create-wallet": cmd_create_wallet,
    "balance": cmd_balance,
    "nonce": cmd_nonce,
    "transfer": cmd_transfer,
    "transfer-token": cmd_transfer_token,
    "tx": cmd_tx,
    "tx-receipt": cmd_tx_receipt,
    "token-info": cmd_token_info,
    "token-balance": cmd_token_balance,
    "call": cmd_call,
    "eth-call": cmd_eth_call,
    "get-code": cmd_get_code,
    "get-storage": cmd_get_storage,
    "get-logs": cmd_get_logs,
    "ens-resolve": cmd_ens_resolve,
}


def main():
    parser = build_parser()
    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(1)

    # Apply chain from args
    if hasattr(args, 'chain') and args.chain:
        pass  # already set

    fn = COMMANDS.get(args.command)
    if fn:
        fn(args)
    else:
        print(json.dumps({"error": f"Unknown command: {args.command}"}))
        sys.exit(1)


if __name__ == "__main__":
    main()
