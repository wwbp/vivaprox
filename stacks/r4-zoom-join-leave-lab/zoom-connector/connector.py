import asyncio
import shlex
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Optional

from fastapi import FastAPI, HTTPException
from loguru import logger

from config import load_config, require
from connector_types import JoinRequest, JoinResponse, LeaveRequest, LeaveResponse, SessionRecord, SessionsResponse
from meeting_target import parse_zoom_meeting_target

config = load_config()


class SessionStore:
    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._by_bot_id: dict[str, SessionRecord] = {}

    async def list_active(self) -> list[SessionRecord]:
        async with self._lock:
            values = list(self._by_bot_id.values())
        active = [session for session in values if session.status == "joined"]
        return sorted(active, key=lambda item: item.joined_at, reverse=True)

    async def get(self, bot_id: str) -> Optional[SessionRecord]:
        async with self._lock:
            return self._by_bot_id.get(bot_id)

    async def join(
        self,
        bot_id: str,
        meeting_url: str,
        meeting_id: Optional[str],
        *,
        session_id: Optional[str] = None,
        worker_pid: Optional[int] = None,
    ) -> SessionRecord:
        async with self._lock:
            existing = self._by_bot_id.get(bot_id)
            if existing and existing.status == "joined":
                return existing

            session = SessionRecord(
                session_id=session_id or f"zoom_session_{uuid.uuid4().hex[:12]}",
                bot_id=bot_id,
                meeting_url=meeting_url,
                meeting_id=meeting_id,
                worker_pid=worker_pid,
                status="joined",
                joined_at=utc_now(),
            )
            self._by_bot_id[bot_id] = session
            return session

    async def leave(self, bot_id: str) -> SessionRecord:
        async with self._lock:
            existing = self._by_bot_id.get(bot_id)
            if not existing:
                raise KeyError(bot_id)
            if existing.status == "left":
                return existing

            left = existing.model_copy(update={"status": "left", "left_at": utc_now()})
            self._by_bot_id[bot_id] = left
            return left


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


class ProcessWorkerManager:
    def __init__(
        self,
        join_command_template: str,
        leave_command_template: Optional[str],
        stop_grace_secs: float,
    ) -> None:
        self.join_command_template = join_command_template
        self.leave_command_template = leave_command_template
        self.stop_grace_secs = stop_grace_secs
        self._lock = asyncio.Lock()
        self._by_bot_id: dict[str, asyncio.subprocess.Process] = {}

    def _render(
        self,
        template: str,
        *,
        bot_id: str,
        meeting_url: str,
        meeting_id: Optional[str],
        meeting_number: Optional[str],
        meeting_passcode: Optional[str],
        session_id: str,
    ) -> str:
        values = {
            "bot_id": shlex.quote(bot_id),
            "meeting_url": shlex.quote(meeting_url),
            "meeting_id": shlex.quote(meeting_id or ""),
            "meeting_number": shlex.quote(meeting_number or ""),
            "meeting_passcode": shlex.quote(meeting_passcode or ""),
            "session_id": shlex.quote(session_id),
        }
        try:
            return template.format(**values)
        except KeyError as error:
            missing = error.args[0]
            raise RuntimeError(f"Unknown placeholder {{{missing}}} in command template") from error

    async def start(
        self,
        *,
        bot_id: str,
        meeting_url: str,
        meeting_id: Optional[str],
        meeting_number: Optional[str],
        meeting_passcode: Optional[str],
        session_id: str,
    ) -> Optional[int]:
        command = self._render(
            self.join_command_template,
            bot_id=bot_id,
            meeting_url=meeting_url,
            meeting_id=meeting_id,
            meeting_number=meeting_number,
            meeting_passcode=meeting_passcode,
            session_id=session_id,
        )
        process = await asyncio.create_subprocess_shell(command)
        await asyncio.sleep(0.15)

        if process.returncode is not None:
            raise RuntimeError(
                f"worker join process exited immediately with code {process.returncode} for bot_id={bot_id}"
            )

        async with self._lock:
            self._by_bot_id[bot_id] = process
        return process.pid

    async def _terminate_process(self, bot_id: str, process: asyncio.subprocess.Process) -> None:
        if process.returncode is not None:
            return
        process.terminate()
        try:
            await asyncio.wait_for(process.wait(), timeout=self.stop_grace_secs)
        except TimeoutError:
            logger.warning("worker timeout on terminate, forcing kill bot_id={} pid={}", bot_id, process.pid)
            process.kill()
            await process.wait()

    async def stop(
        self,
        *,
        bot_id: str,
        meeting_url: str,
        meeting_id: Optional[str],
        meeting_number: Optional[str],
        meeting_passcode: Optional[str],
        session_id: str,
    ) -> None:
        process: Optional[asyncio.subprocess.Process]
        async with self._lock:
            process = self._by_bot_id.pop(bot_id, None)

        if self.leave_command_template:
            command = self._render(
                self.leave_command_template,
                bot_id=bot_id,
                meeting_url=meeting_url,
                meeting_id=meeting_id,
                meeting_number=meeting_number,
                meeting_passcode=meeting_passcode,
                session_id=session_id,
            )
            hook = await asyncio.create_subprocess_shell(command)
            code = await hook.wait()
            if code != 0:
                raise RuntimeError(f"worker leave hook failed with code {code} for bot_id={bot_id}")

        if process:
            await self._terminate_process(bot_id, process)

    async def stop_all(self) -> None:
        async with self._lock:
            processes = list(self._by_bot_id.items())
            self._by_bot_id.clear()

        for bot_id, process in processes:
            await self._terminate_process(bot_id, process)


