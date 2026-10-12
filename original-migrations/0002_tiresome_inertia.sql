CREATE TABLE `tax_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`code` text NOT NULL,
	`data` text NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tax_code_company_unique` ON `tax_codes` (`company_id`,`code`);