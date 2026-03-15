#!/usr/bin/env python3
"""Etherscan API CLI — fetch contracts, read on-chain data, decode ABIs."""

import argparse
import json
import os
import sys
import requests

API_KEY = os.environ.get("ETHERSCAN_API_KEY", "KKAYPEJVUA6N3WU8F3ZVSE21KU2ZCZ6QNA")

# V2 unified API endpoint
API_BASE = "https://api.etherscan.io/v2/api"

# Network name → chain ID mapping
CHAIN_IDS = {
    "ethereum": 1,
    "sepolia": 11155111,
    "polygon": 137,
    "bsc": 56,
    "arbitrum": 42161,
    "optimism": 10,
    "base": 8453,
    "avalanche": 43114,
    "linea": 59144,
    "scroll": 534352,
    "zksync": 324,
    "blast": 81457,
    "mantle": 5000,
    "celo": 42220,
    "gnosis": 100,
    "fantom": 250,
}

DEFAULT_NETWORK = os.environ.get("ETHERSCAN_NETWORK", "ethereum")


def call(params: dict) -> dict:
    params["apikey"] = API_KEY
    params["chainid"] = CHAIN_IDS.get(DEFAULT_NETWORK, 1)
    try:
        r = requests.get(API_BASE, params=params, timeout=30)
        r.raise_for_status()
        data = r.json()
        return data
    except Exception as e:
        return {"error": str(e)}


def out(data):
    print(json.dumps(data, indent=2, ensure_ascii=False))


# ─── Contract Commands ───────────────────────────────────────────────

def cmd_get_abi(args):
    """Fetch verified contract ABI from Etherscan."""
    result = call({
        "module": "contract",
        "action": "getabi",
        "address": args.address,
    })
    if result.get("status") == "1":
        abi = json.loads(result["result"])
        if args.save:
            fname = f"{args.address[:10]}_abi.json"
            with open(fname, "w") as f:
                json.dump(abi, f, indent=2)
            out({"success": True, "saved_to": fname, "functions": len(abi)})
        else:
            out({"success": True, "abi": abi})
    else:
        out({"success": False, "error": result.get("result", "Unknown error")})


def cmd_get_source(args):
    """Fetch verified contract source code."""
    result = call({
        "module": "contract",
        "action": "getsourcecode",
        "address": args.address,
    })
    if result.get("status") == "1" and result.get("result"):
        info = result["result"][0]
        source = info.get("SourceCode", "")

        # Handle Solidity standard JSON input format
        if source.startswith("{{"):
            source = source[1:-1]  # Remove outer braces
            try:
                source = json.loads(source)
            except json.JSONDecodeError:
                pass

        data = {
            "success": True,
            "contract_name": info.get("ContractName"),
            "compiler": info.get("CompilerVersion"),
            "optimization": info.get("OptimizationUsed"),
            "runs": info.get("Runs"),
            "evm_version": info.get("EVMVersion"),
            "license": info.get("LicenseType"),
            "proxy": info.get("Proxy"),
            "implementation": info.get("Implementation"),
        }

        if args.save:
            fname = f"{args.address[:10]}_source.json"
            with open(fname, "w") as f:
                json.dump({"source": source, **data}, f, indent=2, ensure_ascii=False)
            data["saved_to"] = fname
            data["source_length"] = len(str(source))
        else:
            data["source"] = source

        out(data)
    else:
        out({"success": False, "error": result.get("result", "Unknown error")})


def cmd_contract_creation(args):
    """Get contract creator address and creation tx."""
    result = call({
        "module": "contract",
        "action": "getcontractcreation",
        "contractaddresses": args.address,
    })
    if result.get("status") == "1":
        out({"success": True, "data": result["result"]})
    else:
        out({"success": False, "error": result.get("result", "Unknown error")})


# ─── Read Contract (eth_call) ────────────────────────────────────────

def cmd_eth_call(args):
    """Call a contract function (read-only, no gas)."""
    params = {
        "module": "proxy",
        "action": "eth_call",
        "to": args.to,
        "data": args.data,
        "tag": "latest",
    }
    result = call(params)
    if "result" in result and not result.get("error"):
        out({"success": True, "result": result["result"]})
    else:
        out({"success": False, "error": result.get("error", result)})


