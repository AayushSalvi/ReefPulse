"""ReefPulse assistant via Google Gemini (optional; requires GEMINI_API_KEY)."""

from __future__ import annotations

from fastapi import APIRouter

from app.schemas.chat import ChatQueryRequest, ChatQueryResponse
from app.services import chat_service

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("/query", response_model=ChatQueryResponse)
def query_agent(body: ChatQueryRequest) -> ChatQueryResponse:
    """Runs a single-turn Gemini completion with a fixed ReefPulse system prompt."""
    reply, model = chat_service.gemini_reply(body.message.strip())
    return ChatQueryResponse(reply=reply, model=model)
