-- Idempotent correction confirmed by the business owner on 2026-10-09.
-- The old public Renault Master record used a EUR 300 deposit.
UPDATE maintenance
SET deposit = 250, updated_at = CURRENT_TIMESTAMP, updated_by = 'deployment-migration'
WHERE lower(vehicle) LIKE '%renault%master%'
  AND deposit = 300;
