CREATE TABLE `pipelineExecutions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`executionId` varchar(64) NOT NULL,
	`status` enum('running','suspended','completed','rejected','failed') NOT NULL DEFAULT 'running',
	`input` text NOT NULL,
	`context` text,
	`suspension` text,
	`metrics` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pipelineExecutions_id` PRIMARY KEY(`id`),
	CONSTRAINT `pipelineExecutions_executionId_unique` UNIQUE(`executionId`)
);
--> statement-breakpoint
CREATE INDEX `executionId_idx` ON `pipelineExecutions` (`executionId`);--> statement-breakpoint
CREATE INDEX `status_idx` ON `pipelineExecutions` (`status`);