from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.routes import alerts, anomaly, chat, challenges, community, forecast, health, safety, species
from app.core.config import settings
from app.db.base import Base
from app.db.seed import seed_if_empty
from app.db.session import SessionLocal, engine
from app.db.sqlite_fts import rebuild_posts_fts


@asynccontextmanager
async def lifespan(_app: FastAPI):
    if settings.create_tables_on_startup:
        Base.metadata.create_all(bind=engine)
        with SessionLocal() as session:
            seed_if_empty(session)
            session.commit()
        rebuild_posts_fts(engine)
    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)

app.include_router(health.router, prefix=settings.api_prefix)
app.include_router(forecast.router, prefix=settings.api_prefix)
app.include_router(safety.router, prefix=settings.api_prefix)
app.include_router(species.router, prefix=settings.api_prefix)
app.include_router(anomaly.router, prefix=settings.api_prefix)
app.include_router(alerts.router, prefix=settings.api_prefix)
app.include_router(chat.router, prefix=settings.api_prefix)
app.include_router(community.router, prefix=settings.api_prefix)
app.include_router(challenges.router, prefix=settings.api_prefix)


@app.get("/")
def root() -> dict[str, str]:
    return {
        "service": settings.app_name,
        "status": "ok",
        "docs": "/docs",
    }
