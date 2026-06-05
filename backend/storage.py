import os
from io import BytesIO
from datetime import timedelta
from minio import Minio

MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "localhost:9000")
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY", "minioadmin")
MINIO_BUCKET = os.getenv("MINIO_BUCKET", "docuvault")
MINIO_SECURE = os.getenv("MINIO_SECURE", "false").lower() == "true"

client = Minio(
    MINIO_ENDPOINT,
    access_key=MINIO_ACCESS_KEY,
    secret_key=MINIO_SECRET_KEY,
    secure=MINIO_SECURE,
)


def upload_file(file_bytes: bytes, object_name: str, content_type: str) -> str:
    client.put_object(
        MINIO_BUCKET,
        object_name,
        BytesIO(file_bytes),
        length=len(file_bytes),
        content_type=content_type,
    )
    return object_name


def get_presigned_url(object_name: str, expires_hours: int = 1) -> str:
    return client.presigned_get_object(
        MINIO_BUCKET,
        object_name,
        expires=timedelta(hours=expires_hours),
    )


def delete_file(object_name: str):
    client.remove_object(MINIO_BUCKET, object_name)
