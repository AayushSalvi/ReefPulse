"""Auth request/response models."""

from __future__ import annotations

from pydantic import BaseModel, EmailStr, Field, field_validator

# * bcrypt rejects passwords over 72 UTF-8 bytes (older builds truncated; current bcrypt raises ValueError).
_BCRYPT_MAX_PASSWORD_BYTES = 72


def _validate_password_bcrypt_bytes(v: str) -> str:
    n = len(v.encode("utf-8"))
    if n > _BCRYPT_MAX_PASSWORD_BYTES:
        raise ValueError(
            f"Password must be at most {_BCRYPT_MAX_PASSWORD_BYTES} bytes when encoded as UTF-8 "
            "(bcrypt limit). Use a shorter password or fewer multi-byte characters."
        )
    return v


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=256)
    handle: str | None = Field(default=None, max_length=128)

    @field_validator("password")
    @classmethod
    def password_within_bcrypt_bytes(cls, v: str) -> str:
        return _validate_password_bcrypt_bytes(v)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=256)

    @field_validator("password")
    @classmethod
    def password_within_bcrypt_bytes(cls, v: str) -> str:
        return _validate_password_bcrypt_bytes(v)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class UserPublic(BaseModel):
    id: str
    email: str | None
    handle: str
