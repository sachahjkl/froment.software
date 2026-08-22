UPDATE `access_credentials`
SET `revoked_at` = COALESCE(`revoked_at`, (SELECT `disabled_at` FROM `users` WHERE `users`.`id` = `access_credentials`.`user_id`))
WHERE EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `access_credentials`.`user_id` AND `users`.`disabled_at` IS NOT NULL);--> statement-breakpoint
UPDATE `sessions`
SET `revoked_at` = COALESCE(`revoked_at`, (SELECT `disabled_at` FROM `users` WHERE `users`.`id` = `sessions`.`user_id`))
WHERE EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `sessions`.`user_id` AND `users`.`disabled_at` IS NOT NULL);
