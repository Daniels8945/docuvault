import os
import logging
from io import BytesIO
from datetime import timedelta

import urllib3
from minio import Minio

log = logging.getLogger("docuvault.storage")

S3_ENDPOINT   = os.getenv("S3_ENDPOINT",   "eu2.contabostorage.com")
S3_ACCESS_KEY = os.getenv("S3_ACCESS_KEY", "")
S3_SECRET_KEY = os.getenv("S3_SECRET_KEY", "")
S3_BUCKET     = os.getenv("S3_BUCKET",     "docuvualt")
S3_SECURE     = os.getenv("S3_SECURE",     "true").lower() == "true"

# 5 s connect timeout, 60 s read timeout (large files need the extra time)
_http = urllib3.PoolManager(
    timeout=urllib3.Timeout(connect=5, read=60),
    maxsize=10,
)

client = Minio(
    S3_ENDPOINT,
    access_key=S3_ACCESS_KEY,
    secret_key=S3_SECRET_KEY,
    secure=S3_SECURE,
    http_client=_http,
)


def upload_file(file_bytes: bytes, object_name: str, content_type: str) -> str:
    client.put_object(
        S3_BUCKET,
        object_name,
        BytesIO(file_bytes),
        length=len(file_bytes),
        content_type=content_type,
    )
    log.info("S3 upload OK  key=%s  size=%d", object_name, len(file_bytes))
    return object_name


def get_presigned_url(object_name: str, expires_hours: int = 1) -> str:
    return client.presigned_get_object(
        S3_BUCKET,
        object_name,
        expires=timedelta(hours=expires_hours),
    )


def stream_file(object_name: str, chunk_size: int = 65536):
    """Yield the object in chunks — never loads the whole file into memory."""
    response = client.get_object(S3_BUCKET, object_name)
    try:
        while True:
            chunk = response.read(chunk_size)
            if not chunk:
                break
            yield chunk
    finally:
        response.close()
        response.release_conn()


def get_file(object_name: str) -> bytes:
    """Read entire object into memory. Use stream_file() for large files."""
    response = client.get_object(S3_BUCKET, object_name)
    try:
        return response.read()
    finally:
        response.close()
        response.release_conn()


def delete_file(object_name: str):
    client.remove_object(S3_BUCKET, object_name)
    log.info("S3 delete OK  key=%s", object_name)
