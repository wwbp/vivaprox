import os
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

_BASE_ENV_PATH = Path(__file__).resolve().parent / ".env.runner"
_LOCAL_ENV_PATH = Path(__file__).resolve().parent / ".env.runner.local"

if _BASE_ENV_PATH.exists():
    load_dotenv(_BASE_ENV_PATH)
if _LOCAL_ENV_PATH.exists():
    load_dotenv(_LOCAL_ENV_PATH, override=True)


@dataclass(frozen=True)
class Config:
    zoom_client_mode: str
    zoom_join_endpoint: Optional[str]
    zoom_leave_endpoint: Optional[str]
    zoom_api_token: Optional[str]
    zoom_request_timeout_secs: float


def load_config() -> Config:
    timeout_raw = os.getenv("ZOOM_REQUEST_TIMEOUT_SECS", "10")
    try:
        timeout_secs = float(timeout_raw)
    except ValueError:
        timeout_secs = 10.0

    return Config(
        zoom_client_mode=os.getenv("ZOOM_CLIENT_MODE", "stub").strip().lower(),
        zoom_join_endpoint=os.getenv("ZOOM_JOIN_ENDPOINT"),
        zoom_leave_endpoint=os.getenv("ZOOM_LEAVE_ENDPOINT"),
        zoom_api_token=os.getenv("ZOOM_API_TOKEN"),
        zoom_request_timeout_secs=max(timeout_secs, 1.0),
    )


def require(value: Optional[str], name: str) -> str:
    if not value:
        raise ValueError(f"Missing required environment variable: {name}")
    return value
