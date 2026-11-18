"""Tiny SQLite store for users, login codes, sessions and site ownership.

SQLite is a single file (DB_PATH), needs no server and is plenty for this stage.
The same tables map 1:1 to Postgres later.
"""
import sqlite3
import threading
from contextlib import contextmanager

from . import config

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_login_at TEXT
);
CREATE TABLE IF NOT EXISTS login_codes (
  email TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  sent_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS login_throttle (
  email TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  sends INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  user_agent TEXT
);
CREATE TABLE IF NOT EXISTS sites (
  slug TEXT PRIMARY KEY,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sites_owner ON sites(owner_id);
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL,
  number INTEGER NOT NULL,
  items TEXT NOT NULL,
  total REAL NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  address TEXT,
  pincode TEXT,
  payment_method TEXT NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'pending',
  status TEXT NOT NULL DEFAULT 'new',
  channel TEXT NOT NULL DEFAULT 'website',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT,
  UNIQUE (slug, number)
);
CREATE INDEX IF NOT EXISTS idx_orders_slug ON orders(slug);
CREATE TABLE IF NOT EXISTS photos (
  photo_id TEXT PRIMARY KEY,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
"""
# Schema changes after the first release. Each runs once, in order; the applied version is stored in the database.
MIGRATIONS = [
    "ALTER TABLE orders ADD COLUMN paid_confirmed_at TEXT",
    "ALTER TABLE orders ADD COLUMN paid_confirmed_by TEXT",
    "ALTER TABLE orders ADD COLUMN idempotency_key TEXT",
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_idem ON orders(slug, idempotency_key) WHERE idempotency_key IS NOT NULL",
    """CREATE TABLE IF NOT EXISTS enquiries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL,
      data TEXT NOT NULL,
      channel TEXT NOT NULL DEFAULT 'website',
      received_at TEXT NOT NULL
    )""",
    "CREATE INDEX IF NOT EXISTS idx_enquiries_slug ON enquiries(slug, id)",
]
_init_lock = threading.Lock()
_ready = False


def _migrate(conn: sqlite3.Connection) -> None:
    conn.executescript(SCHEMA)
    version = conn.execute("PRAGMA user_version").fetchone()[0]
    for n, sql in enumerate(MIGRATIONS[version:], start=version + 1):
        try:
            conn.execute(sql)
        except sqlite3.OperationalError as exc:  # databases created before versioning already have early columns
            if "duplicate column" not in str(exc):
                raise
        conn.execute(f"PRAGMA user_version = {n}")
    conn.commit()


def _connect() -> sqlite3.Connection:
    global _ready
    if not _ready:
        config.DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(config.DB_PATH, timeout=15, isolation_level=None)  # explicit transactions below
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA busy_timeout = 15000")
    if not _ready:
        with _init_lock:
            if not _ready:
                conn.execute("PRAGMA journal_mode = WAL")
                _migrate(conn)
                _ready = True
    return conn


@contextmanager
def tx():
    """One write transaction. BEGIN IMMEDIATE takes SQLite's write lock up front, so read-then-write
    sequences (like the next order number) are safe across threads and processes."""
    conn = _connect()
    try:
        conn.execute("BEGIN IMMEDIATE")
        yield conn
        conn.execute("COMMIT")
    except BaseException:
        if conn.in_transaction:
            conn.execute("ROLLBACK")
        raise
    finally:
        conn.close()


def one(sql: str, *args):
    conn = _connect()
    try:
        row = conn.execute(sql, args).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def all_(sql: str, *args) -> list[dict]:
    conn = _connect()
    try:
        return [dict(r) for r in conn.execute(sql, args).fetchall()]
    finally:
        conn.close()


def run(sql: str, *args) -> int:
    with tx() as c:
        return c.execute(sql, args).lastrowid
