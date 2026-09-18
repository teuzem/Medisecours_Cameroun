CREATE TABLE `appointments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`careRequestId` int NOT NULL,
	`patientUserId` int NOT NULL,
	`facilityId` int,
	`scheduledAt` timestamp NOT NULL,
	`status` enum('requested','confirmed','completed','cancelled','no_show') NOT NULL DEFAULT 'requested',
	`mode` enum('onsite','remote') NOT NULL DEFAULT 'onsite',
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `appointments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actorUserId` int,
	`action` varchar(120) NOT NULL,
	`entityType` varchar(80) NOT NULL,
	`entityId` int,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `care_episodes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`patientUserId` int NOT NULL,
	`careRequestId` int,
	`facilityId` int,
	`status` enum('open','in_progress','closed') NOT NULL DEFAULT 'open',
	`label` varchar(160) NOT NULL,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`closedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `care_episodes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `care_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`episodeId` int NOT NULL,
	`actorUserId` int,
	`eventType` enum('created','status_changed','appointment','check_in','message','note','closed') NOT NULL,
	`title` varchar(180) NOT NULL,
	`description` text,
	`patientVisible` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `care_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `care_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`patientUserId` int NOT NULL,
	`facilityId` int,
	`googlePlaceId` varchar(255),
	`requestType` enum('orientation','appointment','admission') NOT NULL DEFAULT 'orientation',
	`urgency` enum('routine','soon','urgent','emergency') NOT NULL DEFAULT 'routine',
	`status` enum('submitted','accepted','scheduled','in_progress','completed','cancelled','rejected') NOT NULL DEFAULT 'submitted',
	`patientNote` text,
	`preferredAt` timestamp,
	`consentAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `care_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `facilities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`googlePlaceId` varchar(255),
	`slug` varchar(280) NOT NULL,
	`name` varchar(255) NOT NULL,
	`normalizedName` varchar(255) NOT NULL,
	`category` enum('hospital','clinic','health_center','pharmacy','laboratory','maternity','specialized_center','dental_center','medical_office','other') NOT NULL,
	`categoryLabel` varchar(120),
	`address` text NOT NULL,
	`city` varchar(120),
	`district` varchar(120),
	`region` varchar(120),
	`latitude` decimal(10,7) NOT NULL,
	`longitude` decimal(10,7) NOT NULL,
	`phones` json,
	`website` varchar(500),
	`openingHours` json,
	`photos` json,
	`about` text,
	`services` json,
	`infrastructure` json,
	`benefits` json,
	`updates` json,
	`officialVideoUrl` varchar(1000),
	`enrichmentSourceUrl` varchar(1000),
	`enrichmentUpdatedAt` timestamp,
	`aboutStatus` enum('draft','published') NOT NULL DEFAULT 'draft',
	`aboutApprovedAt` timestamp,
	`aboutApprovedByUserId` int,
	`googleRating` decimal(3,2),
	`googleRatingCount` int NOT NULL DEFAULT 0,
	`medisecoursRating` decimal(3,2),
	`medisecoursRatingCount` int NOT NULL DEFAULT 0,
	`isOpenNow` boolean,
	`verificationStatus` enum('unverified','verified','claimed') NOT NULL DEFAULT 'unverified',
	`source` enum('google_places','medisecours','mixed') NOT NULL DEFAULT 'google_places',
	`lastSyncedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `facilities_id` PRIMARY KEY(`id`),
	CONSTRAINT `facilities_slug_unique` UNIQUE(`slug`),
	CONSTRAINT `facilities_google_place_id_unique` UNIQUE(`googlePlaceId`)
);
--> statement-breakpoint
CREATE TABLE `facility_media` (
	`id` int AUTO_INCREMENT NOT NULL,
	`facilityId` int NOT NULL,
	`submittedByUserId` int,
	`reviewId` int,
	`mediaType` enum('image','video') NOT NULL,
	`storageKey` varchar(700) NOT NULL,
	`url` varchar(1000) NOT NULL,
	`caption` varchar(280),
	`status` enum('pending','published','rejected') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `facility_media_id` PRIMARY KEY(`id`),
	CONSTRAINT `facility_media_storageKey_unique` UNIQUE(`storageKey`)
);
--> statement-breakpoint
CREATE TABLE `facility_reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`facilityId` int NOT NULL,
	`userId` int NOT NULL,
	`rating` int NOT NULL,
	`title` varchar(120),
	`content` text NOT NULL,
	`status` enum('pending','published','hidden') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `facility_reviews_id` PRIMARY KEY(`id`),
	CONSTRAINT `facility_reviews_one_per_user` UNIQUE(`facilityId`,`userId`)
);
--> statement-breakpoint
CREATE TABLE `facility_suggestions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`facilityId` int NOT NULL,
	`userId` int NOT NULL,
	`fieldName` varchar(80) NOT NULL,
	`proposedValue` text NOT NULL,
	`message` text,
	`status` enum('pending','accepted','rejected') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `facility_suggestions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `patient_notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(180) NOT NULL,
	`body` text NOT NULL,
	`kind` enum('care','appointment','system') NOT NULL DEFAULT 'system',
	`readAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `patient_notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `place_contribution_media` (
	`id` int AUTO_INCREMENT NOT NULL,
	`contributionId` int NOT NULL,
	`submittedByUserId` int,
	`mediaType` enum('image','video') NOT NULL,
	`storageKey` varchar(700) NOT NULL,
	`url` varchar(1000) NOT NULL,
	`caption` varchar(280),
	`status` enum('published','hidden') NOT NULL DEFAULT 'published',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `place_contribution_media_id` PRIMARY KEY(`id`),
	CONSTRAINT `place_contribution_media_storageKey_unique` UNIQUE(`storageKey`)
);
--> statement-breakpoint
CREATE TABLE `place_contributions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`googlePlaceId` varchar(255) NOT NULL,
	`userId` int NOT NULL,
	`rating` int NOT NULL,
	`title` varchar(120),
	`content` text NOT NULL,
	`status` enum('published','hidden') NOT NULL DEFAULT 'published',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `place_contributions_id` PRIMARY KEY(`id`),
	CONSTRAINT `place_contributions_one_per_user` UNIQUE(`googlePlaceId`,`userId`)
);
--> statement-breakpoint
CREATE TABLE `place_index` (
	`id` int AUTO_INCREMENT NOT NULL,
	`googlePlaceId` varchar(255) NOT NULL,
	`firstSeenAt` timestamp NOT NULL DEFAULT (now()),
	`lastSeenAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSyncRunId` int,
	CONSTRAINT `place_index_id` PRIMARY KEY(`id`),
	CONSTRAINT `place_index_googlePlaceId_unique` UNIQUE(`googlePlaceId`)
);
--> statement-breakpoint
CREATE TABLE `sync_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`status` enum('running','success','partial','failed') NOT NULL DEFAULT 'running',
	`searchedAreas` int NOT NULL DEFAULT 0,
	`discoveredCount` int NOT NULL DEFAULT 0,
	`updatedCount` int NOT NULL DEFAULT 0,
	`skippedCount` int NOT NULL DEFAULT 0,
	`errorMessage` text,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `sync_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_place_collection_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`collectionId` int NOT NULL,
	`facilityId` int,
	`googlePlaceId` varchar(255),
	`targetKey` varchar(300) NOT NULL,
	`privateNote` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_place_collection_items_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_place_collection_items_unique_target` UNIQUE(`collectionId`,`targetKey`)
);
--> statement-breakpoint
CREATE TABLE `user_place_collections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(80) NOT NULL,
	`color` varchar(12) NOT NULL DEFAULT '#0B8A96',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_place_collections_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_place_collections_user_name_unique` UNIQUE(`userId`,`name`)
);
--> statement-breakpoint
CREATE TABLE `user_place_lists` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`facilityId` int,
	`googlePlaceId` varchar(255),
	`targetKey` varchar(300) NOT NULL,
	`listType` enum('saved','wishlist') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_place_lists_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_place_lists_unique_target` UNIQUE(`userId`,`listType`,`targetKey`)
);
--> statement-breakpoint
CREATE TABLE `user_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`phone` varchar(40),
	`city` varchar(120),
	`preferredCategories` json,
	`communicationConsent` boolean NOT NULL DEFAULT false,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_profiles_user_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `user_route_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`facilityId` int,
	`googlePlaceId` varchar(255),
	`targetKey` varchar(300) NOT NULL,
	`travelMode` enum('DRIVING','WALKING','BICYCLING') NOT NULL DEFAULT 'DRIVING',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_route_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_search_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`searchText` varchar(120) NOT NULL,
	`category` varchar(80),
	`source` enum('map','sidebar') NOT NULL DEFAULT 'map',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_search_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `appointments` ADD CONSTRAINT `appointments_careRequestId_care_requests_id_fk` FOREIGN KEY (`careRequestId`) REFERENCES `care_requests`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `appointments` ADD CONSTRAINT `appointments_patientUserId_users_id_fk` FOREIGN KEY (`patientUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `appointments` ADD CONSTRAINT `appointments_facilityId_facilities_id_fk` FOREIGN KEY (`facilityId`) REFERENCES `facilities`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_actorUserId_users_id_fk` FOREIGN KEY (`actorUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `care_episodes` ADD CONSTRAINT `care_episodes_patientUserId_users_id_fk` FOREIGN KEY (`patientUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `care_episodes` ADD CONSTRAINT `care_episodes_careRequestId_care_requests_id_fk` FOREIGN KEY (`careRequestId`) REFERENCES `care_requests`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `care_episodes` ADD CONSTRAINT `care_episodes_facilityId_facilities_id_fk` FOREIGN KEY (`facilityId`) REFERENCES `facilities`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `care_events` ADD CONSTRAINT `care_events_episodeId_care_episodes_id_fk` FOREIGN KEY (`episodeId`) REFERENCES `care_episodes`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `care_events` ADD CONSTRAINT `care_events_actorUserId_users_id_fk` FOREIGN KEY (`actorUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `care_requests` ADD CONSTRAINT `care_requests_patientUserId_users_id_fk` FOREIGN KEY (`patientUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `care_requests` ADD CONSTRAINT `care_requests_facilityId_facilities_id_fk` FOREIGN KEY (`facilityId`) REFERENCES `facilities`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `facilities` ADD CONSTRAINT `facilities_aboutApprovedByUserId_users_id_fk` FOREIGN KEY (`aboutApprovedByUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `facility_media` ADD CONSTRAINT `facility_media_facilityId_facilities_id_fk` FOREIGN KEY (`facilityId`) REFERENCES `facilities`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `facility_media` ADD CONSTRAINT `facility_media_submittedByUserId_users_id_fk` FOREIGN KEY (`submittedByUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `facility_media` ADD CONSTRAINT `facility_media_reviewId_facility_reviews_id_fk` FOREIGN KEY (`reviewId`) REFERENCES `facility_reviews`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `facility_reviews` ADD CONSTRAINT `facility_reviews_facilityId_facilities_id_fk` FOREIGN KEY (`facilityId`) REFERENCES `facilities`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `facility_reviews` ADD CONSTRAINT `facility_reviews_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `facility_suggestions` ADD CONSTRAINT `facility_suggestions_facilityId_facilities_id_fk` FOREIGN KEY (`facilityId`) REFERENCES `facilities`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `facility_suggestions` ADD CONSTRAINT `facility_suggestions_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `patient_notifications` ADD CONSTRAINT `patient_notifications_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `place_contribution_media` ADD CONSTRAINT `pcmedia_contribution_fk` FOREIGN KEY (`contributionId`) REFERENCES `place_contributions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `place_contribution_media` ADD CONSTRAINT `pcmedia_submitter_fk` FOREIGN KEY (`submittedByUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `place_contributions` ADD CONSTRAINT `place_contributions_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `place_index` ADD CONSTRAINT `place_index_lastSyncRunId_sync_runs_id_fk` FOREIGN KEY (`lastSyncRunId`) REFERENCES `sync_runs`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_place_collection_items` ADD CONSTRAINT `upci_collection_fk` FOREIGN KEY (`collectionId`) REFERENCES `user_place_collections`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_place_collection_items` ADD CONSTRAINT `upci_facility_fk` FOREIGN KEY (`facilityId`) REFERENCES `facilities`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_place_collections` ADD CONSTRAINT `upc_user_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_place_lists` ADD CONSTRAINT `user_place_lists_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_place_lists` ADD CONSTRAINT `user_place_lists_facilityId_facilities_id_fk` FOREIGN KEY (`facilityId`) REFERENCES `facilities`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_profiles` ADD CONSTRAINT `uprofile_user_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_route_history` ADD CONSTRAINT `urh_user_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_route_history` ADD CONSTRAINT `urh_facility_fk` FOREIGN KEY (`facilityId`) REFERENCES `facilities`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_search_history` ADD CONSTRAINT `user_search_history_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `appointments_patient_date_idx` ON `appointments` (`patientUserId`,`scheduledAt`);--> statement-breakpoint
CREATE INDEX `appointments_facility_date_idx` ON `appointments` (`facilityId`,`scheduledAt`);--> statement-breakpoint
CREATE INDEX `audit_logs_created_idx` ON `audit_logs` (`createdAt`);--> statement-breakpoint
CREATE INDEX `audit_logs_entity_idx` ON `audit_logs` (`entityType`,`entityId`);--> statement-breakpoint
CREATE INDEX `care_episodes_patient_status_idx` ON `care_episodes` (`patientUserId`,`status`,`updatedAt`);--> statement-breakpoint
CREATE INDEX `care_episodes_request_idx` ON `care_episodes` (`careRequestId`);--> statement-breakpoint
CREATE INDEX `care_events_episode_created_idx` ON `care_events` (`episodeId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `care_requests_patient_status_idx` ON `care_requests` (`patientUserId`,`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `care_requests_facility_status_idx` ON `care_requests` (`facilityId`,`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `facilities_category_idx` ON `facilities` (`category`);--> statement-breakpoint
CREATE INDEX `facilities_city_idx` ON `facilities` (`city`);--> statement-breakpoint
CREATE INDEX `facilities_coordinates_idx` ON `facilities` (`latitude`,`longitude`);--> statement-breakpoint
CREATE INDEX `facilities_name_idx` ON `facilities` (`normalizedName`);--> statement-breakpoint
CREATE INDEX `facility_media_facility_status_idx` ON `facility_media` (`facilityId`,`status`);--> statement-breakpoint
CREATE INDEX `facility_media_review_idx` ON `facility_media` (`reviewId`);--> statement-breakpoint
CREATE INDEX `facility_reviews_facility_status_idx` ON `facility_reviews` (`facilityId`,`status`);--> statement-breakpoint
CREATE INDEX `facility_suggestions_facility_status_idx` ON `facility_suggestions` (`facilityId`,`status`);--> statement-breakpoint
CREATE INDEX `patient_notifications_user_read_idx` ON `patient_notifications` (`userId`,`readAt`,`createdAt`);--> statement-breakpoint
CREATE INDEX `place_contribution_media_contribution_status_idx` ON `place_contribution_media` (`contributionId`,`status`);--> statement-breakpoint
CREATE INDEX `place_contributions_place_status_idx` ON `place_contributions` (`googlePlaceId`,`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `place_index_last_seen_idx` ON `place_index` (`lastSeenAt`);--> statement-breakpoint
CREATE INDEX `sync_runs_status_started_idx` ON `sync_runs` (`status`,`startedAt`);--> statement-breakpoint
CREATE INDEX `user_place_collection_items_collection_created_idx` ON `user_place_collection_items` (`collectionId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `user_place_collections_user_created_idx` ON `user_place_collections` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `user_place_lists_user_type_created_idx` ON `user_place_lists` (`userId`,`listType`,`createdAt`);--> statement-breakpoint
CREATE INDEX `user_route_history_user_created_idx` ON `user_route_history` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `user_search_history_user_created_idx` ON `user_search_history` (`userId`,`createdAt`);