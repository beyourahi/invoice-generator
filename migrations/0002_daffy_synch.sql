CREATE TABLE `client_payment_methods` (
	`client_id` text NOT NULL,
	`payment_method_id` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`client_id`, `payment_method_id`),
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`payment_method_id`) REFERENCES `payment_methods`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_client_payment_methods_client` ON `client_payment_methods` (`client_id`);--> statement-breakpoint
CREATE INDEX `idx_client_payment_methods_method` ON `client_payment_methods` (`payment_method_id`);--> statement-breakpoint
CREATE TABLE `clients` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`invoice_prefix` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`address` text DEFAULT '[""]' NOT NULL,
	`service_description` text DEFAULT '' NOT NULL,
	`service_amount` integer DEFAULT 0 NOT NULL,
	`service_currency` text DEFAULT 'BDT' NOT NULL,
	`year` integer NOT NULL,
	`expanded` integer DEFAULT true NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_clients_user_id` ON `clients` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_clients_user_position` ON `clients` (`user_id`,`position`);--> statement-breakpoint
CREATE TABLE `fixed_settings` (
	`user_id` text PRIMARY KEY NOT NULL,
	`from_name` text DEFAULT '' NOT NULL,
	`from_phone` text DEFAULT '' NOT NULL,
	`from_email` text DEFAULT '' NOT NULL,
	`from_address` text DEFAULT '' NOT NULL,
	`selected_client_id` text,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `invoice_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`month` text NOT NULL,
	`issue_day` text DEFAULT '01' NOT NULL,
	`due_day` text DEFAULT '07' NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_invoice_entries_client_id` ON `invoice_entries` (`client_id`);--> statement-breakpoint
CREATE INDEX `idx_invoice_entries_client_position` ON `invoice_entries` (`client_id`,`position`);--> statement-breakpoint
CREATE TABLE `payment_methods` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`label` text DEFAULT '' NOT NULL,
	`values` text DEFAULT '{}' NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_payment_methods_user_id` ON `payment_methods` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_payment_methods_user_position` ON `payment_methods` (`user_id`,`position`);