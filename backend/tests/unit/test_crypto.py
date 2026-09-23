from app.core.crypto import decrypt_token, encrypt_token


def test_encrypt_decrypt_roundtrip() -> None:
    ciphertext, version = encrypt_token("super-secret-refresh-token")
    assert ciphertext != "super-secret-refresh-token"
    assert decrypt_token(ciphertext, version) == "super-secret-refresh-token"


def test_ciphertext_is_versioned() -> None:
    _, version = encrypt_token("token")
    assert version == "v1"
