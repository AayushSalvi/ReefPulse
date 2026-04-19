"""Chat / assistant request and response models."""

from __future__ import annotations

from pydantic import BaseModel, Field


class ChatQueryRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=8000)


class ChatQueryResponse(BaseModel):
    reply: str
    model: str