def cmd_call_function(args):
    """Call a named contract function using ABI encoding."""
    from eth_abi import encode
    from eth_utils import function_signature_to_4byte_selector

    # Build function signature
    sig = args.signature  # e.g. "balanceOf(address)"
    selector = "0x" + function_signature_to_4byte_selector(sig).hex()

    # Parse and encode arguments
    if args.args:
        # Parse types from signature
        param_types_str = sig[sig.index("(") + 1 : sig.rindex(")")]
        param_types = [t.strip() for t in param_types_str.split(",") if t.strip()]

        # Parse arg values
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

    params = {
        "module": "proxy",
        "action": "eth_call",
        "to": args.to,
        "data": data,
        "tag": "latest",
    }
    result = call(params)
    if "result" in result and not result.get("error"):
        raw = result["result"]

        # Try to decode return value
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
            "function": sig,
            "raw_result": raw,
            "decoded": decoded,
        })
    else:
        out({"success": False, "error": result.get("error", result)})


# ─── Account Commands ────────────────────────────────────────────────

def cmd_balance(args):
    """Get ETH balance for an address."""
    result = call({
        "module": "account",
        "action": "balance",
        "address": args.address,
        "tag": "latest",
    })
    if result.get("status") == "1":
        wei = int(result["result"])
        out({
            "success": True,
            "address": args.address,
            "balance_wei": str(wei),
            "balance_eth": f"{wei / 1e18:.6f}",
        })
    else:
        out({"success": False, "error": result.get("result", "Unknown error")})


def cmd_multi_balance(args):
    """Get ETH balance for multiple addresses."""
    addresses = args.addresses.split(",")
    result = call({
        "module": "account",
        "action": "balancemulti",
        "address": ",".join(addresses),
        "tag": "latest",
    })
    if result.get("status") == "1":
        balances = []
        for item in result["result"]:
            wei = int(item["balance"])
            balances.append({
                "address": item["account"],
                "balance_wei": str(wei),
                "balance_eth": f"{wei / 1e18:.6f}",
            })
        out({"success": True, "balances": balances})
    else:
        out({"success": False, "error": result.get("result", "Unknown error")})


def cmd_txlist(args):
    """Get transaction list for an address."""
    params = {
        "module": "account",
        "action": "txlist",
        "address": args.address,
        "startblock": args.start_block or "0",
        "endblock": args.end_block or "99999999",
        "page": "1",
        "offset": str(args.limit),
        "sort": args.sort,
    }
    result = call(params)
    if result.get("status") == "1":
        txs = result["result"]
        simplified = []
        for tx in txs:
            simplified.append({
                "hash": tx.get("hash"),
                "block": tx.get("blockNumber"),
                "from": tx.get("from"),
                "to": tx.get("to"),
                "value_eth": f"{int(tx.get('value', 0)) / 1e18:.6f}",
                "gas_used": tx.get("gasUsed"),
                "status": "success" if tx.get("txreceipt_status") == "1" else "failed",
                "function": tx.get("functionName", ""),
                "timestamp": tx.get("timeStamp"),
            })
        out({"success": True, "count": len(simplified), "transactions": simplified})
    else:
        out({"success": False, "error": result.get("result", "Unknown error")})


def cmd_token_txs(args):
    """Get ERC-20 token transfer events for an address."""
    params = {
        "module": "account",
        "action": "tokentx",
        "address": args.address,
        "page": "1",
        "offset": str(args.limit),
        "sort": "desc",
    }
    if args.contract:
        params["contractaddress"] = args.contract
    result = call(params)
    if result.get("status") == "1":
        transfers = []
        for tx in result["result"]:
            decimals = int(tx.get("tokenDecimal", 18))
            value = int(tx.get("value", 0))
            transfers.append({
                "hash": tx.get("hash"),
                "from": tx.get("from"),
                "to": tx.get("to"),
                "token": tx.get("tokenSymbol"),
                "token_name": tx.get("tokenName"),
                "contract": tx.get("contractAddress"),
                "value": f"{value / 10**decimals:.6f}",
                "timestamp": tx.get("timeStamp"),
            })
        out({"success": True, "count": len(transfers), "transfers": transfers})
    else:
        out({"success": False, "error": result.get("result", "Unknown error")})


