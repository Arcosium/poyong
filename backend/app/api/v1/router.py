"""/api/v1 라우터 집계."""

from fastapi import APIRouter

from app.api.v1 import auth, chat, glossary, policies, profile, recommendations, stats

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router)
api_router.include_router(chat.router)
api_router.include_router(profile.router)
api_router.include_router(policies.router)
api_router.include_router(recommendations.router)
api_router.include_router(glossary.router)
api_router.include_router(stats.router)
