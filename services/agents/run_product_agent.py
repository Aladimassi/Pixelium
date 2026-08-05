#!/usr/bin/env python3
"""Start Product Agent HTTP server on port 4001."""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

import uvicorn
from pixelium_agents.servers.product_server import PORT, app

if __name__ == "__main__":
    print(f"Product Agent (LangGraph) on http://localhost:{PORT}")
    uvicorn.run(app, host="0.0.0.0", port=PORT, log_level="info")
