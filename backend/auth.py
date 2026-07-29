import os
import logging
from datetime import datetime, timedelta
from typing import Optional

import bcrypt as _bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlmodel import Session, select

from database import get_session

log = logging.getLogger("docuvault.auth")

SECRET_KEY      = os.getenv("JWT_SECRET", "insecure-dev-secret-change-in-production")
ALGORITHM       = "HS256"
EXPIRE_MINUTES  = int(os.getenv("JWT_EXPIRE_MINUTES", "480"))  # 8-hour session

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


# ── Password helpers ───────────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    return _bcrypt.hashpw(password.encode(), _bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return _bcrypt.checkpw(plain.encode(), hashed.encode())


# ── Token helpers ──────────────────────────────────────────────────────────────

def create_access_token(user_id: str, role: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=EXPIRE_MINUTES)
    return jwt.encode(
        {"sub": user_id, "role": role, "exp": expire},
        SECRET_KEY,
        algorithm=ALGORITHM,
    )


# ── FastAPI dependencies ───────────────────────────────────────────────────────

def get_current_user(
    token: str = Depends(oauth2_scheme),
    session: Session = Depends(get_session),
):
    """Decode JWT and return the authenticated User. Raises 401 on failure."""
    from models import User  # local import avoids circular dependency

    exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired session — please log in again",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: Optional[str] = payload.get("sub")
        if not user_id:
            raise exc
    except JWTError:
        raise exc

    user = session.get(User, user_id)
    if not user:
        raise exc
    return user


def require_admin(current_user=Depends(get_current_user)):
    """Raises 403 if the authenticated user is not an admin."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")
    return current_user


def require_editor(current_user=Depends(get_current_user)):
    """Raises 403 if the authenticated user is a viewer (read-only)."""
    if current_user.role not in ("admin", "editor"):
        raise HTTPException(status_code=403, detail="Editor role required")
    return current_user
