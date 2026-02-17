import uuid
from datetime import timedelta
from typing import Dict, Any, Optional

from fastapi import FastAPI, BackgroundTasks, Request
from fastapi.middleware.cors import CORSMiddleware
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
            can_publish_data=True,  # Allows bot to send text data
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
        body = await request.json()
        logger.debug(f"Received start request: {body}")

        # Debug body content types
        logger.debug("Request body content types:")
        for key, value in body.items():
            logger.debug(f"{key}: {type(value)} = {value}")

        # Extract room name from request
        # Your client should send this after creating its own token
        room_name = body.get("room_name")
        if not room_name:
            return {"error": "room_name is required"}, 400

        # Extract optional agent configuration
        agent_name = body.get("room_config", {}).get(
            "agents", [{}])[0].get("agent_name")

        # Generate unique identity for the bot participant
        # This ensures each bot instance is tracked separately
        bot_identity = f"bot_{uuid.uuid4().hex[:8]}"

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
            "message": "Bot is joining room"
        }

    except Exception as e:
        import traceback
        logger.error(f"Error starting bot: {e}")
        logger.error(f"Full traceback:\n{traceback.format_exc()}")
        return {"error": str(e)}, 500


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
