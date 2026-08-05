"""Load product catalog from MySQL (same DB as Node) or fall back to mock SKUs."""
from __future__ import annotations

import os
import time

from .catalog import MOCK_CATALOG, set_active_catalog


def _mysql_config() -> dict:
    return {
        "host": os.getenv("MYSQL_HOST", "127.0.0.1"),
        "port": int(os.getenv("MYSQL_PORT", "3306")),
        "user": os.getenv("MYSQL_USER", "root"),
        "password": os.getenv("MYSQL_PASSWORD", ""),
        "database": os.getenv("MYSQL_DATABASE", "pixelium_consent"),
    }


def _row_to_product(row: dict) -> dict:
    return {
        "sku": row["sku"],
        "name": row["name"],
        "category": row["category"],
        "price_cents": int(row["price_cents"]),
        "in_stock": int(row["in_stock"]),
    }


def fetch_all_products() -> list[dict] | None:
    """Load full catalog from MySQL. Returns None if DB is unavailable."""
    cfg = _mysql_config()
    try:
        import pymysql

        conn = pymysql.connect(
            host=cfg["host"],
            port=cfg["port"],
            user=cfg["user"],
            password=cfg["password"],
            database=cfg["database"],
            charset="utf8mb4",
            cursorclass=pymysql.cursors.DictCursor,
        )
        with conn.cursor() as cur:
            cur.execute(
                "SELECT sku, name, category, price_cents, in_stock FROM products ORDER BY name"
            )
            rows = cur.fetchall()
        conn.close()
        if not rows:
            return None
        return [_row_to_product(r) for r in rows]
    except Exception:
        return None


def fetch_product_by_sku(sku: str) -> dict | None:
    """Lazy lookup — used when in-memory cache missed a SKU (e.g. mock fallback at startup)."""
    cfg = _mysql_config()
    try:
        import pymysql

        conn = pymysql.connect(
            host=cfg["host"],
            port=cfg["port"],
            user=cfg["user"],
            password=cfg["password"],
            database=cfg["database"],
            charset="utf8mb4",
            cursorclass=pymysql.cursors.DictCursor,
        )
        with conn.cursor() as cur:
            cur.execute(
                "SELECT sku, name, category, price_cents, in_stock FROM products WHERE sku = %s LIMIT 1",
                (sku,),
            )
            row = cur.fetchone()
        conn.close()
        return _row_to_product(row) if row else None
    except Exception:
        return None


def load_catalog() -> None:
    for attempt in range(3):
        products = fetch_all_products()
        if products:
            set_active_catalog(products)
            print(f"Catalog loaded from MySQL: {len(products)} products")
            return
        if attempt < 2:
            time.sleep(1)

    print("MySQL catalog unavailable — using mock catalog (6 demo SKUs only)")
    set_active_catalog(MOCK_CATALOG)
    print(f"Mock catalog: {len(MOCK_CATALOG)} products")
