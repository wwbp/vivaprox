import os
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

_BASE_ENV_PATH = Path(__file__).resolve().parent / ".env.connector"
_LOCAL_ENV_PATH = Path(__file__).resolve().parent / ".env.connector.local"

if _BASE_ENV_PATH.exists():
    load_dotenv(_BASE_ENV_PATH)
if _LOCAL_ENV_PATH.exists():
    load_dotenv(_LOCAL_ENV_PATH, override=True)


@dataclass(frozen=True)
class Config:
    connector_mode: str
    join_delay_ms: int
    worker_join_command: Optional[str]
    worker_leave_command: Optional[str]
    worker_stop_grace_secs: float


def load_config() -> Config:
    mode_raw = os.getenv("ZOOM_CONNECTOR_MODE", "mock").strip().lower()
    connector_mode = mode_raw if mode_raw in {"mock", "process"} else "mock"

    delay_raw = os.getenv("ZOOM_JOIN_DELAY_MS", "0")
    try:
        delay_ms = int(delay_raw)
    except ValueError:
        delay_ms = 0

    stop_grace_raw = os.getenv("ZOOM_WORKER_STOP_GRACE_SECS", "8")
    try:
        stop_grace_secs = float(stop_grace_raw)
    except ValueError:
        stop_grace_secs = 8.0

    return Config(
        connector_mode=connector_mode,
        join_delay_ms=max(delay_ms, 0),
        worker_join_command=os.getenv("ZOOM_WORKER_JOIN_COMMAND"),
        worker_leave_command=os.getenv("ZOOM_WORKER_LEAVE_COMMAND"),
        worker_stop_grace_secs=max(stop_grace_secs, 1.0),
    )


def require(value: Optional[str], name: str) -> str:
    if not value or not value.strip():
        raise ValueError(f"Missing required environment variable: {name}")
    return value
