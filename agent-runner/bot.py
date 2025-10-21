#
# Copyright (c) 2024–2025, Daily
#
# SPDX-License-Identifier: BSD 2-Clause License
#

"""Pipecat LiveKit Bot Example.

A voice AI bot using LiveKit transport for real-time communication.

Required AI services:
- Deepgram (Speech-to-Text)
- OpenAI (LLM)
- Cartesia (Text-to-Speech)

Required environment variables:
- LIVEKIT_URL
- LIVEKIT_API_KEY
- LIVEKIT_API_SECRET
- DEEPGRAM_API_KEY
- OPENAI_API_KEY
- CARTESIA_API_KEY

Run the bot using:
    python runner.py
"""

from runner import LiveKitRunnerArguments
from pipecat.runner.types import RunnerArguments
from pipecat.transports.services.livekit import LiveKitParams, LiveKitTransport
from pipecat.services.openai.llm import OpenAILLMService
from pipecat.services.deepgram.stt import DeepgramSTTService
from pipecat.services.cartesia.tts import CartesiaTTSService
from pipecat.processors.frameworks.rtvi import RTVIConfig, RTVIObserver, RTVIProcessor
from pipecat.processors.aggregators.llm_response_universal import LLMContextAggregatorPair
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.pipeline.task import PipelineParams, PipelineTask
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.pipeline import Pipeline
from pipecat.frames.frames import LLMRunFrame
from pipecat.audio.vad.vad_analyzer import VADParams
from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.audio.turn.smart_turn.local_smart_turn_v3 import LocalSmartTurnAnalyzerV3
from loguru import logger
from dotenv import load_dotenv
import os
import certifi

os.environ.setdefault("SSL_CERT_FILE", certifi.where())
os.environ.setdefault("REQUESTS_CA_BUNDLE", certifi.where())


print("🚀 Starting Pipecat LiveKit bot...")
print("⏳ Loading models and imports...\n")

# Load VAD and turn detection
logger.info("Loading Local Smart Turn Analyzer V3...")

logger.info("✅ Local Smart Turn Analyzer V3 loaded")

logger.info("Loading Silero VAD model...")

logger.info("✅ Silero VAD model loaded")

# Load pipeline components

# AI Services

# LiveKit Transport

# Runner types

# Import our custom LiveKit runner args

logger.info("✅ All components loaded successfully!")

load_dotenv(override=True)


async def run_bot(transport: LiveKitTransport, runner_args: RunnerArguments):
    """Run the bot pipeline with given transport."""
    logger.info("Starting bot pipeline")

    # Initialize AI services
    stt = DeepgramSTTService(api_key=os.getenv("DEEPGRAM_API_KEY"))

    tts = CartesiaTTSService(
        api_key=os.getenv("CARTESIA_API_KEY"),
        voice_id="71a7ad14-091c-4e8e-a314-022ece01c121",  # British Reading Lady
    )

    llm = OpenAILLMService(api_key=os.getenv("OPENAI_API_KEY"))

    # Setup conversation context
    messages = [
        {
            "role": "system",
            "content": "You are a friendly AI assistant. Respond naturally and keep your answers conversational.",
        },
    ]

    context = LLMContext(messages)
    context_aggregator = LLMContextAggregatorPair(context)

    # RTVI processor for real-time voice interaction
    rtvi = RTVIProcessor(config=RTVIConfig(config=[]))

    # Build pipeline
    pipeline = Pipeline(
        [
            transport.input(),  # Audio input from LiveKit
            rtvi,  # RTVI processor
            stt,  # Speech-to-Text
            context_aggregator.user(),  # User message aggregation
            llm,  # Language Model
            tts,  # Text-to-Speech
            transport.output(),  # Audio output to LiveKit
            context_aggregator.assistant(),  # Assistant response aggregation
        ]
    )

    # Create pipeline task
    task = PipelineTask(
        pipeline,
        params=PipelineParams(
            enable_metrics=True,
            enable_usage_metrics=True,
        ),
        observers=[RTVIObserver(rtvi)],
    )

    # Event handlers
    @transport.event_handler("on_first_participant_joined")
    async def on_first_participant_joined(transport, participant):
        """Called when first participant joins the room."""
        logger.info(f"First participant joined: {participant}")
        # Greet the user
        messages.append(
            {
                "role": "system",
                "content": "Say hello and briefly introduce yourself as a helpful AI assistant.",
            }
        )
        await task.queue_frames([LLMRunFrame()])

    @transport.event_handler("on_participant_connected")
    async def on_participant_connected(transport, participant):
        """Called when any participant connects."""
        logger.info(f"Participant connected: {participant}")

    @transport.event_handler("on_participant_disconnected")
    async def on_participant_disconnected(transport, participant):
        """Called when participant disconnects."""
        logger.info(f"Participant disconnected: {participant}")

    @transport.event_handler("on_disconnected")
    async def on_disconnected(transport):
        """Called when bot disconnects from room."""
        logger.info("Bot disconnected from room")
        await task.cancel()

    # Run the pipeline
    runner = PipelineRunner(handle_sigint=runner_args.handle_sigint)
    await runner.run(task)


async def bot(runner_args: RunnerArguments):
    """Main bot entry point - called by the LiveKit runner.

    Args:
        runner_args: Runner arguments (LiveKitRunnerArguments for LiveKit transport)
    """
    logger.info(f"Bot called with args type: {type(runner_args).__name__}")

    # Ensure we have LiveKit runner arguments
    if not isinstance(runner_args, LiveKitRunnerArguments):
        raise ValueError(
            f"Expected LiveKitRunnerArguments, got {type(runner_args).__name__}"
        )

    # Log session info
    logger.info(f"Room: {runner_args.room_name}")
    logger.info(f"LiveKit URL: {runner_args.livekit_url}")
    if runner_args.body:
        logger.info(f"Request body: {runner_args.body}")

    # Create LiveKit transport
    transport = LiveKitTransport(
        url=runner_args.livekit_url,
        token=runner_args.participant_token,
        room_name=runner_args.room_name,
        params=LiveKitParams(
            audio_in_enabled=True,
            audio_out_enabled=True,
            vad_analyzer=SileroVADAnalyzer(
                params=VADParams(stop_secs=0.2)
            ),
            turn_analyzer=LocalSmartTurnAnalyzerV3(),
        ),
    )

    # Run the bot
    await run_bot(transport, runner_args)


if __name__ == "__main__":
    # Import and run our custom LiveKit runner
    from runner import main

    main()
