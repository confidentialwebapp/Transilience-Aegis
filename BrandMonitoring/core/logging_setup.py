"""Rich-styled logging."""
from __future__ import annotations

import logging
import os

from rich.logging import RichHandler


def configure_logging(level: str | None = None) -> None:
    lvl = (level or os.getenv("LOG_LEVEL") or "INFO").upper()
    logging.basicConfig(
        level=getattr(logging, lvl, logging.INFO),
        format="%(message)s",
        datefmt="[%X]",
        handlers=[RichHandler(rich_tracebacks=True, show_path=False, markup=True)],
        force=True,
    )
    # Quiet noisy libraries
    for noisy in ("httpx", "httpcore", "urllib3", "asyncio", "PIL", "fontTools", "weasyprint"):
        logging.getLogger(noisy).setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)
