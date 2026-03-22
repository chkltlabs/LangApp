from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, declarative_base, sessionmaker

from app.config import get_settings

Base = declarative_base()
_engine = None
_SessionLocal = None


def reset_engine() -> None:
    """Clear global engine/session (used by tests to swap DATABASE_URL)."""
    global _engine, _SessionLocal
    _engine = None
    _SessionLocal = None


def init_engine():
    global _engine, _SessionLocal
    if _engine is None:
        settings = get_settings()
        connect_args = {}
        if settings.database_url.startswith("sqlite"):
            connect_args["check_same_thread"] = False
        _engine = create_engine(settings.database_url, connect_args=connect_args)
        _SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_engine)
    return _engine


def get_session_local():
    if _SessionLocal is None:
        init_engine()
    return _SessionLocal


def get_db() -> Generator[Session, None, None]:
    SessionLocal = get_session_local()
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _migrate_schema(engine):
    from sqlalchemy import inspect, text

    insp = inspect(engine)
    if "cards" in insp.get_table_names():
        cols = {c["name"] for c in insp.get_columns("cards")}
        if "intro_complete" not in cols:
            with engine.begin() as conn:
                conn.execute(
                    text("ALTER TABLE cards ADD COLUMN intro_complete BOOLEAN NOT NULL DEFAULT 1")
                )


def init_db():
    from app import models  # noqa: F401

    init_engine()
    Base.metadata.create_all(bind=_engine)
    _migrate_schema(_engine)
    SessionLocal = get_session_local()
    db = SessionLocal()
    try:
        if not db.query(models.Deck).filter(models.Deck.is_default.is_(True)).first():
            db.add(models.Deck(name="Default", is_default=True))
            db.commit()
    finally:
        db.close()
