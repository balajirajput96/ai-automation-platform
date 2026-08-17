CREATE TABLE `workflow_step_runs` (
	`id` varchar(32) NOT NULL,
	`workflowRunId` varchar(32) NOT NULL,
	`workflowStepId` int NOT NULL,
	`status` enum('success','error','running') NOT NULL,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	`durationMs` int,
	`output` text,
	CONSTRAINT `workflow_step_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `workflow_step_runs_workflow_run_idx` ON `workflow_step_runs` (`workflowRunId`);