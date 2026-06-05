from fastapi import APIRouter, HTTPException, Depends
from sqlmodel import Session, select
from typing import List, Optional

from database import get_session
from models import Folder, FolderCreate, FolderRead

router = APIRouter(prefix="/api/folders", tags=["Folders"])


@router.get("", response_model=List[FolderRead])
def get_folders(workspace_id: Optional[str] = None, session: Session = Depends(get_session)):
    query = select(Folder)
    if workspace_id:
        query = query.where(Folder.workspace_id == workspace_id)
    return session.exec(query).all()


@router.post("", response_model=FolderRead)
def create_folder(folder: FolderCreate, session: Session = Depends(get_session)):
    db_folder = Folder.from_orm(folder)
    session.add(db_folder)
    session.commit()
    session.refresh(db_folder)
    return db_folder


@router.get("/{folder_id}", response_model=FolderRead)
def get_folder(folder_id: str, session: Session = Depends(get_session)):
    folder = session.get(Folder, folder_id)
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    return folder


@router.delete("/{folder_id}")
def delete_folder(folder_id: str, session: Session = Depends(get_session)):
    folder = session.get(Folder, folder_id)
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    session.delete(folder)
    session.commit()
    return {"message": "Folder deleted"}
