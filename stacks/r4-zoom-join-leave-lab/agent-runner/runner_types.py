from typing import Literal, Optional

from pydantic import BaseModel, Field


class JoinBotRequest(BaseModel):
    meeting_url: str = Field(min_length=1)
    meeting_id: Optional[str] = None


class BotSession(BaseModel):
    bot_id: str
    state: Literal["joined", "left"]
    meeting_url: str
    meeting_id: Optional[str] = None
    started_at: str
    left_at: Optional[str] = None
    external_session_id: Optional[str] = None


class JoinResponse(BaseModel):
    bot: BotSession


class BotListResponse(BaseModel):
    bots: list[BotSession]
