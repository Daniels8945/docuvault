from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from database import get_session
from models import User, UserRead

router = APIRouter(prefix="/api/users", tags=["Users"])


@router.get("/me", response_model=UserRead)
def get_current_user(session: Session = Depends(get_session)):
    user = session.exec(select(User)).first()
    if not user:
        user = User(id="user_olaoluwa", name="Olaoluwa", email="olaoluwa@onction.com", role="admin")
        session.add(user)
        session.commit()
        session.refresh(user)
    return user
