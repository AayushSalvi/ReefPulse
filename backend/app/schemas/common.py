from pydantic import BaseModel


class MessageResponse(BaseModel):
    message: str
    next_step: str | None = None
