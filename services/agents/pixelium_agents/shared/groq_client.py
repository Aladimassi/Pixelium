"""Minimal Groq JSON chat client (stdlib only — no extra deps)."""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from typing import Any


def is_groq_configured() -> bool:
    return bool(os.getenv("GROQ_API_KEY", "").strip())


def _models() -> list[str]:
    primary = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile").strip()
    fallback = "llama-3.1-8b-instant"
    return [m for m in [primary, fallback] if m]


def groq_json_completion(
    system: str,
    user: str,
    *,
    temperature: float = 0.35,
) -> dict[str, Any] | None:
    """Return parsed JSON object from Groq, or None if unavailable / failed."""
    api_key = os.getenv("GROQ_API_KEY", "").strip()
    if not api_key:
        return None

    body_base = {
        "temperature": temperature,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    }

    last_error = ""
    for model in _models():
        payload = json.dumps({**body_base, "model": model}).encode("utf-8")
        req = urllib.request.Request(
            "https://api.groq.com/openai/v1/chat/completions",
            data=payload,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=25) as res:
                data = json.loads(res.read().decode("utf-8"))
            content = data.get("choices", [{}])[0].get("message", {}).get("content") or "{}"
            parsed = json.loads(content)
            if isinstance(parsed, dict):
                return parsed
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, KeyError) as err:
            last_error = str(err)
            continue

    if last_error:
        print(f"[groq_client] all models failed: {last_error[:120]}")
    return None
