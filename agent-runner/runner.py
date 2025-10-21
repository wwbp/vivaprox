#!/usr/bin/env python3
"""
Minimal LiveKit Runner for Pipecat Bots

A lightweight FastAPI server for LiveKit transport. Creates rooms, generates tokens,
and spawns Pipecat bots as participants.

Usage:
    python runner.py

Environment Variables:
    LIVEKIT_URL       - LiveKit server URL (wss://your-server.livekit.cloud)
    LIVEKIT_API_KEY   - LiveKit API key
    LIVEKIT_API_SECRET - LiveKit API secret
"""

import argparse
import asyncio
import os
import sys
import uuid
from contextlib import asynccontextmanager
from dataclasses import dataclass
from typing import Any, Dict, Optional

import uvicorn
from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger

# Import LiveKit SDK
try:
    from livekit import api
except ImportError:
    logger.error("LiveKit SDK not installed")
    logger.error("Install with: pip install livekit-api")
    sys.exit(1)

# Import Pipecat base types
from pipecat.runner.types import RunnerArguments

load_dotenv(override=True)


@dataclass
class LiveKitRunnerArguments(RunnerArguments):
    """Arguments passed to bot when using LiveKit transport.

    Attributes:
        room_name: Name of the LiveKit room
        participant_token: JWT token for room access
        livekit_url: LiveKit server WebSocket URL
        body: Optional request body data passed from client
    """
    room_name: str
    participant_token: str
    livekit_url: str
    body: Optional[Dict[str, Any]] = None


def get_bot_module():
    """Discover and load the bot module containing bot() function."""
    import importlib.util
    from pathlib import Path

    # Check main module first
    main_module = sys.modules.get("__main__")
    if main_module and hasattr(main_module, "bot"):
        logger.debug("Found bot() in __main__")
        return main_module

    # Try importing 'bot' module directly
    try:
        import bot
        logger.debug("Found bot() in bot.py")
        return bot
    except ImportError:
        pass

    # Search current directory for Python files with bot() function
    cwd = Path.cwd()
    for py_file in cwd.glob("*.py"):
        # Skip this runner file
        if py_file.name in ("runner.py", "server.py"):
            continue

        try:
            spec = importlib.util.spec_from_file_location(
                py_file.stem, py_file)
            if spec and spec.loader:
                module = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(module)

                if hasattr(module, "bot"):
                    logger.debug(f"Found bot() in {py_file.name}")
                    return module
        except Exception as e:
            logger.debug(f"Failed to load {py_file.name}: {e}")
            continue

    raise ImportError(
        "Could not find 'bot' function. Your bot file must have:\n"
        "async def bot(runner_args: RunnerArguments)"
    )


