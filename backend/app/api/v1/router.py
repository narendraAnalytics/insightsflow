"""Aggregates every v1 route module under one router that main.py mounts
at /api/v1. Add new route modules here as phases add them (connections,
runs, insights, billing, webhooks/...)."""

from fastapi import APIRouter

from app.api.v1 import connections, health, insights, me
from app.api.v1.webhooks import clerk as clerk_webhooks

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(me.router)
api_router.include_router(connections.router)
api_router.include_router(insights.router)
api_router.include_router(clerk_webhooks.router)
