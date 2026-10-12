CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`code` text NOT NULL,
	`data` text NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `account_code_unique` ON `accounts` (`company_id`,`code`);--> statement-breakpoint
CREATE TABLE `audit` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`data` text NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `companies` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`version` integer NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `journals` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`number` text NOT NULL,
	`data` text NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `journal_number_unique` ON `journals` (`company_id`,`number`);--> statement-breakpoint
CREATE TABLE `lines` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`journal_id` text NOT NULL,
	`data` text NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`journal_id`) REFERENCES `journals`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `periods` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`data` text NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `subaccounts` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`data` text NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `years` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`data` text NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