class LiveKitRunner:
    """Manages LiveKit rooms, tokens, and bot sessions."""

    def __init__(self, url: str, api_key: str, api_secret: str):
        """Initialize LiveKit runner.

        Args:
            url: LiveKit server URL (wss://...)
            api_key: LiveKit API key
            api_secret: LiveKit API secret
        """
        self.url = url
        self.api_key = api_key
        self.api_secret = api_secret
        self.active_sessions: Dict[str, Dict[str, Any]] = {}
        self._lk_api: Optional[api.LiveKitAPI] = None
        logger.info(f"LiveKit runner initialized: {url}")

    async def initialize(self):
        """Initialize LiveKit API client."""
        self._lk_api = api.LiveKitAPI(
            url=self.url,
            api_key=self.api_key,
            api_secret=self.api_secret
        )
        logger.debug("LiveKit API client initialized")

    async def create_room(self, room_name: str) -> None:
        """Create a LiveKit room (idempotent operation).

        Args:
            room_name: Name for the room
        """
        try:
            await self._lk_api.room.create_room(
                api.CreateRoomRequest(name=room_name)
            )
            logger.debug(f"Created room: {room_name}")
        except Exception as e:
            # Room might already exist - that's okay
            logger.debug(f"Room creation note for {room_name}: {e}")

    def create_token(
        self,
        room_name: str,
        participant_identity: str,
        participant_name: str = "AI Bot"
    ) -> str:
        """Generate participant access token.

        Args:
            room_name: Room to grant access to
            participant_identity: Unique participant identifier
            participant_name: Display name for participant

        Returns:
            JWT token string
        """
        token = api.AccessToken(self.api_key, self.api_secret)
        token.with_identity(participant_identity)
        token.with_name(participant_name)
        token.with_grants(
            api.VideoGrants(
                room_join=True,
                room=room_name,
                can_publish=True,
                can_subscribe=True,
                can_publish_data=True,
            )
        )
        return token.to_jwt()

    async def start_session(self, request_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new bot session with room and token.

        Args:
            request_data: Client request data containing optional roomName and body

        Returns:
            Session details including token and room info
        """
        # Generate identifiers
        session_id = str(uuid.uuid4())
        room_name = request_data.get("roomName", f"room-{uuid.uuid4()}")
        participant_identity = f"bot-{uuid.uuid4()}"

        # Create room and generate token
        await self.create_room(room_name)
        token = self.create_token(room_name, participant_identity)

        # Store session info
        self.active_sessions[session_id] = {
            "room_name": room_name,
            "participant_identity": participant_identity,
            "token": token,
            "request_data": request_data,
        }

        logger.info(f"Session {session_id} created in room {room_name}")

        return {
            "sessionId": session_id,
            "roomName": room_name,
            "participantIdentity": participant_identity,
            "participantToken": token,
            "livekitUrl": self.url,
        }

    def get_runner_args(self, session_id: str) -> LiveKitRunnerArguments:
        """Get runner arguments for spawning bot.

        Args:
            session_id: Session identifier

        Returns:
            LiveKitRunnerArguments instance

        Raises:
            ValueError: If session not found
        """
        session = self.active_sessions.get(session_id)
        if not session:
            raise ValueError(f"Session not found: {session_id}")

        return LiveKitRunnerArguments(
            room_name=session["room_name"],
            participant_token=session["token"],
            livekit_url=self.url,
            body=session["request_data"].get("body", {}),
        )

    async def cleanup(self):
        """Cleanup sessions and close API client."""
        logger.info(f"Cleaning up {len(self.active_sessions)} sessions")
        self.active_sessions.clear()

        if self._lk_api:
            await self._lk_api.aclose()
            logger.debug("LiveKit API client closed")


def create_app(runner: LiveKitRunner) -> FastAPI:
    """Create FastAPI application with LiveKit routes.

    Args:
        runner: LiveKitRunner instance

    Returns:
        Configured FastAPI app
    """

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        """Manage application lifecycle."""
        await runner.initialize()
        logger.info("🚀 LiveKit runner started")
        yield
        await runner.cleanup()
        logger.info("✅ LiveKit runner shutdown complete")

    app = FastAPI(lifespan=lifespan)

    # Enable CORS for web clients
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/")
    async def root():
        """Status endpoint."""
        return {
            "status": "ready",
            "transport": "livekit",
            "url": runner.url,
            "active_sessions": len(runner.active_sessions),
        }

    @app.post("/start")
    async def start_session(request: Request, background_tasks: BackgroundTasks):
        """Start a new bot session.

        Request body (JSON):
            {
                "roomName": "optional-room-name",  // Auto-generated if omitted
                "body": {                          // Optional bot configuration
                    "user_id": "123",
                    "custom_data": "anything"
                }
            }

        Response:
            {
                "sessionId": "uuid",
                "roomName": "room-name",
                "participantIdentity": "bot-uuid",
                "participantToken": "jwt-token",
                "livekitUrl": "wss://..."
            }
        """
        try:
            request_data = await request.json()
            logger.debug(f"Start session request: {request_data.keys()}")
        except Exception as e:
            logger.warning(f"Failed to parse request body: {e}")
            request_data = {}

        # Create session with room and token
        response = await runner.start_session(request_data)
        session_id = response["sessionId"]

        # Spawn bot in background
        async def run_bot_task():
            try:
                bot_module = get_bot_module()
                runner_args = runner.get_runner_args(session_id)

                logger.info(f"Starting bot for session {session_id}")
                await bot_module.bot(runner_args)
                logger.info(f"Bot completed for session {session_id}")

            except Exception as e:
                logger.error(
                    f"Bot error in session {session_id}: {e}", exc_info=True)
            finally:
                # Cleanup session when bot finishes
                runner.active_sessions.pop(session_id, None)
                logger.debug(f"Session {session_id} cleaned up")

        background_tasks.add_task(run_bot_task)

        return response

    @app.get("/health")
    async def health():
        """Health check endpoint."""
        return {
            "status": "ok",
            "transport": "livekit",
            "active_sessions": len(runner.active_sessions),
        }

    @app.get("/sessions")
    async def list_sessions():
        """List active sessions (for debugging)."""
        return {
            "count": len(runner.active_sessions),
            "sessions": [
                {
                    "session_id": sid,
                    "room_name": info["room_name"],
                }
                for sid, info in runner.active_sessions.items()
            ],
        }

    return app


def main():
    """Run the LiveKit runner server."""
    parser = argparse.ArgumentParser(
        description="Minimal LiveKit Runner for Pipecat",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Example usage:
  python runner.py
  python runner.py --host 0.0.0.0 --port 8000
  
Environment variables required:
  LIVEKIT_URL          LiveKit server WebSocket URL
  LIVEKIT_API_KEY      LiveKit API key  
  LIVEKIT_API_SECRET   LiveKit API secret
        """,
    )
    parser.add_argument(
        "--host",
        default="localhost",
        help="Server host (default: localhost)"
    )
    parser.add_argument(
        "--port",
        type=int,
        default=7860,
        help="Server port (default: 7860)"
    )
    parser.add_argument(
        "--livekit-url",
        help="LiveKit URL (or use LIVEKIT_URL env var)"
    )
    parser.add_argument(
        "--livekit-api-key",
        help="LiveKit API key (or use LIVEKIT_API_KEY env var)"
    )
    parser.add_argument(
        "--livekit-api-secret",
        help="LiveKit API secret (or use LIVEKIT_API_SECRET env var)"
    )
    parser.add_argument(
        "-v", "--verbose",
        action="store_true",
        help="Enable verbose logging"
    )

    args = parser.parse_args()

    # Configure logging
    logger.remove()
    level = "DEBUG" if args.verbose else "INFO"
    logger.add(sys.stderr, level=level)

    # Get LiveKit credentials from args or environment
    livekit_url = args.livekit_url or os.getenv("LIVEKIT_URL")
    api_key = args.livekit_api_key or os.getenv("LIVEKIT_API_KEY")
    api_secret = args.livekit_api_secret or os.getenv("LIVEKIT_API_SECRET")

    # Validate required configuration
    if not all([livekit_url, api_key, api_secret]):
        logger.error("Missing required LiveKit configuration:")
        logger.error("  LIVEKIT_URL (or --livekit-url)")
        logger.error("  LIVEKIT_API_KEY (or --livekit-api-key)")
        logger.error("  LIVEKIT_API_SECRET (or --livekit-api-secret)")
        sys.exit(1)

    # Create runner and app
    runner = LiveKitRunner(livekit_url, api_key, api_secret)
    app = create_app(runner)

    # Print startup banner
    print()
    print("=" * 70)
    print("🎙️  LiveKit Runner for Pipecat")
    print("=" * 70)
    print(f"📡 LiveKit Server : {livekit_url}")
    print(f"🌐 API Server     : http://{args.host}:{args.port}")
    print(f"📝 Create session : POST http://{args.host}:{args.port}/start")
    print(f"💚 Health check   : GET  http://{args.host}:{args.port}/health")
    print("=" * 70)
    print()

    # Start FastAPI server
    uvicorn.run(app, host=args.host, port=args.port)


if __name__ == "__main__":
    main()