# ─── Proxy / RPC Commands ───────────────────────────────────────────

def cmd_tx_receipt(args):
    """Get transaction receipt via RPC proxy."""
    result = call({
        "module": "proxy",
        "action": "eth_getTransactionReceipt",
        "txhash": args.hash,
    })
    if result.get("result"):
        receipt = result["result"]
        out({
            "success": True,
            "status": "success" if receipt.get("status") == "0x1" else "failed",
            "block": int(receipt.get("blockNumber", "0x0"), 16),
            "from": receipt.get("from"),
            "to": receipt.get("to"),
            "contract_address": receipt.get("contractAddress"),
            "gas_used": int(receipt.get("gasUsed", "0x0"), 16),
            "logs_count": len(receipt.get("logs", [])),
        })
    else:
        out({"success": False, "error": result.get("error", "Not found")})


def cmd_block_number(args):
    """Get latest block number."""
    result = call({"module": "proxy", "action": "eth_blockNumber"})
    if result.get("result"):
        block = int(result["result"], 16)
        out({"success": True, "block_number": block, "hex": result["result"]})
    else:
        out({"success": False, "error": result.get("error", "Unknown")})


def cmd_gas_price(args):
    """Get current gas price."""
    result = call({"module": "proxy", "action": "eth_gasPrice"})
    if result.get("result"):
        wei = int(result["result"], 16)
        out({
            "success": True,
            "gas_price_wei": str(wei),
            "gas_price_gwei": f"{wei / 1e9:.2f}",
        })
    else:
        out({"success": False, "error": result.get("error", "Unknown")})


# ─── Token Info Commands ─────────────────────────────────────────────

def cmd_token_supply(args):
    """Get total supply of an ERC-20 token."""
    result = call({
        "module": "stats",
        "action": "tokensupply",
        "contractaddress": args.contract,
    })
    if result.get("status") == "1":
        raw = int(result["result"])
        decimals = args.decimals
        out({
            "success": True,
            "contract": args.contract,
            "total_supply_raw": str(raw),
            "total_supply": f"{raw / 10**decimals:.4f}",
            "decimals_used": decimals,
        })
    else:
        out({"success": False, "error": result.get("result", "Unknown error")})


def cmd_token_balance(args):
    """Get ERC-20 token balance for an address."""
    result = call({
        "module": "account",
        "action": "tokenbalance",
        "contractaddress": args.contract,
        "address": args.address,
        "tag": "latest",
    })
    if result.get("status") == "1":
        raw = int(result["result"])
        decimals = args.decimals
        out({
            "success": True,
            "address": args.address,
            "contract": args.contract,
            "balance_raw": str(raw),
            "balance": f"{raw / 10**decimals:.6f}",
            "decimals_used": decimals,
        })
    else:
        out({"success": False, "error": result.get("result", "Unknown error")})


# ─── Logs ─────────────────────────────────────────────────────────────

def cmd_get_logs(args):
    """Get event logs by address and topic."""
    params = {
        "module": "logs",
        "action": "getLogs",
        "address": args.address,
        "fromBlock": args.from_block or "0",
        "toBlock": args.to_block or "latest",
        "page": "1",
        "offset": str(args.limit),
    }
    if args.topic0:
        params["topic0"] = args.topic0
    result = call(params)
    if result.get("status") == "1":
        logs = result["result"]
        out({"success": True, "count": len(logs), "logs": logs[:20]})
    else:
        out({"success": False, "error": result.get("result", "Unknown error")})


# ─── CLI Parser ──────────────────────────────────────────────────────

