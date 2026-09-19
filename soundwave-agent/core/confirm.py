"""
Soundwave AI — Confirmation Gate
Safety system requiring explicit user confirmation before executing destructive operations.
"""

import time
import secrets
from typing import Dict, Any, Optional

class ConfirmationGate:
    def __init__(self, timeout_seconds: int = 60):
        self.pending: Dict[str, Dict[str, Any]] = {}
        self.timeout = timeout_seconds

    def request(self, action_name: str, details: str, payload: Any) -> str:
        """Create a pending confirmation token."""
        token = secrets.token_hex(4).upper()
        self.pending[token] = {
            "action": action_name,
            "details": details,
            "payload": payload,
            "created_at": time.time(),
        }
        return token

    def verify(self, token: str) -> Optional[Dict[str, Any]]:
        """Verify and consume a confirmation token."""
        clean_token = token.strip().upper()
        if clean_token not in self.pending:
            return None

        entry = self.pending.pop(clean_token)
        if time.time() - entry["created_at"] > self.timeout:
            return None
        return entry

    def cancel(self, token: str) -> bool:
        return self.pending.pop(token.strip().upper(), None) is not None

confirmation_gate = ConfirmationGate()
