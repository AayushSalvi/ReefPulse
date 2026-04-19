"""Login, register, logout, and current-user profile."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import User
from app.db.session import get_db
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserPublic
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


def _bearer_token(authorization: str | None = Header(default=None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    tok = authorization.removeprefix("Bearer ").strip()
    if not tok:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return tok


@router.post("/register", response_model=TokenResponse, status_code=201)
def register(body: RegisterRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = auth_service.register_user(db, email=str(body.email), password=body.password, handle=body.handle)
    token, ttl = auth_service.issue_access_token(user.id)
    return TokenResponse(access_token=token, expires_in=ttl)


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = auth_service.authenticate(db, str(body.email), body.password)
    token, ttl = auth_service.issue_access_token(user.id)
    return TokenResponse(access_token=token, expires_in=ttl)


@router.post("/logout", status_code=204)
def logout() -> None:
    """Stateless JWT: client discards the token. This endpoint is a no-op for API symmetry."""
    return None


@router.get("/me", response_model=UserPublic)
def me(
    db: Session = Depends(get_db),
    token: str = Depends(_bearer_token),
) -> UserPublic:
    user_id = auth_service.decode_token_subject(token)
    user = db.scalar(select(User).where(User.id == user_id))
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User no longer exists")
    return UserPublic(id=user.id, email=user.email, handle=user.handle)
