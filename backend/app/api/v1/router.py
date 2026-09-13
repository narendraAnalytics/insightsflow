"""Aggregates every v1 route module under one router that main.py mounts
at /api/v1. Add new route modules here as phases add them (connections,
runs, insights, billing, webhooks/...)."""

from fastapi import APIRouter

from app.api.v1 import health

api_router = APIRouter()
api_router.include_router(health.router)
