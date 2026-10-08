CREATE TABLE IF NOT EXISTS catalog_versions (
  version TEXT PRIMARY KEY,
  product_count INTEGER NOT NULL,
  remus_count INTEGER NOT NULL,
  dba_count INTEGER NOT NULL,
  meta_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS catalog_products (
  version TEXT NOT NULL,
  sku TEXT NOT NULL,
  manufacturer TEXT NOT NULL,
  price_cents INTEGER NOT NULL CHECK (price_cents > 0),
  payload_json TEXT NOT NULL,
  PRIMARY KEY (version, sku)
);
CREATE INDEX IF NOT EXISTS idx_catalog_products_source ON catalog_products(version, manufacturer, sku);
CREATE TABLE IF NOT EXISTS catalog_metadata (
  version TEXT NOT NULL,
  meta_key TEXT NOT NULL,
  value_json TEXT NOT NULL,
  PRIMARY KEY (version, meta_key)
);
CREATE TABLE IF NOT EXISTS catalog_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
