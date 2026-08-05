#!/usr/bin/env python3
"""Start Payment Agent HTTP server on port 4002."""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

import uvicorn
from pixelium_agents.servers.payment_server import PORT, app

if __name__ == "__main__":
    print(f"Payment Agent (LangGraph) on http://localhost:{PORT}")
    uvicorn.run(app, host="0.0.0.0", port=PORT, log_level="info")