store = SessionStore()
worker_manager: Optional[ProcessWorkerManager] = None

if config.connector_mode == "process":
    worker_manager = ProcessWorkerManager(
        join_command_template=require(config.worker_join_command, "ZOOM_WORKER_JOIN_COMMAND"),
        leave_command_template=config.worker_leave_command,
        stop_grace_secs=config.worker_stop_grace_secs,
    )


@asynccontextmanager
async def lifespan(_app: FastAPI):
    yield
    if worker_manager:
        await worker_manager.stop_all()


app = FastAPI(title="Zoom Connector", lifespan=lifespan)


@app.get("/health")
async def health() -> dict[str, str]:
    response: dict[str, str] = {"status": "healthy", "service": "zoom-connector", "mode": config.connector_mode}
    if config.connector_mode == "process":
        response["join_command"] = "configured" if bool(config.worker_join_command) else "missing"
    return response


@app.get("/sessions", response_model=SessionsResponse)
async def list_sessions() -> SessionsResponse:
    sessions = await store.list_active()
    return SessionsResponse(sessions=sessions)


@app.post("/join", response_model=JoinResponse)
async def join(payload: JoinRequest) -> JoinResponse:
    if config.join_delay_ms:
        await asyncio.sleep(config.join_delay_ms / 1000)

    session_id = f"zoom_session_{uuid.uuid4().hex[:12]}"
    target = parse_zoom_meeting_target(payload.meeting_url, payload.meeting_id)
    worker_pid: Optional[int] = None
    if worker_manager:
        try:
            worker_pid = await worker_manager.start(
                bot_id=payload.bot_id,
                meeting_url=payload.meeting_url,
                meeting_id=payload.meeting_id,
                meeting_number=target.meeting_number,
                meeting_passcode=target.meeting_passcode,
                session_id=session_id,
            )
        except Exception as error:
            logger.error(
                "process join failed bot_id={} meeting_url={} error={}",
                payload.bot_id,
                payload.meeting_url,
                error,
            )
            raise HTTPException(status_code=502, detail=str(error)) from error

    session = await store.join(
        bot_id=payload.bot_id,
        meeting_url=payload.meeting_url,
        meeting_id=payload.meeting_id,
        session_id=session_id,
        worker_pid=worker_pid,
    )

    logger.info(
        "join accepted mode={} bot_id={} session_id={} meeting_url={} meeting_number={} worker_pid={}",
        config.connector_mode,
        session.bot_id,
        session.session_id,
        session.meeting_url,
        target.meeting_number,
        session.worker_pid,
    )

    return JoinResponse(session_id=session.session_id, bot_id=session.bot_id, status="joined")


@app.post("/leave", response_model=LeaveResponse)
async def leave(payload: LeaveRequest) -> LeaveResponse:
    existing = await store.get(payload.bot_id)
    if not existing:
        raise HTTPException(status_code=404, detail=f"session not found for bot_id={payload.bot_id}")

    if existing.status == "left":
        return LeaveResponse(session_id=existing.session_id, bot_id=existing.bot_id, status="left")

    if worker_manager:
        hook_session_id = payload.external_session_id or existing.session_id
        hook_meeting_url = payload.meeting_url or existing.meeting_url
        hook_meeting_id = payload.meeting_id or existing.meeting_id
        target = parse_zoom_meeting_target(hook_meeting_url, hook_meeting_id)
        try:
            await worker_manager.stop(
                bot_id=existing.bot_id,
                meeting_url=hook_meeting_url,
                meeting_id=hook_meeting_id,
                meeting_number=target.meeting_number,
                meeting_passcode=target.meeting_passcode,
                session_id=hook_session_id,
            )
        except Exception as error:
            logger.error(
                "process leave failed bot_id={} session_id={} meeting_url={} error={}",
                existing.bot_id,
                hook_session_id,
                hook_meeting_url,
                error,
            )
            raise HTTPException(status_code=502, detail=str(error)) from error

    try:
        session = await store.leave(payload.bot_id)
    except KeyError as error:
        raise HTTPException(status_code=404, detail=f"session not found for bot_id={payload.bot_id}") from error

    logger.info(
        "leave accepted mode={} bot_id={} session_id={} meeting_url={}",
        config.connector_mode,
        session.bot_id,
        session.session_id,
        session.meeting_url,
    )

    return LeaveResponse(session_id=session.session_id, bot_id=session.bot_id, status="left")


if __name__ == "__main__":
    import uvicorn

    logger.info("Starting Zoom Connector mode={}", config.connector_mode)
    uvicorn.run(app, host="0.0.0.0", port=8787)
