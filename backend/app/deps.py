from fastapi import Depends, HTTPException, Request, status

from app.config import Settings, get_settings


def require_api_key(request: Request, settings: Settings = Depends(get_settings)) -> None:
    if not settings.api_key:
        return
    key = request.headers.get("x-api-key")
    if key != settings.api_key:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or missing API key")
