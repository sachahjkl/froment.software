UPDATE `company_settings`
SET `enabled_modules` = json_insert(`enabled_modules`, '$[#]', 'ai')
WHERE NOT EXISTS (
	SELECT 1 FROM json_each(`company_settings`.`enabled_modules`) WHERE value = 'ai'
);
