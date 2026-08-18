ALTER TABLE `scheduled_jobs` ADD `callbackToken` varchar(64);--> statement-breakpoint
ALTER TABLE `scheduled_jobs` ADD `activeCallbackToken` varchar(64);--> statement-breakpoint
ALTER TABLE `scheduled_jobs` ADD `completedCallbackToken` varchar(64);