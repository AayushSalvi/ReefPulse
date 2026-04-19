"""Register, login, JWT issuance, password hashing."""

from __future__ import annotations

import time
import uuid
from typing import Any

import bcrypt
import jwt
from fastapi import HTTPException, status
from jwt.exceptions import PyJWTError
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models import User


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        # * bcrypt rejects passwords over 72 bytes; treat as non-match so login stays 401.
        return False


def get_user_by_email(session: Session, email: str) -> User | None:
    e = email.strip().lower()
    return session.scalar(select(User).where(func.lower(User.email) == e))


def register_user(session: Session, *, email: str, password: str, handle: str | None) -> User:
    if not settings.allow_registration:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Registration is disabled")
    e = email.strip().lower()
    if get_user_by_email(session, e):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    h = (handle or email.split("@")[0]).strip()[:128] or "Snorkeler"
    user = User(
        id=str(uuid.uuid4()),
        external_key=None,
        email=e,
        password_hash=hash_password(password),
        handle=h[:128],
    )
    session.add(user)
    try:
        session.flush()
    except IntegrityError as exc:
        session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        ) from exc
    return user


def authenticate(session: Session, email: str, password: str) -> User:
    user = get_user_by_email(session, email)
    if not user or not user.password_hash:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    if not verify_password(password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    return user


def issue_access_token(user_id: str) -> tuple[str, int]:
    now = int(time.time())
    ttl_sec = int(settings.jwt_expire_minutes * 60)
    payload: dict[str, Any] = {"sub": user_id, "iat": now, "exp": now + ttl_sec}
    token = jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    if isinstance(token, bytes):
        token = token.decode("utf-8")
    return token, ttl_sec


def decode_token_subject(token: str) -> str:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except PyJWTError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token") from e
    sub = payload.get("sub")
    if not isinstance(sub, str) or not sub.strip():
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")
    return sub.strip()
