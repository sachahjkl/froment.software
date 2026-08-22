CREATE INDEX `integration_tokens_unrevoked_name_expiry_index` ON `integration_tokens` (`name`,`expires_at`) WHERE "integration_tokens"."revoked_at" is null;
--> statement-breakpoint
CREATE TRIGGER `integration_tokens_name_insert_guard`
BEFORE INSERT ON `integration_tokens`
WHEN NEW.`name` <> trim(NEW.`name`)
BEGIN
  SELECT RAISE(ABORT, 'integration token name must be trimmed');
END;
--> statement-breakpoint
CREATE TRIGGER `integration_tokens_active_name_insert_guard`
BEFORE INSERT ON `integration_tokens`
WHEN EXISTS (
  SELECT 1
  FROM `integration_tokens`
  WHERE `name` = NEW.`name`
    AND `revoked_at` IS NULL
    AND `expires_at` > NEW.`created_at`
)
BEGIN
  SELECT RAISE(ABORT, 'integration token active name conflict');
END;
