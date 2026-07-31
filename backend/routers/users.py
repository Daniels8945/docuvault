import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlmodel import Session, select

from auth import (
    create_access_token,
    get_current_user,
    hash_password,
    require_admin,
    verify_password,
)
from database import get_session
from models import User, UserCreate, UserRead, UserUpdate, UserPasswordReset

log = logging.getLogger("docuvault.users")

router = APIRouter(prefix="/api", tags=["Auth & Users"])


# ── Setup status (public) ──────────────────────────────────────────────────────

@router.get("/auth/setup-status", summary="Check whether initial admin setup is needed")
def setup_status(session: Session = Depends(get_session)):
    try:
        has_auth_user = session.exec(
            select(User).where(User.hashed_password.isnot(None))
        ).first()
        return {"setup_complete": bool(has_auth_user)}
    except OperationalError:
        # Column missing — treat as setup needed
        return {"setup_complete": False}


# ── Register first admin ────────────────────────────────────────────────────────

@router.post("/auth/register", response_model=UserRead, summary="Create the initial admin account")
def register_first_admin(req: UserCreate, session: Session = Depends(get_session)):
    """
    Open only when NO user with a password exists yet (fresh install or upgrade
    from a pre-auth version). Creates the account as admin regardless of the
    role field. Subsequent user accounts must be created by an admin via POST /api/users.
    """
    try:
        has_auth_user = session.exec(
            select(User).where(User.hashed_password.isnot(None))
        ).first()
    except OperationalError as exc:
        log.error("register: DB error checking for existing admin — %s", exc)
        raise HTTPException(
            status_code=500,
            detail=f"Database error: {exc.orig}. The hashed_password column may be missing — run the migration.",
        )

    if has_auth_user:
        raise HTTPException(
            status_code=403,
            detail="Initial setup is complete. An admin must create additional accounts.",
        )

    if session.exec(select(User).where(User.email == req.email)).first():
        raise HTTPException(status_code=400, detail="Email already in use")

    try:
        user = User(
            name=req.name,
            email=req.email,
            role="admin",
            hashed_password=hash_password(req.password),
        )
        session.add(user)
        session.commit()
        session.refresh(user)
    except IntegrityError as exc:
        session.rollback()
        log.error("register: integrity error — %s", exc)
        raise HTTPException(status_code=400, detail="Email already in use")
    except OperationalError as exc:
        session.rollback()
        log.error("register: DB operational error — %s", exc)
        raise HTTPException(status_code=500, detail=f"Database error: {exc.orig}")

    log.info("Initial admin registered: id=%s  email=%s", user.id, user.email)
    return user


# ── Login ──────────────────────────────────────────────────────────────────────

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserRead


@router.post("/auth/login", response_model=TokenResponse, summary="Obtain a JWT access token")
def login(
    form: OAuth2PasswordRequestForm = Depends(),
    session: Session = Depends(get_session),
):
    user = session.exec(select(User).where(User.email == form.username)).first()
    if not user or not user.hashed_password or not verify_password(form.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    token = create_access_token(user.id, user.role)
    log.info("Login: id=%s  email=%s  role=%s", user.id, user.email, user.role)
    return {"access_token": token, "token_type": "bearer", "user": user}


# ── Current user ───────────────────────────────────────────────────────────────

@router.get("/users/me", response_model=UserRead, summary="Get the authenticated user")
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


# ── Admin: manage users ────────────────────────────────────────────────────────

@router.get("/users", response_model=List[UserRead], summary="List all users (admin only)")
def list_users(
    session: Session = Depends(get_session),
    _admin: User = Depends(require_admin),
):
    return session.exec(select(User)).all()


@router.post("/users", response_model=UserRead, summary="Create a user (admin only)")
def create_user(
    req: UserCreate,
    session: Session = Depends(get_session),
    _admin: User = Depends(require_admin),
):
    if session.exec(select(User).where(User.email == req.email)).first():
        raise HTTPException(status_code=400, detail="Email already in use")
    user = User(
        name=req.name,
        email=req.email,
        role=req.role,
        hashed_password=hash_password(req.password),
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    log.info("User created by admin: id=%s  email=%s  role=%s", user.id, user.email, user.role)
    return user


@router.patch("/users/{user_id}", response_model=UserRead, summary="Update a user's profile (admin only)")
def update_user(
    user_id: str,
    req: UserUpdate,
    session: Session = Depends(get_session),
    _admin: User = Depends(require_admin),
):
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    data = req.dict(exclude_unset=True)
    if "email" in data and data["email"] != user.email:
        if session.exec(select(User).where(User.email == data["email"])).first():
            raise HTTPException(status_code=400, detail="Email already in use")

    for key, value in data.items():
        setattr(user, key, value)

    try:
        session.add(user)
        session.commit()
        session.refresh(user)
    except IntegrityError:
        session.rollback()
        raise HTTPException(status_code=400, detail="Email already in use")

    log.info("User updated by admin: id=%s", user.id)
    return user


@router.post("/users/{user_id}/reset-password", summary="Reset a user's password (admin only)")
def reset_user_password(
    user_id: str,
    req: UserPasswordReset,
    session: Session = Depends(get_session),
    _admin: User = Depends(require_admin),
):
    if len(req.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.hashed_password = hash_password(req.new_password)
    session.add(user)
    session.commit()
    log.info("Password reset by admin for user: id=%s", user.id)
    return {"message": "Password reset successfully"}


@router.delete("/users/{user_id}", summary="Delete a user (admin only)")
def delete_user(
    user_id: str,
    session: Session = Depends(get_session),
    admin: User = Depends(require_admin),
):
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    session.delete(user)
    session.commit()
    return {"message": "User deleted"}
