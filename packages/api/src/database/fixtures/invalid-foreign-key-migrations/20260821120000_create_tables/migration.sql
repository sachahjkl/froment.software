CREATE TABLE parent (id integer PRIMARY KEY);
--> statement-breakpoint
CREATE TABLE child (parent_id integer REFERENCES parent(id));
