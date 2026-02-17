import argparse
import signal
import sys
import time


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Minimal long-running worker for connector process-mode testing.")
    parser.add_argument("--bot-id", required=True)
    parser.add_argument("--meeting-url", required=True)
    parser.add_argument("--meeting-id", default="")
    parser.add_argument("--passcode", default="")
    parser.add_argument("--session-id", required=True)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    running = True

    def _handle_signal(signum: int, _frame: object) -> None:
        nonlocal running
        running = False
        print(f"fake worker signal={signum} bot_id={args.bot_id}", flush=True)

    signal.signal(signal.SIGTERM, _handle_signal)
    signal.signal(signal.SIGINT, _handle_signal)

    print(
        "fake worker started "
        f"bot_id={args.bot_id} "
        f"session_id={args.session_id} "
        f"meeting_url={args.meeting_url} "
        f"meeting_id={args.meeting_id} "
        f"passcode={'set' if bool(args.passcode) else 'empty'}",
        flush=True,
    )
    while running:
        time.sleep(1)
    print(f"fake worker stopped bot_id={args.bot_id}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
