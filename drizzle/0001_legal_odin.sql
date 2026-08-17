CREATE TABLE `ai_agents` (
	`id` varchar(32) NOT NULL,
	`ownerId` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`description` text NOT NULL,
	`status` enum('active','paused') NOT NULL DEFAULT 'active',
	`configuration` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_agents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `execution_runs` (
	`id` varchar(32) NOT NULL,
	`ownerId` int NOT NULL,
	`sourceType` enum('agent','workflow','scheduled_job') NOT NULL,
	`sourceId` varchar(32),
	`label` varchar(160) NOT NULL,
	`status` enum('success','error','running') NOT NULL,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	`durationMs` int,
	`logOutput` text,
	CONSTRAINT `execution_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `integrations` (
	`id` varchar(56) NOT NULL,
	`ownerId` int NOT NULL,
	`name` enum('GitHub','Google','Gemini','Hugging Face') NOT NULL,
	`authState` enum('connected','not_configured','unavailable') NOT NULL DEFAULT 'not_configured',
	`permissionState` enum('granted','limited','not_granted') NOT NULL DEFAULT 'not_granted',
	`apiKeyConfigured` boolean NOT NULL DEFAULT false,
	`lastCheckedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `integrations_id` PRIMARY KEY(`id`),
	CONSTRAINT `integrations_owner_name_idx` UNIQUE(`ownerId`,`name`)
);
--> statement-breakpoint
CREATE TABLE `project_agent_links` (
	`projectId` varchar(32) NOT NULL,
	`agentId` varchar(32) NOT NULL,
	CONSTRAINT `project_agent_links_projectId_agentId_pk` PRIMARY KEY(`projectId`,`agentId`)
);
--> statement-breakpoint
CREATE TABLE `project_workflow_links` (
	`projectId` varchar(32) NOT NULL,
	`workflowId` varchar(32) NOT NULL,
	CONSTRAINT `project_workflow_links_projectId_workflowId_pk` PRIMARY KEY(`projectId`,`workflowId`)
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` varchar(32) NOT NULL,
	`ownerId` int NOT NULL,
	`title` varchar(160) NOT NULL,
	`description` text NOT NULL,
	`status` enum('planning','active','paused','complete') NOT NULL DEFAULT 'planning',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scheduled_jobs` (
	`id` varchar(32) NOT NULL,
	`ownerId` int NOT NULL,
	`workflowId` varchar(32),
	`name` varchar(120) NOT NULL,
	`cronExpression` varchar(100) NOT NULL,
	`enabled` boolean NOT NULL DEFAULT true,
	`lastRunAt` timestamp,
	`nextRunAt` timestamp,
	`scheduleCronTaskUid` varchar(65),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `scheduled_jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workflow_steps` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workflowId` varchar(32) NOT NULL,
	`position` int NOT NULL,
	`label` varchar(140) NOT NULL,
	`action` varchar(80) NOT NULL,
	`configuration` text NOT NULL,
	CONSTRAINT `workflow_steps_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workflows` (
	`id` varchar(32) NOT NULL,
	`ownerId` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`description` text NOT NULL,
	`triggerType` enum('scheduled','event') NOT NULL,
	`enabled` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `workflows_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `ai_agents_owner_idx` ON `ai_agents` (`ownerId`);--> statement-breakpoint
CREATE INDEX `execution_runs_owner_started_idx` ON `execution_runs` (`ownerId`,`startedAt`);--> statement-breakpoint
CREATE INDEX `projects_owner_idx` ON `projects` (`ownerId`);--> statement-breakpoint
CREATE INDEX `scheduled_jobs_owner_idx` ON `scheduled_jobs` (`ownerId`);--> statement-breakpoint
CREATE INDEX `scheduled_jobs_task_uid_idx` ON `scheduled_jobs` (`scheduleCronTaskUid`);--> statement-breakpoint
CREATE INDEX `workflow_steps_workflow_idx` ON `workflow_steps` (`workflowId`);--> statement-breakpoint
CREATE INDEX `workflows_owner_idx` ON `workflows` (`ownerId`);