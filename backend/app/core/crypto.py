"""Encrypt/decrypt OAuth tokens at rest (Fernet, versioned keys).

TOKEN_ENCRYPTION_KEYS is "v1:base64fernetkey" (comma-separated for
rotation, e.g. "v1:oldkey,v2:newkey"). New encryptions always use the
last entry; decryption looks the key up by the version stored alongside
the ciphertext (app/db/models/connection.py's key_version column) so
rotating keys doesn't break existing rows.
"""

from functools import lru_cache

from cryptography.fernet import Fernet

from app.core.config import get_settings
from app.core.errors import AppError


class EncryptionNotConfigured(AppError):
    status_code = 500
    code = "encryption_not_configured"


def _parse_keys(raw: str) -> dict[str, Fernet]:
    keys: dict[str, Fernet] = {}
    for entry in raw.split(","):
        entry = entry.strip()
        if not entry:
            continue
        version, _, key = entry.partition(":")
        if not version or not key:
            raise EncryptionNotConfigured(
                f"Malformed TOKEN_ENCRYPTION_KEYS entry (expected 'version:key'): {entry!r}"
            )
        keys[version] = Fernet(key.encode())
    if not keys:
        raise EncryptionNotConfigured("TOKEN_ENCRYPTION_KEYS is not configured")
    return keys


@lru_cache
def _keys() -> dict[str, Fernet]:
    settings = get_settings()
    if not settings.token_encryption_keys:
        raise EncryptionNotConfigured("TOKEN_ENCRYPTION_KEYS is not configured")
    return _parse_keys(settings.token_encryption_keys)


@lru_cache
def _latest_version() -> str:
    return list(_keys().keys())[-1]


def encrypt_token(plaintext: str) -> tuple[str, str]:
    """Returns (ciphertext, key_version) using the newest configured key."""
    version = _latest_version()
    ciphertext = _keys()[version].encrypt(plaintext.encode()).decode()
    return ciphertext, version


def decrypt_token(ciphertext: str, key_version: str) -> str:
    fernet = _keys().get(key_version)
    if fernet is None:
        raise EncryptionNotConfigured(f"No encryption key configured for version {key_version!r}")
    return fernet.decrypt(ciphertext.encode()).decode()
