CREATE TABLE `visit_counter` (
 `counter_key` text PRIMARY KEY NOT NULL,
 `total` integer DEFAULT 0 NOT NULL,
 `started_at` text NOT NULL
);
