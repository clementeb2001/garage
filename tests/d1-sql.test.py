"""Small in-memory SQL checks. No network, D1, credentials or real customer data."""
import json
from pathlib import Path
import re
import sqlite3
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]


class WriteBudgetSqlTests(unittest.TestCase):
    def test_schema_and_catalog_are_repeat_safe(self):
        planned = subprocess.check_output([
            "node", "-e",
            'console.log(JSON.stringify(require("./tools/prepare_admin_schema").planSchema({tables:{bookings:["id"]},indexes:[]})))'
        ], cwd=ROOT, text=True)
        db = sqlite3.connect(":memory:")
        db.execute("CREATE TABLE bookings (id INTEGER PRIMARY KEY)")
        for sql in json.loads(planned):
            db.execute(sql)
        db.executescript((ROOT / "worker/catalog-schema.sql").read_text())
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "tools").mkdir()
            (root / "worker").mkdir()
            (root / "tools/build_catalog_d1.js").write_text((ROOT / "tools/build_catalog_d1.js").read_text())
            (root / "shop-data.js").write_text('window.SHOP_PRODUCTS=[{i:"A",p:100},{i:"B",mf:"DBA",p:200}];window.SHOP_META={};')
            (root / "shop-data-dba.js").write_text('window.SHOP_IMAGES=[];')
            subprocess.check_output(["node", "tools/build_catalog_d1.js"], cwd=root)
            seed = (root / "worker/catalog-seed.sql").read_text()
            db.executescript(seed)
            changes = db.total_changes
            db.executescript(seed)
            self.assertEqual(db.total_changes, changes)
            self.assertEqual(db.execute("SELECT COUNT(*) FROM catalog_products").fetchone()[0], 2)
        # Native syntax for the actual capped UPSERT: ninth attempt changes nothing.
        source = (ROOT / "worker/admin-api.js").read_text()
        sql = re.search(r'prepare\("(INSERT INTO booking_rate_limits \(bucket,count,expires_at\).*?RETURNING count)"\)', source)[1]
        for count in range(1, 9):
            self.assertEqual(db.execute(sql, ("test", 123)).fetchone(), (count,))
        changes = db.total_changes
        self.assertIsNone(db.execute(sql, ("test", 456)).fetchone())
        self.assertEqual(db.total_changes, changes)
        self.assertEqual(db.execute("SELECT expires_at FROM booking_rate_limits").fetchone(), (123,))


if __name__ == "__main__":
    unittest.main()
