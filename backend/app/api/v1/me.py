"""Minimal authenticated route — proves get_current_principal works
end-to-end and gives the frontend something to call with its session
token. Expand into a real profile endpoint once app/db/models/user.py
needs to be joined against the authenticated principal."""

from fastapi import APIRouter, Depends

from app.core.security import Principal, get_current_principal

router = APIRouter(tags=["me"])


@router.get("/me")
async def read_me(principal: Principal = Depends(get_current_principal)) -> dict:
    return {
        "user_id": principal.user_id,
        "session_id": principal.session_id,
        "org_id": principal.org_id,
        "org_role": principal.org_role,
    }
