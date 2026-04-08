"""Startup wrapper that catches import errors and provides diagnostics."""
import sys
import os

try:
    import uvicorn
except ImportError as e:
    print(f"FATAL: Cannot import uvicorn: {e}", file=sys.stderr)
    sys.exit(1)

try:
    from main import app
except Exception as e:
    print(f"FATAL: Cannot import main app: {e}", file=sys.stderr)
    import traceback
    traceback.print_exc()
    sys.exit(1)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    print(f"Starting TAI-AEGIS API on port {port}")
    uvicorn.run(app, host="0.0.0.0", port=port)