def build_parser():
    parser = argparse.ArgumentParser(
        description="Etherscan API CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--network", "-n",
        choices=CHAIN_IDS.keys(),
        default=DEFAULT_NETWORK,
        help="Target network (default: ethereum)",
    )
    sub = parser.add_subparsers(dest="command", help="Command to run")

    # Contract
    p = sub.add_parser("get-abi", help="Fetch contract ABI")
    p.add_argument("--address", required=True)
    p.add_argument("--save", action="store_true", help="Save ABI to file")

    p = sub.add_parser("get-source", help="Fetch contract source code")
    p.add_argument("--address", required=True)
    p.add_argument("--save", action="store_true", help="Save source to file")

    p = sub.add_parser("contract-creation", help="Get contract creator and creation tx")
    p.add_argument("--address", required=True)

    # Read contract
    p = sub.add_parser("eth-call", help="Raw eth_call to contract")
    p.add_argument("--to", required=True, help="Contract address")
    p.add_argument("--data", required=True, help="Calldata (hex)")

    p = sub.add_parser("call", help="Call a named contract function")
    p.add_argument("--to", required=True, help="Contract address")
    p.add_argument("--signature", "-s", required=True, help='Function signature, e.g. "balanceOf(address)"')
    p.add_argument("--args", nargs="*", help="Function arguments")
    p.add_argument("--returns", "-r", help='Return types, e.g. "uint256"')

    # Account
    p = sub.add_parser("balance", help="Get ETH balance")
    p.add_argument("--address", required=True)

    p = sub.add_parser("multi-balance", help="Get ETH balance for multiple addresses")
    p.add_argument("--addresses", required=True, help="Comma-separated addresses")

    p = sub.add_parser("txlist", help="Get transaction list")
    p.add_argument("--address", required=True)
    p.add_argument("--limit", type=int, default=10)
    p.add_argument("--sort", choices=["asc", "desc"], default="desc")
    p.add_argument("--start-block", default=None)
    p.add_argument("--end-block", default=None)

    p = sub.add_parser("token-txs", help="Get ERC-20 token transfers")
    p.add_argument("--address", required=True)
    p.add_argument("--contract", default=None, help="Filter by token contract")
    p.add_argument("--limit", type=int, default=10)

    # Proxy / RPC
    p = sub.add_parser("tx-receipt", help="Get transaction receipt")
    p.add_argument("--hash", required=True)

    sub.add_parser("block-number", help="Get latest block number")
    sub.add_parser("gas-price", help="Get current gas price")

    # Token
    p = sub.add_parser("token-supply", help="Get total supply of ERC-20 token")
    p.add_argument("--contract", required=True)
    p.add_argument("--decimals", type=int, default=18)

    p = sub.add_parser("token-balance", help="Get ERC-20 token balance")
    p.add_argument("--contract", required=True)
    p.add_argument("--address", required=True)
    p.add_argument("--decimals", type=int, default=18)

    # Logs
    p = sub.add_parser("get-logs", help="Get event logs")
    p.add_argument("--address", required=True)
    p.add_argument("--topic0", default=None, help="Event topic hash")
    p.add_argument("--from-block", default=None)
    p.add_argument("--to-block", default=None)
    p.add_argument("--limit", type=int, default=10)

    return parser


COMMANDS = {
    "get-abi": cmd_get_abi,
    "get-source": cmd_get_source,
    "contract-creation": cmd_contract_creation,
    "eth-call": cmd_eth_call,
    "call": cmd_call_function,
    "balance": cmd_balance,
    "multi-balance": cmd_multi_balance,
    "txlist": cmd_txlist,
    "token-txs": cmd_token_txs,
    "tx-receipt": cmd_tx_receipt,
    "block-number": cmd_block_number,
    "gas-price": cmd_gas_price,
    "token-supply": cmd_token_supply,
    "token-balance": cmd_token_balance,
    "get-logs": cmd_get_logs,
}


def main():
    parser = build_parser()
    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(1)

    # Apply network override
    global DEFAULT_NETWORK
    if args.network:
        DEFAULT_NETWORK = args.network

    fn = COMMANDS.get(args.command)
    if fn:
        fn(args)
    else:
        print(json.dumps({"error": f"Unknown command: {args.command}"}))
        sys.exit(1)


if __name__ == "__main__":
    main()
