CREATE TABLE poster_uses (
 event_id text PRIMARY KEY NOT NULL,
 created_at text NOT NULL
);
--> statement-breakpoint
CREATE TRIGGER increment_poster_uses AFTER INSERT ON poster_uses
BEGIN
 INSERT INTO visit_counter (counter_key,total,started_at) VALUES ('poster_uses',1,NEW.created_at)
 ON CONFLICT(counter_key) DO UPDATE SET total=total+1;
END;
