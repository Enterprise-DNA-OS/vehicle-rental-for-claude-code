CREATE FUNCTION touch_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;
CREATE TABLE vehicles (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), plate text NOT NULL UNIQUE, model text NOT NULL,
 category text NOT NULL, location text NOT NULL, jurisdiction text NOT NULL DEFAULT 'NZ' CHECK(jurisdiction IN ('NZ','AU')),
 daily_cents integer NOT NULL CHECK(daily_cents>=0), currency text NOT NULL DEFAULT 'NZD' CHECK(currency IN ('NZD','AUD')),
 odometer integer NOT NULL DEFAULT 0 CHECK(odometer>=0), service_km integer NOT NULL CHECK(service_km>0),
 service_due date, inspection_expires date, registration_expires date,
 status text NOT NULL DEFAULT 'ready' CHECK(status IN ('ready','cleaning','workshop','retired')),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE drivers (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), external_id text UNIQUE, name text NOT NULL, email text,
 address text, dob date, phone text, licence_number text, licence_jurisdiction text, licence_expires date,
 licence_checked_at timestamptz, class_verified boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE bookings (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ref text NOT NULL UNIQUE, vehicle_id uuid NOT NULL REFERENCES vehicles,
 driver_id uuid NOT NULL REFERENCES drivers, pickup_at timestamptz NOT NULL, return_due timestamptz NOT NULL,
 pickup_location text NOT NULL, return_location text NOT NULL,
 status text NOT NULL DEFAULT 'reserved' CHECK(status IN ('reserved','out','returned','cancelled')),
 rate_cents integer NOT NULL CHECK(rate_cents>=0), extras_cents integer NOT NULL DEFAULT 0 CHECK(extras_cents>=0),
 currency text NOT NULL CHECK(currency IN ('NZD','AUD')), paid_cents integer NOT NULL DEFAULT 0 CHECK(paid_cents>=0),
 excess_cents integer NOT NULL DEFAULT 0 CHECK(excess_cents>=0), agreement_ref text, agreement_given_at timestamptz,
 insurance_offered_at timestamptz, terms_reviewed boolean NOT NULL DEFAULT false, precheck_at timestamptz,
 checkout_at timestamptz, returned_at timestamptz, km_out integer, km_in integer, fuel_out text, fuel_in text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(return_due>pickup_at), CHECK(km_in IS NULL OR km_in>=km_out),
 CHECK(status!='out' OR checkout_at IS NOT NULL), CHECK(status!='returned' OR returned_at IS NOT NULL)
);
CREATE TABLE booking_drivers (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), booking_id uuid NOT NULL REFERENCES bookings, driver_id uuid NOT NULL REFERENCES drivers,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(booking_id,driver_id)
);
CREATE TABLE damage (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), booking_id uuid NOT NULL REFERENCES bookings, description text NOT NULL,
 estimated_cents integer NOT NULL DEFAULT 0 CHECK(estimated_cents>=0), decision text NOT NULL DEFAULT 'open' CHECK(decision IN ('open','charge','waive')),
 evidence_ref text, decision_note text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE infringements (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), booking_id uuid NOT NULL REFERENCES bookings, notice_ref text NOT NULL UNIQUE,
 occurred_at timestamptz NOT NULL, authority text NOT NULL, due_date date NOT NULL,
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','nominated','disputed','closed')), evidence_ref text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE services (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), vehicle_id uuid NOT NULL REFERENCES vehicles, description text NOT NULL,
 done_at timestamptz NOT NULL DEFAULT now(), odometer integer NOT NULL CHECK(odometer>=0), cost_cents integer NOT NULL CHECK(cost_cents>=0),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE notes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), booking_id uuid NOT NULL REFERENCES bookings, body text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['vehicles','drivers','bookings','booking_drivers','damage','infringements','services','notes'] LOOP
 EXECUTE format('CREATE TRIGGER touch BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION touch_updated_at()',t);
END LOOP; END $$;
-- Lock the fleet row before checking overlaps: concurrent desk bookings serialize on that vehicle.
CREATE FUNCTION prevent_double_booking() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM id FROM vehicles WHERE id=NEW.vehicle_id FOR UPDATE;
 IF NEW.status IN ('reserved','out') AND EXISTS (
 SELECT 1 FROM bookings b WHERE b.vehicle_id=NEW.vehicle_id AND b.id<>NEW.id AND b.status IN ('reserved','out')
 AND tstzrange(b.pickup_at,b.return_due,'[)') && tstzrange(NEW.pickup_at,NEW.return_due,'[)')) THEN
 RAISE EXCEPTION 'Vehicle already booked in this interval'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER no_overlap BEFORE INSERT OR UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION prevent_double_booking();
