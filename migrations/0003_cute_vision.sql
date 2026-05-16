ALTER TABLE `clients` ADD `is_active` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `invoice_entries` ADD `is_active` integer DEFAULT true NOT NULL;