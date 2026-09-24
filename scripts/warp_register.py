#!/usr/bin/env python3
"""Register a Cloudflare WARP account directly against the client API.

Used by .github/workflows/warp-register.yml as a fallback when warproxy's
built-in wgcf registration gets 429'd (common from datacenter IPv4 ranges).
Tries IPv6 first — different route, typically not rate-limited the same way.

Writes:
  .github/warp/wgcf-account.toml
  .github/warp/wgcf-profile.conf

which the fetch workflow mounts into warproxy so it never registers again.
"""
import base64
import datetime
import json
import subprocess
import sys
from pathlib import Path

try:
    from nacl.public import PrivateKey
except ImportError:
    sys.exit("pynacl not installed")

OUT = Path(__file__).resolve().parents[1] / ".github" / "warp"
REG_URL = "https://api.cloudflareclient.com/v0a2158/reg"


def b64(b: bytes) -> str:
    return base64.b64encode(b).decode()


def register(force_ipv6: bool):
    priv = PrivateKey.generate()
    priv_raw = priv.encode()
    pub_raw = priv.public_key.encode()
    body = json.dumps(
        {
            "key": b64(pub_raw),
            "install_id": "",
            "fcm_token": "",
            "tos": datetime.datetime.now(datetime.timezone.utc).strftime(
                "%Y-%m-%dT%H:%M:%S.000Z"
            ),
            "model": "PC",
            "serial_number": "",
            "locale": "en_US",
        }
    ).encode()
    curl = [
        "curl", "-sS", "--max-time", "15",
        "-6" if force_ipv6 else "-4",
        "-H", "Content-Type: application/json",
        "-H", "User-Agent: okhttp/3.12.1",
        "--data", "@-",
        REG_URL,
    ]
    try:
        p = subprocess.run(curl, input=body, capture_output=True, timeout=25)
    except subprocess.TimeoutExpired:
        print(f"ipv6={force_ipv6} curl timeout")
        return None, priv_raw, pub_raw
    out = p.stdout.decode(errors="replace")
    print(f"ipv6={force_ipv6} rc={p.returncode} body={out[:500]}", flush=True)
    if p.returncode != 0:
        print(f"curl stderr: {p.stderr.decode(errors='replace')[:300]}")
        return None, priv_raw, pub_raw
    try:
        data = json.loads(out)
    except json.JSONDecodeError:
        return None, priv_raw, pub_raw
    if "config" not in data or "id" not in data or "account" not in data:
        return None, priv_raw, pub_raw
    return data, priv_raw, pub_raw


def write_files(data, priv_raw: bytes, pub_raw: bytes) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "wgcf-account.toml").write_text(
        "[Account]\n"
        f'device_id = "{data["id"]}"\n'
        f'license_key = "{data["account"].get("license", "")}"\n'
        f"private_key = \"{b64(priv_raw)}\"\n"
        f"public_key = \"{b64(pub_raw)}\"\n"
    )
    addrs = data["config"]["interface"]["addresses"]
    peer = data["config"]["peer"]
    (OUT / "wgcf-profile.conf").write_text(
        "[Interface]\n"
        f"Address = {addrs['v4']}/32, {addrs['v6']}/128\n"
        f"PrivateKey = {b64(priv_raw)}\n"
        "DNS = 1.1.1.1\n"
        "[Peer]\n"
        f"PublicKey = {peer['public_key']}\n"
        "AllowedIPs = 0.0.0.0/0, ::/0\n"
        f"Endpoint = {peer.get('endpoint', 'engage.cloudflareclient.com:2408')}\n"
    )
    print(f"wrote {OUT}/wgcf-account.toml and wgcf-profile.conf", flush=True)


def main() -> int:
    for force6 in (True, False):
        data, priv_raw, pub_raw = register(force6)
        if data:
            write_files(data, priv_raw, pub_raw)
            return 0
    print("ALL_REGISTRATION_ATTEMPTS_FAILED", flush=True)
    return 1


if __name__ == "__main__":
    sys.exit(main())