CREATE INDEX booking_vehicle_dates ON bookings(vehicle_id,pickup_at,return_due);
CREATE VIEW rental_board AS
 SELECT b.id,b.ref,v.plate,v.category,d.name AS driver,b.status,b.pickup_at,b.return_due,b.returned_at,
 b.pickup_location,b.return_location,b.currency,
 greatest(1,ceil(extract(epoch FROM (coalesce(b.returned_at,b.return_due)-b.pickup_at))/86400))::int AS hire_days,
 (greatest(1,ceil(extract(epoch FROM (coalesce(b.returned_at,b.return_due)-b.pickup_at))/86400))::bigint*b.rate_cents+b.extras_cents+
 coalesce((SELECT sum(estimated_cents) FROM damage WHERE booking_id=b.id AND decision='charge'),0)) AS total_cents,
 b.paid_cents,
 (greatest(1,ceil(extract(epoch FROM (coalesce(b.returned_at,b.return_due)-b.pickup_at))/86400))::bigint*b.rate_cents+b.extras_cents+
 coalesce((SELECT sum(estimated_cents) FROM damage WHERE booking_id=b.id AND decision='charge'),0)-b.paid_cents) AS balance_cents,
 CASE WHEN b.status='out' AND b.return_due<now() THEN ceil(extract(epoch FROM(now()-b.return_due))/3600)::int ELSE 0 END AS hours_overdue
 FROM bookings b JOIN vehicles v ON v.id=b.vehicle_id JOIN drivers d ON d.id=b.driver_id;
CREATE VIEW fleet_readiness AS
 SELECT v.*, concat_ws('; ',
 CASE WHEN status!='ready' THEN status END,
 CASE WHEN inspection_expires IS NULL OR inspection_expires<current_date THEN 'inspection missing or expired' END,
 CASE WHEN registration_expires IS NULL OR registration_expires<current_date THEN 'registration missing or expired' END,
 CASE WHEN service_due IS NULL OR service_due<current_date OR odometer>=service_km THEN 'service due' END) AS blockers
 FROM vehicles v;
CREATE VIEW compliance_findings AS
 SELECT b.id,b.ref,'LICENCE'::text AS rule,'Primary driver licence evidence missing, expired or class unverified'::text AS finding
 FROM bookings b JOIN drivers d ON d.id=b.driver_id WHERE b.status IN ('reserved','out') AND
 (d.licence_number IS NULL OR d.licence_expires IS NULL OR d.licence_expires<greatest(current_date,b.return_due::date) OR d.licence_checked_at IS NULL OR NOT d.class_verified)
 UNION ALL SELECT b.id,b.ref,'LICENCE','Additional driver licence evidence missing, expired or class unverified'
 FROM bookings b JOIN booking_drivers bd ON bd.booking_id=b.id JOIN drivers d ON d.id=bd.driver_id WHERE b.status IN ('reserved','out') AND
 (d.licence_number IS NULL OR d.licence_expires IS NULL OR d.licence_expires<greatest(current_date,b.return_due::date) OR d.licence_checked_at IS NULL OR NOT d.class_verified)
 UNION ALL SELECT b.id,b.ref,'AGREEMENT','Agreement reference, copy, reviewed terms or insurance offer missing'
 FROM bookings b WHERE status IN ('reserved','out') AND (agreement_ref IS NULL OR agreement_given_at IS NULL OR insurance_offered_at IS NULL OR NOT terms_reviewed)
 UNION ALL SELECT b.id,b.ref,'ROADWORTHINESS',f.blockers FROM bookings b JOIN fleet_readiness f ON f.id=b.vehicle_id
 WHERE b.status IN ('reserved','out') AND (f.blockers<>'' OR f.inspection_expires<b.return_due::date OR f.registration_expires<b.return_due::date)
 UNION ALL SELECT b.id,b.ref,'PRECHECK','Departure condition check missing' FROM bookings b WHERE status IN ('reserved','out') AND precheck_at IS NULL;
CREATE VIEW attention_queue AS
 SELECT ref,'late return'::text AS issue,hours_overdue::text||' hours' AS detail FROM rental_board WHERE hours_overdue>0
 UNION ALL SELECT plate,'fleet readiness',blockers FROM fleet_readiness WHERE blockers<>''
 UNION ALL SELECT b.ref,'damage decision',d.description FROM damage d JOIN bookings b ON b.id=d.booking_id WHERE d.decision='open'
 UNION ALL SELECT b.ref,'notice deadline',i.notice_ref||' due '||i.due_date::text FROM infringements i JOIN bookings b ON b.id=i.booking_id WHERE i.status='open' AND i.due_date<=current_date+7
 UNION ALL SELECT b.ref,'unpaid return',b.currency||' '||(b.balance_cents/100.0)::numeric(12,2)::text FROM rental_board b WHERE b.status='returned' AND b.balance_cents>0;
