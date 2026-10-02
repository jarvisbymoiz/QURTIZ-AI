"""Project-only Graphify setup; never changes user-global Codex settings."""
import json
import os
from pathlib import Path
import subprocess
import venv

root = Path(__file__).resolve().parent.parent
environment = root / ".tools" / "graphify" / "venv"
python = environment / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
if not python.exists():
    venv.EnvBuilder(with_pip=True).create(environment)
subprocess.run([str(python), "-m", "pip", "install", "graphifyy[mcp,sql]==0.9.73"], check=True, cwd=root)
configuration = root / ".codex" / "config.toml"
if configuration.exists():
    print("Existing project Codex config preserved; check its graphify MCP entry.")
else:
    configuration.write_text(
        '# Project-local Graphify MCP; paths are specific to this checkout.\n'
        '[mcp_servers.graphify]\ncommand = "node"\n'
        f'args = {json.dumps([str(root / ".codex" / "graphify.mjs"), "serve"])}\n'
        f'cwd = {json.dumps(str(root))}\n'
        'enabled = true\nstartup_timeout_sec = 30\ntool_timeout_sec = 60\n'
        'enabled_tools = ["query_graph", "get_node", "get_neighbors", "shortest_path"]\n'
        '[mcp_servers.graphify.env]\nGRAPHIFY_QUERY_LOG_DISABLE = "1"\nPYTHONUTF8 = "1"\n'
        '[mcp_servers.graphify.tools.query_graph]\noutput_token_limit = 1500\n',
        encoding="utf-8",
    )
subprocess.run(["node", str(root / ".codex" / "graphify.mjs"), "extract", ".", "--code-only", "--max-workers", "4"], check=True, cwd=root)
