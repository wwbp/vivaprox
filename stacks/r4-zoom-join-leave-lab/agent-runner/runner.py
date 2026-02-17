import asyncio
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger

from config import load_config, require
from runner_types import BotListResponse, BotSession, JoinBotRequest, JoinResponse

config = load_config()


class BotRegistry:
    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._sessions: dict[str, BotSession] = {}

    async def list(self) -> list[BotSession]:
        async with self._lock:
            sessions = list(self._sessions.values())

        active = [session for session in sessions if session.state == "joined"]
        return sorted(active, key=lambda item: item.started_at, reverse=True)

    async def add(self, session: BotSession) -> None:
        async with self._lock:
            self._sessions[session.bot_id] = session

    async def get(self, bot_id: str) -> Optional[BotSession]:
        async with self._lock:
            return self._sessions.get(bot_id)

    async def mark_left(self, bot_id: str, left_at: str) -> BotSession:
        async with self._lock:
            session = self._sessions.get(bot_id)
            if not session:
                raise KeyError(bot_id)
            if session.state == "left":
                return session
            updated = session.model_copy(update={"state": "left", "left_at": left_at})
            self._sessions[bot_id] = updated
            return updated


class ZoomClientAdapter:
    async def join(self, bot_id: str, request: JoinBotRequest) -> Optional[str]:
        raise NotImplementedError

    async def leave(self, session: BotSession) -> None:
        raise NotImplementedError


class StubZoomClientAdapter(ZoomClientAdapter):
    async def join(self, bot_id: str, request: JoinBotRequest) -> Optional[str]:
        logger.info("stub join: bot_id={} meeting_url={}", bot_id, request.meeting_url)
        return bot_id

    async def leave(self, session: BotSession) -> None:
        logger.info("stub leave: bot_id={} meeting_url={}", session.bot_id, session.meeting_url)


class WebhookZoomClientAdapter(ZoomClientAdapter):
    def __init__(
        self,
        join_endpoint: str,
        leave_endpoint: str,
        token: Optional[str],
        timeout_secs: float,
    ) -> None:
        self.join_endpoint = join_endpoint
        self.leave_endpoint = leave_endpoint
        self.token = token
        self.timeout_secs = timeout_secs

    def _headers(self) -> dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        return headers

    async def _post_json(self, url: str, payload: dict[str, Any]) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=self.timeout_secs) as client:
            response = await client.post(url, json=payload, headers=self._headers())

        if not response.is_success:
            message = response.text.strip()
            raise RuntimeError(
                f"Zoom webhook call failed ({response.status_code})"
                + (f": {message}" if message else "")
            )

        if not response.text:
            return {}

        try:
            data = response.json()
        except ValueError as error:
            raise RuntimeError(f"Zoom webhook returned non-JSON response: {response.text}") from error

        if isinstance(data, dict):
            return data
        return {}

    async def join(self, bot_id: str, request: JoinBotRequest) -> Optional[str]:
        payload = {
            "bot_id": bot_id,
            "meeting_url": request.meeting_url,
            "meeting_id": request.meeting_id,
        }
        data = await self._post_json(self.join_endpoint, payload)

        external_session_id = data.get("session_id")
        if isinstance(external_session_id, str) and external_session_id.strip():
            return external_session_id
        external_bot_id = data.get("bot_id")
        if isinstance(external_bot_id, str) and external_bot_id.strip():
            return external_bot_id
        return None

    async def leave(self, session: BotSession) -> None:
        payload = {
            "bot_id": session.bot_id,
            "external_session_id": session.external_session_id,
            "meeting_url": session.meeting_url,
            "meeting_id": session.meeting_id,
        }
        await self._post_json(self.leave_endpoint, payload)


def to_timestamp() -> str:
    return datetime.now(timezone.utc).isoformat()


def create_zoom_adapter() -> ZoomClientAdapter:
    if config.zoom_client_mode == "webhook":
        return WebhookZoomClientAdapter(
            join_endpoint=require(config.zoom_join_endpoint, "ZOOM_JOIN_ENDPOINT"),
            leave_endpoint=require(config.zoom_leave_endpoint, "ZOOM_LEAVE_ENDPOINT"),
            token=config.zoom_api_token,
            timeout_secs=config.zoom_request_timeout_secs,
        )

    return StubZoomClientAdapter()


def create_app() -> FastAPI:
    app = FastAPI(title="Zoom Join/Leave Agent Runner")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    return app


app = create_app()
registry = BotRegistry()
zoom_adapter = create_zoom_adapter()


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "healthy", "service": "zoom-join-leave-runner", "mode": config.zoom_client_mode}


@app.get("/bots", response_model=BotListResponse)
async def list_bots() -> BotListResponse:
    sessions = await registry.list()
    return BotListResponse(bots=sessions)


@app.post("/bots/join", response_model=JoinResponse)
async def join_bot(request: JoinBotRequest) -> JoinResponse:
    bot_id = f"bot_{uuid.uuid4().hex[:8]}"
    started_at = to_timestamp()

    try:
        external_session_id = await zoom_adapter.join(bot_id, request)
    except Exception as error:
        logger.error("failed to join meeting bot_id={} meeting_url={} error={}", bot_id, request.meeting_url, error)
        raise HTTPException(status_code=502, detail=str(error)) from error

    session = BotSession(
        bot_id=bot_id,
        state="joined",
        meeting_url=request.meeting_url,
        meeting_id=request.meeting_id,
        started_at=started_at,
        external_session_id=external_session_id,
    )

    await registry.add(session)
    logger.info("joined meeting bot_id={} meeting_url={}", bot_id, request.meeting_url)
    return JoinResponse(bot=session)


@app.post("/bots/{bot_id}/leave", response_model=JoinResponse)
async def leave_bot(bot_id: str) -> JoinResponse:
    session = await registry.get(bot_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Bot session not found: {bot_id}")

    if session.state == "left":
        return JoinResponse(bot=session)

    try:
        await zoom_adapter.leave(session)
    except Exception as error:
        logger.error("failed to leave meeting bot_id={} meeting_url={} error={}", bot_id, session.meeting_url, error)
        raise HTTPException(status_code=502, detail=str(error)) from error

    left = await registry.mark_left(bot_id, to_timestamp())
    logger.info("left meeting bot_id={} meeting_url={}", bot_id, left.meeting_url)
    return JoinResponse(bot=left)


if __name__ == "__main__":
    import uvicorn

    logger.info("Starting Zoom Join/Leave Agent Runner")
    logger.info("ZOOM_CLIENT_MODE={}", config.zoom_client_mode)
    uvicorn.run(app, host="0.0.0.0", port=7860)
