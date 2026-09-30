ALTER TABLE bookings ADD CONSTRAINT checkout_after_start CHECK (checkout_at IS NULL OR checkout_at>=pickup_at);
ALTER TABLE bookings ADD CONSTRAINT return_after_checkout CHECK (returned_at IS NULL OR (checkout_at IS NOT NULL AND returned_at>=checkout_at));
ALTER TABLE bookings ADD CONSTRAINT valid_meters CHECK ((km_out IS NULL OR km_out>=0) AND (km_in IS NULL OR km_in>=0));
