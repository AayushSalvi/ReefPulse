"""Shared FastAPI dependencies (DB session, user identity)."""

from __future__ import annotations

from typing import Annotated

import jwt
from fastapi import Depends, Header, HTTPException, Query, Request, status
from jwt.exceptions import InvalidTokenError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.constants import DEMO_USER_UUID
from app.db.session import get_db


def resolve_user_uuid(
    request: Request,
    authorization: str | None = Header(default=None),
    x_user_id: str | None = Header(default=None, alias="X-User-Id"),
    user_id: str | None = Query(default=None, description="Caller id until all clients send headers."),
) -> str:
    del request  # reserved for future tracing / client hints
    if authorization and authorization.startswith("Bearer "):
        token = authorization.removeprefix("Bearer ").strip()
        if token:
            try:
                payload = jwt.decode(
                    token,
                    settings.jwt_secret,
                    algorithms=[settings.jwt_algorithm],
                )
                sub = payload.get("sub")
                if isinstance(sub, str) and sub.strip():
                    s = sub.strip()
                    return DEMO_USER_UUID if s.lower() == "demo" else s
            except InvalidTokenError:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid bearer token",
                ) from None

    if x_user_id and x_user_id.strip():
        x = x_user_id.strip()
        return DEMO_USER_UUID if x.lower() == "demo" else x

    if user_id and user_id.strip():
        q = user_id.strip()
        return DEMO_USER_UUID if q.lower() == "demo" else q

    return DEMO_USER_UUID


CurrentUserUuid = Annotated[str, Depends(resolve_user_uuid)]
DbSession = Annotated[Session, Depends(get_db)]
