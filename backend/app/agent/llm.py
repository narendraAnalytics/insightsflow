"""ChatSarvam construction. Key/model come from Settings, never os.environ."""

from langchain_sarvam import ChatSarvam

from app.core.config import get_settings
from app.core.errors import AppError


class LLMNotConfigured(AppError):
    status_code = 503
    code = "llm_not_configured"


def build_llm() -> ChatSarvam:
    settings = get_settings()
    if not settings.sarvam_api_key:
        raise LLMNotConfigured("SARVAM_API_KEY is not set")
    return ChatSarvam(
        model=settings.sarvam_model,
        api_key=settings.sarvam_api_key,
        max_tokens=settings.sarvam_max_tokens,
        reasoning_effort="low",
        streaming=True,
    )
