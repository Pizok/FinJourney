from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.db.supabase import init_supabase
from app.api.v1.api import api_router
from app.journey.router import router as journey_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize Supabase client pool on server boot
    await init_supabase()
    yield

app = FastAPI(
    title="FinJourney API",
    version="1.0.0",
    lifespan=lifespan
)

import os

# Enable CORS for the Next.js frontend
frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
# If you have multiple origins, you can split by comma
origins = [url.strip() for url in frontend_url.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount the central v1 API assembly
app.include_router(api_router, prefix="/api/v1")
app.include_router(journey_router)

@app.get("/health")
async def health_check():
    return {"status": "online", "environment": settings.environment}