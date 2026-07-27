"""Authentication routes."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ...core.exceptions import SentinelError
from ...core.response import success
from ...core.security import create_access_token, hash_password, verify_password
from ...models.user import User
from ...schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserOut
from ..deps import get_current_user, get_db

router = APIRouter(prefix="/auth", tags=["auth"])

# Roles a user may self-assign at registration (never Admin/ProjectManager).
_SELF_SERVE_ROLES = {"Contributor", "Viewer", "TeamLead"}


@router.post("/register", status_code=201)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == body.email).first():
        raise SentinelError(
            error_code="email_taken",
            message="An account with that email already exists.",
            suggested_action="Sign in instead, or use a different email.",
            status_code=409,
        )
    role = body.role if body.role in _SELF_SERVE_ROLES else "Contributor"
    user = User(email=body.email, full_name=body.full_name, role=role,
                hashed_password=hash_password(body.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token(user.email, {"role": user.role})
    response = TokenResponse(access_token=token, user=UserOut.model_validate(user))
    return success(response.model_dump())


@router.post("/login")
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email, User.is_deleted.is_(False)).first()
    if not user or not verify_password(body.password, user.hashed_password):
        raise SentinelError(
            error_code="invalid_credentials",
            message="Email or password is incorrect.",
            suggested_action="Check your credentials and try again.",
            status_code=401,
        )
    token = create_access_token(user.email, {"role": user.role})
    response = TokenResponse(access_token=token, user=UserOut.model_validate(user))
    return success(response.model_dump())


@router.get("/me")
def me(user: User = Depends(get_current_user)):
    return success(UserOut.model_validate(user).model_dump())
