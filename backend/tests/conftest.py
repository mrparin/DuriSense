import os

os.environ.setdefault("DURISENSE_ENVIRONMENT", "test")
os.environ.setdefault("DURISENSE_DATABASE_URL", "sqlite+aiosqlite:///./test.db")
os.environ.setdefault("DURISENSE_SECRET_KEY", "test-secret-key-at-least-32-characters")
os.environ.setdefault("DURISENSE_COOKIE_SECURE", "false")
os.environ.setdefault("DURISENSE_EXPOSE_DEV_TOKENS", "true")

import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.db.base import Base
from app.db.session import engine
from app.main import app


@pytest_asyncio.fixture(autouse=True)
async def clean_database():
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.drop_all)
        await connection.run_sync(Base.metadata.create_all)
    yield


@pytest_asyncio.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver") as value:
        yield value
