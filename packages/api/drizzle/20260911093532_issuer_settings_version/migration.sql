ALTER TABLE `issuer_settings` ADD `version` integer DEFAULT 1 NOT NULL
  CONSTRAINT `issuer_settings_version_check` CHECK (`version` between 1 and 9007199254740991);
