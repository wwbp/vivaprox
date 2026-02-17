from typing import Literal, Optional

from pydantic import BaseModel, Field


class JoinRequest(BaseModel):
    bot_id: str = Field(min_length=1)
    meeting_url: str = Field(min_length=1)
    meeting_id: Optional[str] = None


class LeaveRequest(BaseModel):
    bot_id: str = Field(min_length=1)
    external_session_id: Optional[str] = None
    meeting_url: Optional[str] = None
    meeting_id: Optional[str] = None


class SessionRecord(BaseModel):
    session_id: str
    bot_id: str
    meeting_url: str
    meeting_id: Optional[str] = None
    worker_pid: Optional[int] = None
    status: Literal["joined", "left"]
    joined_at: str
    left_at: Optional[str] = None


class JoinResponse(BaseModel):
    session_id: str
    bot_id: str
    status: Literal["joined"]


class LeaveResponse(BaseModel):
    session_id: str
    bot_id: str
    status: Literal["left"]


class SessionsResponse(BaseModel):
    sessions: list[SessionRecord]
