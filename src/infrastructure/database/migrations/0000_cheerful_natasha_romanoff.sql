DO $$ BEGIN
 CREATE TYPE "audit_action" AS ENUM('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'PASSWORD_CHANGE', 'EMAIL_VERIFICATION', 'PERMISSION_CHANGE', 'EXPORT', 'IMPORT', 'SHARE', 'ARCHIVE', 'RESTORE');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "attendee_status" AS ENUM('pending', 'accepted', 'declined', 'tentative');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "event_type" AS ENUM('task', 'meeting', 'deadline', 'other');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "file_status" AS ENUM('uploading', 'processing', 'ready', 'error', 'deleted');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "file_type" AS ENUM('image', 'document', 'spreadsheet', 'presentation', 'video', 'audio', 'archive', 'other');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "notification_channel" AS ENUM('email', 'push', 'in_app', 'sms', 'webhook');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "notification_status" AS ENUM('pending', 'sent', 'delivered', 'read', 'failed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "notification_type" AS ENUM('task_assigned', 'task_completed', 'task_due_soon', 'task_overdue', 'project_created', 'project_updated', 'comment_added', 'mention', 'workspace_invitation', 'system_alert');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "priority" AS ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "project_role" AS ENUM('OWNER', 'ADMIN', 'MEMBER', 'VIEWER');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "project_status" AS ENUM('ACTIVE', 'COMPLETED', 'ARCHIVED', 'ON_HOLD');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "task_status" AS ENUM('TODO', 'IN_PROGRESS', 'IN_REVIEW', 'COMPLETED', 'CANCELLED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "webhook_delivery_status" AS ENUM('pending', 'success', 'failed', 'retrying');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "webhook_event" AS ENUM('task.created', 'task.updated', 'task.completed', 'task.deleted', 'project.created', 'project.updated', 'project.deleted', 'user.joined', 'user.left', 'comment.added', 'file.uploaded');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "webhook_status" AS ENUM('active', 'inactive', 'failed', 'suspended');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_logs" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" varchar(36) NOT NULL,
	"action" "audit_action" NOT NULL,
	"user_id" varchar(36),
	"user_email" varchar(255),
	"ip_address" varchar(45),
	"user_agent" text,
	"old_values" json,
	"new_values" json,
	"changes" json,
	"metadata" json DEFAULT '{}'::json NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "calendar_events" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"type" "event_type" NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp,
	"all_day" boolean DEFAULT false NOT NULL,
	"location" varchar(255),
	"url" text,
	"color" varchar(7) DEFAULT '#4f46e5' NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"workspace_id" varchar(36),
	"team_id" varchar(36),
	"project_id" varchar(36),
	"task_id" varchar(36),
	"is_recurring" boolean DEFAULT false NOT NULL,
	"recurrence_rule" text,
	"attendees" json DEFAULT '[]'::json NOT NULL,
	"reminders" json DEFAULT '[]'::json NOT NULL,
	"external_calendar_id" varchar(255),
	"external_event_id" varchar(255),
	"metadata" json DEFAULT '{}'::json NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "file_attachments" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"filename" varchar(255) NOT NULL,
	"original_name" varchar(255) NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"size" integer NOT NULL,
	"type" "file_type" NOT NULL,
	"status" "file_status" DEFAULT 'uploading' NOT NULL,
	"url" text,
	"thumbnail_url" text,
	"checksum" varchar(64) NOT NULL,
	"uploaded_by" varchar(36) NOT NULL,
	"workspace_id" varchar(36),
	"project_id" varchar(36),
	"task_id" varchar(36),
	"comment_id" varchar(36),
	"metadata" json DEFAULT '{}'::json NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"hashed_password" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "workspaces" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"owner_id" varchar(36) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "projects" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"workspace_id" varchar(36) NOT NULL,
	"manager_id" varchar(36) NOT NULL,
	"status" "project_status" DEFAULT 'ACTIVE' NOT NULL,
	"start_date" timestamp,
	"end_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tasks" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"status" "task_status" DEFAULT 'TODO' NOT NULL,
	"priority" "priority" DEFAULT 'MEDIUM' NOT NULL,
	"assignee_id" varchar(36),
	"project_id" varchar(36) NOT NULL,
	"created_by_id" varchar(36) NOT NULL,
	"due_date" timestamp,
	"estimated_hours" integer,
	"actual_hours" integer,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "project_members" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"project_id" varchar(36) NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"role" "project_role" DEFAULT 'MEMBER' NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "project_members_project_id_user_id_unique" UNIQUE("project_id","user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "task_dependencies" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"task_id" varchar(36) NOT NULL,
	"depends_on_id" varchar(36) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "task_dependencies_task_id_depends_on_id_unique" UNIQUE("task_id","depends_on_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notification_preferences" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"workspace_id" varchar(36),
	"email_enabled" boolean DEFAULT true NOT NULL,
	"push_enabled" boolean DEFAULT true NOT NULL,
	"in_app_enabled" boolean DEFAULT true NOT NULL,
	"sms_enabled" boolean DEFAULT false NOT NULL,
	"webhook_enabled" boolean DEFAULT false NOT NULL,
	"quiet_hours" json DEFAULT '{"enabled":false,"startTime":"22:00","endTime":"08:00","timezone":"UTC"}'::json NOT NULL,
	"type_preferences" json DEFAULT '{}'::json NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notifications" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"workspace_id" varchar(36),
	"project_id" varchar(36),
	"task_id" varchar(36),
	"type" "notification_type" NOT NULL,
	"title" varchar(255) NOT NULL,
	"message" text NOT NULL,
	"data" json,
	"channels" json NOT NULL,
	"status" "notification_status" DEFAULT 'pending' NOT NULL,
	"read_at" timestamp,
	"sent_at" timestamp,
	"delivered_at" timestamp,
	"failure_reason" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"max_retries" integer DEFAULT 3 NOT NULL,
	"scheduled_for" timestamp,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "webhook_deliveries" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"webhook_id" varchar(36) NOT NULL,
	"event" "webhook_event" NOT NULL,
	"payload" json NOT NULL,
	"status" "webhook_delivery_status" DEFAULT 'pending' NOT NULL,
	"http_status" integer,
	"response_body" text,
	"error_message" text,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"next_retry_at" timestamp,
	"delivered_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "webhooks" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"url" text NOT NULL,
	"secret" varchar(255) NOT NULL,
	"events" json NOT NULL,
	"status" "webhook_status" DEFAULT 'active' NOT NULL,
	"workspace_id" varchar(36) NOT NULL,
	"created_by" varchar(36) NOT NULL,
	"last_triggered_at" timestamp,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"max_failures" integer DEFAULT 5 NOT NULL,
	"timeout" integer DEFAULT 30000 NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"max_retries" integer DEFAULT 3 NOT NULL,
	"headers" json DEFAULT '{}'::json NOT NULL,
	"metadata" json DEFAULT '{}'::json NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_logs_entity" ON "audit_logs" ("entity_type","entity_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_logs_user" ON "audit_logs" ("user_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_logs_action" ON "audit_logs" ("action","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_logs_time" ON "audit_logs" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_logs_security" ON "audit_logs" ("action","user_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_logs_entity_type" ON "audit_logs" ("entity_type","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_logs_ip" ON "audit_logs" ("ip_address","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_logs_entity_action" ON "audit_logs" ("entity_type","entity_id","action");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_logs_user_action" ON "audit_logs" ("user_id","action","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_calendar_events_user_time" ON "calendar_events" ("user_id","start_date","end_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_calendar_events_workspace_time" ON "calendar_events" ("workspace_id","start_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_calendar_events_project" ON "calendar_events" ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_calendar_events_task" ON "calendar_events" ("task_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_calendar_events_type" ON "calendar_events" ("type","start_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_calendar_events_recurring" ON "calendar_events" ("is_recurring","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_calendar_events_start_date" ON "calendar_events" ("start_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_calendar_events_end_date" ON "calendar_events" ("end_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_calendar_events_external_calendar" ON "calendar_events" ("external_calendar_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_calendar_events_external_event" ON "calendar_events" ("external_event_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_calendar_events_upcoming" ON "calendar_events" ("start_date","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_calendar_events_team_time" ON "calendar_events" ("team_id","start_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_calendar_events_conflict" ON "calendar_events" ("user_id","start_date","end_date","all_day");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_file_attachments_filename" ON "file_attachments" ("filename");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_file_attachments_checksum" ON "file_attachments" ("checksum");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_file_attachments_uploaded_by" ON "file_attachments" ("uploaded_by","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_file_attachments_workspace" ON "file_attachments" ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_file_attachments_project" ON "file_attachments" ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_file_attachments_task" ON "file_attachments" ("task_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_file_attachments_comment" ON "file_attachments" ("comment_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_file_attachments_type" ON "file_attachments" ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_file_attachments_status" ON "file_attachments" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_file_attachments_type_status" ON "file_attachments" ("type","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_file_attachments_mime_type" ON "file_attachments" ("mime_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_file_attachments_size" ON "file_attachments" ("size");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_file_attachments_deleted" ON "file_attachments" ("deleted_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_file_attachments_active" ON "file_attachments" ("status","deleted_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_file_attachments_orphaned" ON "file_attachments" ("workspace_id","project_id","task_id","comment_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_file_attachments_created_at" ON "file_attachments" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_file_attachments_workspace_storage" ON "file_attachments" ("workspace_id","size","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_file_attachments_user_storage" ON "file_attachments" ("uploaded_by","size","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_file_attachments_ready" ON "file_attachments" ("status","url");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_notification_preferences_user" ON "notification_preferences" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_notification_preferences_user_workspace" ON "notification_preferences" ("user_id","workspace_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_notifications_user_unread" ON "notifications" ("user_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_notifications_user_status" ON "notifications" ("user_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_notifications_workspace" ON "notifications" ("workspace_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_notifications_project" ON "notifications" ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_notifications_task" ON "notifications" ("task_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_notifications_type" ON "notifications" ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_notifications_status" ON "notifications" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_notifications_scheduled" ON "notifications" ("scheduled_for");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_notifications_expires" ON "notifications" ("expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_notifications_pending_delivery" ON "notifications" ("status","scheduled_for");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_notifications_failed_retryable" ON "notifications" ("status","retry_count","max_retries");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_webhook_deliveries_webhook" ON "webhook_deliveries" ("webhook_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_webhook_deliveries_status" ON "webhook_deliveries" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_webhook_deliveries_webhook_status" ON "webhook_deliveries" ("webhook_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_webhook_deliveries_event" ON "webhook_deliveries" ("event","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_webhook_deliveries_retry" ON "webhook_deliveries" ("status","next_retry_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_webhook_deliveries_pending" ON "webhook_deliveries" ("status","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_webhook_deliveries_time" ON "webhook_deliveries" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_webhook_deliveries_delivered" ON "webhook_deliveries" ("delivered_at","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_webhooks_workspace" ON "webhooks" ("workspace_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_webhooks_status" ON "webhooks" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_webhooks_workspace_status" ON "webhooks" ("workspace_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_webhooks_url" ON "webhooks" ("url");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_webhooks_created_by" ON "webhooks" ("created_by");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_webhooks_active" ON "webhooks" ("status","workspace_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_webhooks_failed" ON "webhooks" ("status","failure_count");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "projects" ADD CONSTRAINT "projects_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "projects" ADD CONSTRAINT "projects_manager_id_users_id_fk" FOREIGN KEY ("manager_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "project_members" ADD CONSTRAINT "project_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_depends_on_id_tasks_id_fk" FOREIGN KEY ("depends_on_id") REFERENCES "tasks"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
