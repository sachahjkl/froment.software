ALTER TABLE `invoice_revisions` ADD `payment_terms_presentation` text
  CONSTRAINT `invoice_revisions_payment_terms_presentation_check`
  CHECK (`payment_terms_presentation` IS NULL OR json_valid(`payment_terms_presentation`));
--> statement-breakpoint
ALTER TABLE `quote_condition_presets` ADD `conditions_presentation` text
  CONSTRAINT `quote_condition_presets_presentation_check`
  CHECK (`conditions_presentation` IS NULL OR json_valid(`conditions_presentation`));
--> statement-breakpoint
ALTER TABLE `quote_revisions` ADD `conditions_presentation` text
  CONSTRAINT `quote_revisions_conditions_presentation_check`
  CHECK (`conditions_presentation` IS NULL OR json_valid(`conditions_presentation`));
