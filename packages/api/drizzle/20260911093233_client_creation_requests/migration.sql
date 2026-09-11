CREATE TABLE `client_creation_requests` (
	`request_id` text PRIMARY KEY NOT NULL,
	`created_by_user_id` text NOT NULL,
	`client_id` text NOT NULL UNIQUE,
	`request` text NOT NULL,
	`result` text NOT NULL,
	CONSTRAINT `fk_client_creation_requests_created_by_user_id_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`),
	CONSTRAINT `fk_client_creation_requests_client_id_clients_id_fk` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`),
	CONSTRAINT "client_creation_request_json_check" CHECK(json_valid("request")),
	CONSTRAINT "client_creation_result_json_check" CHECK(json_valid("result"))
);
