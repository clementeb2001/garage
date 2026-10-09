-- Idempotent correction confirmed by the business owner on 2026-10-09.
-- The old public Renault Master record used a EUR 300 deposit.
UPDATE maintenance
SET deposit = 250, updated_at = CURRENT_TIMESTAMP, updated_by = 'deployment-migration'
WHERE lower(vehicle) LIKE '%renault%master%'
  AND deposit = 300;

-- Additiv Clientedatebank: Originalufroen a Reservatioune bleiwen onverännert.
INSERT INTO customers (name,email,phone,source)
SELECT a.name,a.email,a.phone,'appointment'
FROM appointments a
WHERE trim(COALESCE(a.name,''))<>'' AND trim(COALESCE(a.email,''))<>''
  AND a.id=(SELECT MIN(a2.id) FROM appointments a2 WHERE lower(trim(a2.email))=lower(trim(a.email)))
  AND NOT EXISTS (SELECT 1 FROM customers c WHERE lower(trim(COALESCE(c.email,'')))=lower(trim(a.email)));

INSERT INTO customers (name,email,phone,source)
SELECT b.cust_name,b.cust_email,b.cust_phone,'rental'
FROM bookings b
WHERE trim(COALESCE(b.cust_name,''))<>'' AND trim(COALESCE(b.cust_email,''))<>''
  AND b.id=(SELECT MIN(b2.id) FROM bookings b2 WHERE lower(trim(b2.cust_email))=lower(trim(b.cust_email)))
  AND NOT EXISTS (SELECT 1 FROM customers c WHERE lower(trim(COALESCE(c.email,'')))=lower(trim(b.cust_email)));

INSERT INTO customer_vehicles (customer_id,make_model,vin)
SELECT c.id,a.vehicle,a.vin
FROM appointments a
JOIN customers c ON lower(trim(COALESCE(c.email,'')))=lower(trim(COALESCE(a.email,'')))
WHERE trim(COALESCE(a.vehicle,''))<>''
  AND NOT EXISTS (
    SELECT 1 FROM customer_vehicles v
    WHERE v.customer_id=c.id AND lower(trim(v.make_model))=lower(trim(a.vehicle))
      AND lower(trim(COALESCE(v.vin,'')))=lower(trim(COALESCE(a.vin,'')))
  );

INSERT INTO work_orders (appointment_id,customer_id,title,status,assigned_to,planned_minutes,description)
SELECT a.id,(SELECT MIN(c.id) FROM customers c WHERE lower(trim(COALESCE(c.email,'')))=lower(trim(COALESCE(a.email,'')))),COALESCE(NULLIF(trim(a.service),''),'Rendez-vous'),
       CASE WHEN a.status='done' THEN 'collected' ELSE 'planned' END,
       a.assigned_to,a.duration_min,a.msg
FROM appointments a
WHERE a.kind='appointment' AND a.status IN ('confirmed','done')
  AND NOT EXISTS (SELECT 1 FROM work_orders w WHERE w.appointment_id=a.id);

UPDATE work_orders
SET reference='AB-A-' || strftime('%Y','now') || '-' || printf('%04d',id)
WHERE reference IS NULL OR reference='';
