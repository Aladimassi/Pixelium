"""Shared FastAPI setup for Pixelium agent HTTP servers."""
from __future__ import annotations

from collections.abc import Callable
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


def create_agent_app(
    *,
    title: str,
    version: str = "0.2.0",
    on_startup: Callable[[], None] | None = None,
) -> FastAPI:
    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        if on_startup:
            on_startup()
        yield

    app = FastAPI(title=title, version=version, lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )
    return app


def service_root(
    *,
    service: str,
    port: int,
    message: str,
    skills: list[dict[str, str]] | None = None,
) -> dict[str, Any]:
    return {
        "service": service,
        "status": "ok",
        "port": port,
        "message": message,
        "endpoints": {
            "health": "/health",
            "invoke": "POST /invoke",
            "agentCard": "/.well-known/agent-card.json",
            "docs": "/docs",
            "openapi": "/openapi.json",
        },
        **({"skills": skills} if skills else {}),
    }


def health_payload(*, agent: str, port: int) -> dict[str, Any]:
    return {"status": "ok", "agent": agent, "port": port}


def agent_card(
    *,
    name: str,
    description: str,
    port: int,
    skills: list[dict[str, str]],
    version: str = "0.2.0",
) -> dict[str, Any]:
    return {
        "name": name,
        "description": description,
        "protocolVersion": "0.3.0",
        "version": version,
        "url": f"http://localhost:{port}/invoke",
        "skills": skills,
    }
