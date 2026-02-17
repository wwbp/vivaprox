import re
from dataclasses import dataclass
from typing import Optional
from urllib.parse import parse_qs, urlparse

_MEETING_NUMBER_RE = re.compile(r"/(?:j|wc/join|w|s)/(\d{9,14})(?:/|$)")


@dataclass(frozen=True)
class ZoomMeetingTarget:
    meeting_number: Optional[str]
    meeting_passcode: Optional[str]


def _normalize_meeting_number(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    digits = "".join(ch for ch in value if ch.isdigit())
    if len(digits) < 9:
        return None
    return digits


def parse_zoom_meeting_target(meeting_url: str, fallback_meeting_id: Optional[str] = None) -> ZoomMeetingTarget:
    parsed = urlparse(meeting_url)
    meeting_number: Optional[str] = None

    match = _MEETING_NUMBER_RE.search(parsed.path or "")
    if match:
        meeting_number = _normalize_meeting_number(match.group(1))

    if not meeting_number:
        meeting_number = _normalize_meeting_number(fallback_meeting_id)

    query = parse_qs(parsed.query or "")
    passcode = None
    for key in ("pwd", "passcode"):
        values = query.get(key)
        if values:
            candidate = values[0].strip()
            if candidate:
                passcode = candidate
                break

    return ZoomMeetingTarget(meeting_number=meeting_number, meeting_passcode=passcode)
