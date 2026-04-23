import uuid
from datetime import timedelta
from typing import Dict, Any, Optional

from fastapi import FastAPI, BackgroundTasks, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from livekit import api
from loguru import logger

from config import load_config, require
from runner_types import LiveKitRunnerArguments

config = load_config()

# These environment variables should match your Next.js client setup
LIVEKIT_API_KEY = require(config.livekit_api_key, "LIVEKIT_API_KEY")
LIVEKIT_API_SECRET = require(config.livekit_api_secret, "LIVEKIT_API_SECRET")
LIVEKIT_URL = require(config.livekit_url, "LIVEKIT_URL")


def create_app():
    """Factory function to create the FastAPI application.

    This pattern allows you to easily extend with additional routes
    or middleware as your application grows.
    """
    app = FastAPI(title="LiveKit Bot Runner")

    # CORS middleware allows your Next.js client to call these endpoints
    app.add_middleware(
        CORSMiddleware,
        # Tighten this in production to your actual domain
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    return app


app = create_app()


def _room_slug(room_name: str) -> str:
    slug = "".join(ch if ch.isalnum() else "_" for ch in room_name.lower())
    slug = slug.strip("_")
    return slug[:24] or "room"


async def create_livekit_room_and_token(
    room_name: str,
    participant_identity: str,
    participant_name: str = "bot",
    agent_name: Optional[str] = None
) -> str:
    """Create or join a LiveKit room and generate a token for a participant.

    This mimics what your Next.js client does, but for the bot participant.
    The bot gets its own identity and token to join the same room as the user.

    Args:
        room_name: Name of the room (should match what client is joining)
        participant_identity: Unique identifier for this participant
        participant_name: Display name for the participant
        agent_name: Optional agent name for room configuration

    Returns:
        JWT token for the bot to authenticate with LiveKit
    """
    # Create access token with 15 minute expiration
    # This is sufficient for most conversations; adjust if you need longer sessions
    token = api.AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET) \
        .with_identity(participant_identity) \
        .with_name(participant_name) \
        .with_grants(api.VideoGrants(
            room_join=True,
            room=room_name,
            can_publish=True,
            can_subscribe=True,
            can_publish_data=True,
            agent=True,
        )) \
        .with_ttl(timedelta(minutes=15))  # 15 minutes as timedelta

    if agent_name:
        # Room configuration can include agent metadata
        # This isn't strictly necessary but can be useful for tracking
        token = token.with_room_config(api.RoomConfiguration(
            agents=[api.AgentDispatch(agent_name=agent_name)]
        ))

    return token.to_jwt()


@app.post("/start")
async def start_bot(request: Request, background_tasks: BackgroundTasks):
    """Main endpoint that your client calls to start a conversation.

    Expected request body format:
    {
        "room_name": "voice_assistant_room_1234",  # Room the client will join
        "bot_identity": "bot_roomA_ab12cd34",      # Optional; generated if omitted
        "room_config": {
            "agents": [{"agent_name": "my_bot"}]  # Optional
        },
        "custom_data": {  # Optional: any data you want passed to bot
            "user_context": "..."
        }
    }

    Returns:
    {
        "session_id": "uuid-here",
        "room_name": "voice_assistant_room_1234",
        "message": "Bot is joining room"
    }
    """
    try:
        try:
            body = await request.json()
        except Exception:
            return JSONResponse({"error": "request body must be valid JSON"}, status_code=400)

        if not isinstance(body, dict):
            return JSONResponse({"error": "request body must be a JSON object"}, status_code=400)

        logger.debug(f"Received start request: {body}")

        # Debug body content types
        logger.debug("Request body content types:")
        for key, value in body.items():
            logger.debug(f"{key}: {type(value)} = {value}")

        # Extract room name from request
        # Your client should send this after creating its own token
        room_name = body.get("room_name")
        if not isinstance(room_name, str) or not room_name.strip():
            return JSONResponse(
                {"error": "room_name is required and must be a non-empty string"},
                status_code=400,
            )
        room_name = room_name.strip()

        # Extract optional agent configuration
        agent_name = None
        room_config = body.get("room_config")
        if isinstance(room_config, dict):
            agents = room_config.get("agents")
            if (
                isinstance(agents, list)
                and len(agents) > 0
                and isinstance(agents[0], dict)
            ):
                maybe_agent_name = agents[0].get("agent_name")
                if isinstance(maybe_agent_name, str) and maybe_agent_name.strip():
                    agent_name = maybe_agent_name.strip()

        requested_bot_identity = body.get("bot_identity")
        if requested_bot_identity is not None:
            if not isinstance(requested_bot_identity, str) or not requested_bot_identity.strip():
                return JSONResponse(
                    {"error": "bot_identity must be a non-empty string"},
                    status_code=400,
                )
            bot_identity = requested_bot_identity.strip()
            if len(bot_identity) > 128:
                return JSONResponse(
                    {"error": "bot_identity must be 128 characters or fewer"},
                    status_code=400,
                )
        else:
            # Generate unique identity for the bot participant.
            # Prefixing with room slug keeps identities easy to trace in operations logs.
            bot_identity = f"bot_{_room_slug(room_name)}_{uuid.uuid4().hex[:10]}"

        # Create token for the bot to join the room
        bot_token = await create_livekit_room_and_token(
            room_name=room_name,
            participant_identity=bot_identity,
            participant_name="Assistant",  # Display name users will see
            agent_name=agent_name
        )

        # Prepare arguments to pass to your bot function
        runner_args = LiveKitRunnerArguments(
            url=LIVEKIT_URL,
            token=bot_token,
            room_name=room_name,
            body=body  # Pass along any custom data
        )

        # Import and spawn your bot in the background
        # This allows the HTTP response to return immediately
        # while the bot runs in a separate async task
        from bot import bot  # Replace with your actual bot module
        background_tasks.add_task(bot, runner_args)

        session_id = str(uuid.uuid4())

        logger.info(f"Starting bot session {session_id} in room {room_name}")

        return {
            "session_id": session_id,
            "room_name": room_name,
            "bot_identity": bot_identity,
            "message": "Bot is joining room"
        }

    except Exception as e:
        import traceback
        logger.error(f"Error starting bot: {e}")
        logger.error(f"Full traceback:\n{traceback.format_exc()}")
        return JSONResponse({"error": str(e)}, status_code=500)


@app.get("/health")
async def health_check():
    """Simple health check endpoint for monitoring."""
    return {"status": "healthy", "service": "livekit-bot-runner"}


if __name__ == "__main__":
    import uvicorn

    logger.info("Starting LiveKit Bot Runner")
    logger.info(f"LiveKit URL: {LIVEKIT_URL}")

    # Run the server on port 7860 to match typical Pipecat conventions
    # Adjust host/port as needed for your deployment
    uvicorn.run(app, host="0.0.0.0", port=7860)
