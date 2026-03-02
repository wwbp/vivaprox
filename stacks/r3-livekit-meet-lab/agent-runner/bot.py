import asyncio
import json
import sys
from loguru import logger

from pipecat.audio.turn.smart_turn.base_smart_turn import SmartTurnParams
from pipecat.audio.turn.smart_turn.local_smart_turn_v3 import LocalSmartTurnAnalyzerV3
from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.audio.vad.vad_analyzer import VADParams
from pipecat.frames.frames import (
    InterruptionFrame,
    TranscriptionFrame,
    TTSSpeakFrame,
    UserStartedSpeakingFrame,
    UserStoppedSpeakingFrame,
)
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineParams, PipelineTask
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.aggregators.llm_response_universal import LLMContextAggregatorPair
from pipecat.services.openai.llm import OpenAILLMService
from pipecat.services.openai.stt import OpenAISTTService
from pipecat.services.openai.tts import OpenAITTSService
from pipecat.transports.livekit import transport as livekit_transport_module
from pipecat.transports.livekit.transport import LiveKitParams, LiveKitTransport

from config import load_config, require
from runner_types import LiveKitRunnerArguments

logger.remove(0)
logger.add(sys.stderr, level="DEBUG")


def _apply_livekit_video_subscription_guard() -> None:
    """Backport a LiveKit transport fix present in newer pipecat releases.

    In pipecat 0.0.90, video tracks can still be processed even when
    `video_in_enabled=False`, causing unbounded queue growth and OOM in
    camera-on calls. This guard keeps video processing disabled unless
    explicitly enabled.
    """
    client_cls = livekit_transport_module.LiveKitTransportClient
    if getattr(client_cls, "_video_guard_patched", False):
        return

    original_handler = client_cls._async_on_track_subscribed

    async def guarded_on_track_subscribed(self, track, publication, participant):
        if (
            track.kind == livekit_transport_module.rtc.TrackKind.KIND_VIDEO
            and not self._params.video_in_enabled
        ):
            logger.info(
                "Video track subscribed but video_in_enabled is false; skipping video stream "
                f"processing for participant {participant.sid}"
            )
            self._video_tracks[participant.sid] = track
            await self._callbacks.on_video_track_subscribed(participant.sid)
            return
        await original_handler(self, track, publication, participant)

    client_cls._async_on_track_subscribed = guarded_on_track_subscribed
    client_cls._video_guard_patched = True


async def bot(runner_args: LiveKitRunnerArguments):
    """Main bot entry point called by the FastAPI runner.

    This function receives the room credentials and sets up the entire
    bot pipeline. It runs until the conversation ends.

    Args:
        runner_args: Contains url, token, room_name from the runner
    """
    logger.info(f"Bot starting - joining room: {runner_args.room_name}")

    # Guard against a known LiveKit video subscription leak in pipecat 0.0.90.
    _apply_livekit_video_subscription_guard()

    # Create transport using credentials from runner
    # Notice how cleanly this separates concerns: the runner handles
    # room/token creation, the bot handles the conversation logic
    transport = LiveKitTransport(
        url=runner_args.url,
        token=runner_args.token,
        room_name=runner_args.room_name,
        params=LiveKitParams(
            audio_in_enabled=True,
            audio_out_enabled=True,
            video_in_enabled=False,
            vad_analyzer=SileroVADAnalyzer(params=VADParams(stop_secs=0.2)),
            turn_analyzer=LocalSmartTurnAnalyzerV3(params=SmartTurnParams()),
        ),
    )

    # Initialize your services
    config = load_config()
    stt = OpenAISTTService(api_key=require(config.openai_api_key, "OPENAI_API_KEY"))
    llm = OpenAILLMService(api_key=require(config.openai_api_key, "OPENAI_API_KEY"))
    tts = OpenAITTSService(api_key=require(config.openai_api_key, "OPENAI_API_KEY"))

    # Set up conversation context
    messages = [
        {
            "role": "system",
            "content": "You are a helpful LLM in a WebRTC call. "
            "Your goal is to demonstrate your capabilities in a succinct way. "
            "Your output will be converted to audio so don't include special characters in your answers. "
            "Respond to what the user said in a creative and helpful way.",
        },
    ]

    context = LLMContext(messages)
    context_aggregator = LLMContextAggregatorPair(context)

    # Build the processing pipeline
    pipeline = Pipeline(
        [
            transport.input(),
            stt,
            context_aggregator.user(),
            llm,
            tts,
            transport.output(),
            context_aggregator.assistant(),
        ]
    )

    task = PipelineTask(
        pipeline,
        params=PipelineParams(
            enable_metrics=True,
            enable_usage_metrics=True,
        ),
    )

    # Event handler: Start talking when first participant joins
    @transport.event_handler("on_first_participant_joined")
    async def on_first_participant_joined(transport, participant_id):
        logger.info(f"First participant joined: {participant_id}")
        # Small delay to ensure audio stream is ready
        await asyncio.sleep(1)
        await task.queue_frame(
            TTSSpeakFrame(
                "Hello there! How are you doing today? Would you like to talk about the weather?"
            )
        )

    # Event handler: Handle text messages from client
    # This allows your client to send text that gets processed as speech
    @transport.event_handler("on_data_received")
    async def on_data_received(transport, data, participant_id):
        logger.info(f"Received data from participant {participant_id}: {data}")
        json_data = json.loads(data)

        # Log timestamp type and value
        logger.debug(
            f"Timestamp type: {type(json_data['timestamp'])}, Value: {json_data['timestamp']}")

        # Convert text message into speech input frames
        # This interrupts the bot if it's currently speaking
        await task.queue_frames(
            [
                InterruptionFrame(),
                UserStartedSpeakingFrame(),
                TranscriptionFrame(
                    user_id=participant_id,
                    timestamp=json_data["timestamp"],
                    text=json_data["message"],
                ),
                UserStoppedSpeakingFrame(),
            ],
        )

    # Run the pipeline until completion
    runner = PipelineRunner()
    await runner.run(task)

    logger.info(f"Bot session ended for room: {runner_args.room_name}")
