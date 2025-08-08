DO $$ BEGIN
 CREATE TYPE "project_status" AS ENUM('planning', 'active', 'on_hold', 'completed', 'cancelled');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" varchar(50) NOT NULL,
	"user_id" uuid NOT NULL,
	"task_id" uuid,
	"project_id" uuid,
	"workspace_id" uuid,
	"team_id" uuid,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" uuid NOT NULL,
	"action" varchar(30) NOT NULL,
	"user_id" uuid,
	"user_email" varchar(255),
	"ip_address" varchar(45),
	"user_agent" text,
	"old_values" jsonb,
	"new_values" jsonb,
	"changes" jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "calendar_event_attendees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"response_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "calendar_event_reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"minutes_before" integer NOT NULL,
	"method" varchar(20) DEFAULT 'notification' NOT NULL,
	"sent" boolean DEFAULT false NOT NULL,
	"sent_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "calendar_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text,
	"type" varchar(20) DEFAULT 'other' NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp,
	"all_day" boolean DEFAULT false NOT NULL,
	"location" varchar(500),
	"url" text,
	"color" varchar(7) DEFAULT '#4f46e5' NOT NULL,
	"user_id" uuid NOT NULL,
	"task_id" uuid,
	"project_id" uuid,
	"workspace_id" uuid,
	"team_id" uuid,
	"is_recurring" boolean DEFAULT false NOT NULL,
	"recurrence_rule" text,
	"external_calendar_id" varchar(255),
	"external_event_id" varchar(255),
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "calendar_integrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" varchar(20) NOT NULL,
	"provider_account_id" varchar(255) NOT NULL,
	"calendar_id" varchar(255) NOT NULL,
	"calendar_name" varchar(255) NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text,
	"token_expiry" timestamp,
	"sync_enabled" boolean DEFAULT true NOT NULL,
	"last_synced_at" timestamp,
	"sync_errors" jsonb DEFAULT '[]'::jsonb,
	"settings" jsonb DEFAULT '{"syncDirection":"both","syncTasks":true,"syncMeetings":true,"syncDeadlines":true,"defaultReminders":[30]}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content" text NOT NULL,
	"task_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"parent_id" uuid,
	"attachments" jsonb DEFAULT '[]'::jsonb,
	"mentions" jsonb DEFAULT '[]'::jsonb,
	"reactions" jsonb DEFAULT '{}'::jsonb,
	"is_edited" boolean DEFAULT false NOT NULL,
	"edited_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" varchar(20) NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"priority" varchar(20) DEFAULT 'medium' NOT NULL,
	"category" varchar(50) DEFAULT 'general' NOT NULL,
	"screenshots" jsonb DEFAULT '[]'::jsonb,
	"attachments" jsonb DEFAULT '[]'::jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"admin_response" text,
	"admin_user_id" uuid,
	"resolved_at" timestamp,
	"votes" jsonb DEFAULT '{"up":0,"down":0,"users":[]}'::jsonb,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "feedback_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"feedback_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"content" text NOT NULL,
	"is_internal" boolean DEFAULT false NOT NULL,
	"attachments" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"username" varchar(50) NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"avatar" text,
	"role" varchar(20) DEFAULT 'user' NOT NULL,
	"is_email_verified" boolean DEFAULT false NOT NULL,
	"email_verification_token" varchar(255),
	"password_reset_token" varchar(255),
	"password_reset_expires" timestamp,
	"preferences" jsonb DEFAULT '{"theme":"system","notifications":true,"language":"en"}'::jsonb,
	"last_login_at" timestamp,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "project_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" varchar(20) DEFAULT 'member' NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"color" varchar(7) DEFAULT '#3B82F6' NOT NULL,
	"owner_id" uuid NOT NULL,
	"status" "project_status" DEFAULT 'planning' NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "task_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(500) NOT NULL,
	"description" text,
	"status" varchar(20) DEFAULT 'todo' NOT NULL,
	"priority" varchar(20) DEFAULT 'medium' NOT NULL,
	"assignee_id" uuid,
	"creator_id" uuid NOT NULL,
	"project_id" uuid,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"due_date" timestamp,
	"estimated_hours" integer,
	"actual_hours" integer,
	"attachments" jsonb DEFAULT '[]'::jsonb,
	"started_at" timestamp,
	"completed_at" timestamp,
	"assigned_at" timestamp,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "team_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" varchar(20) DEFAULT 'member' NOT NULL,
	"permissions" jsonb DEFAULT '{}'::jsonb,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	"invited_by_id" uuid
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"avatar" text,
	"color" varchar(7) DEFAULT '#4f46e5' NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb,
	"created_by_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "workspace_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" varchar(20) DEFAULT 'member' NOT NULL,
	"permissions" jsonb DEFAULT '{}'::jsonb,
	"joined_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"icon" varchar(50) DEFAULT 'folder' NOT NULL,
	"color" varchar(7) DEFAULT '#4f46e5' NOT NULL,
	"is_personal" boolean DEFAULT false NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb,
	"owner_id" uuid NOT NULL,
	"team_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notification_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" varchar(50) NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"email_enabled" boolean DEFAULT true NOT NULL,
	"push_enabled" boolean DEFAULT true NOT NULL,
	"sms_enabled" boolean DEFAULT false NOT NULL,
	"frequency" varchar(20) DEFAULT 'immediate' NOT NULL,
	"quiet_hours_start" varchar(5),
	"quiet_hours_end" varchar(5),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" varchar(50) NOT NULL,
	"title" varchar(255) NOT NULL,
	"message" text NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp,
	"priority" varchar(20) DEFAULT 'normal' NOT NULL,
	"category" varchar(50) DEFAULT 'general' NOT NULL,
	"action_url" text,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"type" varchar(20) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"role" varchar(20) DEFAULT 'member' NOT NULL,
	"token" varchar(255) NOT NULL,
	"invited_by_id" uuid NOT NULL,
	"team_id" uuid,
	"workspace_id" uuid,
	"message" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"expires_at" timestamp NOT NULL,
	"accepted_at" timestamp,
	"declined_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invitations_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "recurring_task_instances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recurring_task_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"scheduled_date" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "recurring_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text,
	"user_id" uuid NOT NULL,
	"project_id" uuid,
	"frequency" varchar(20) NOT NULL,
	"interval" integer DEFAULT 1 NOT NULL,
	"days_of_week" jsonb DEFAULT '[]'::jsonb,
	"days_of_month" jsonb DEFAULT '[]'::jsonb,
	"months_of_year" jsonb DEFAULT '[]'::jsonb,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp,
	"active" boolean DEFAULT true NOT NULL,
	"next_run_date" timestamp,
	"last_task_created" timestamp,
	"created_tasks_count" integer DEFAULT 0 NOT NULL,
	"task_template" jsonb NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "task_template_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"task_id" uuid,
	"used_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "task_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"user_id" uuid NOT NULL,
	"project_id" uuid,
	"workspace_id" uuid,
	"team_id" uuid,
	"is_public" boolean DEFAULT false NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"category" varchar(50) DEFAULT 'general' NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"task_data" jsonb NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "activities_user_created_at_idx" ON "activities" ("user_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "activities_task_created_at_idx" ON "activities" ("task_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "activities_project_created_at_idx" ON "activities" ("project_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "activities_workspace_created_at_idx" ON "activities" ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "activities_team_created_at_idx" ON "activities" ("team_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "activities_type_created_at_idx" ON "activities" ("type","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "activities_created_at_idx" ON "activities" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_entity_type_idx" ON "audit_logs" ("entity_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_entity_id_idx" ON "audit_logs" ("entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_user_id_idx" ON "audit_logs" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_action_idx" ON "audit_logs" ("action");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_created_at_idx" ON "audit_logs" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_entity_type_id_idx" ON "audit_logs" ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_user_action_idx" ON "audit_logs" ("user_id","action");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "calendar_event_attendees_event_user_idx" ON "calendar_event_attendees" ("event_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "calendar_event_attendees_user_idx" ON "calendar_event_attendees" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "calendar_event_attendees_status_idx" ON "calendar_event_attendees" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "calendar_event_reminders_event_user_idx" ON "calendar_event_reminders" ("event_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "calendar_event_reminders_sent_idx" ON "calendar_event_reminders" ("sent");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "calendar_event_reminders_method_idx" ON "calendar_event_reminders" ("method");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "calendar_events_user_start_date_idx" ON "calendar_events" ("user_id","start_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "calendar_events_start_end_date_idx" ON "calendar_events" ("start_date","end_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "calendar_events_type_idx" ON "calendar_events" ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "calendar_events_task_idx" ON "calendar_events" ("task_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "calendar_events_project_idx" ON "calendar_events" ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "calendar_events_workspace_idx" ON "calendar_events" ("workspace_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "calendar_events_team_idx" ON "calendar_events" ("team_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "calendar_events_external_idx" ON "calendar_events" ("external_calendar_id","external_event_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "calendar_events_title_search_idx" ON "calendar_events" ("title");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "calendar_integrations_user_provider_idx" ON "calendar_integrations" ("user_id","provider","calendar_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "calendar_integrations_provider_account_idx" ON "calendar_integrations" ("provider","provider_account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "calendar_integrations_sync_enabled_idx" ON "calendar_integrations" ("sync_enabled");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "calendar_integrations_last_synced_idx" ON "calendar_integrations" ("last_synced_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "comments_task_created_at_idx" ON "comments" ("task_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "comments_author_idx" ON "comments" ("author_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "comments_parent_idx" ON "comments" ("parent_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "comments_mentions_idx" ON "comments" ("mentions");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feedback_user_created_at_idx" ON "feedback" ("user_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feedback_status_idx" ON "feedback" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feedback_type_idx" ON "feedback" ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feedback_priority_idx" ON "feedback" ("priority");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feedback_category_idx" ON "feedback" ("category");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feedback_admin_user_idx" ON "feedback" ("admin_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feedback_resolved_at_idx" ON "feedback" ("resolved_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feedback_title_search_idx" ON "feedback" ("title");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feedback_comments_feedback_created_at_idx" ON "feedback_comments" ("feedback_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feedback_comments_user_idx" ON "feedback_comments" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feedback_comments_internal_idx" ON "feedback_comments" ("is_internal");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_email_idx" ON "users" ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_username_idx" ON "users" ("username");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_role_idx" ON "users" ("role");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_email_verified_idx" ON "users" ("is_email_verified");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_last_login_idx" ON "users" ("last_login_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_deleted_at_idx" ON "users" ("deleted_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_full_name_idx" ON "users" ("first_name","last_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_created_at_idx" ON "users" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "projects_name_idx" ON "projects" ("name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "projects_owner_idx" ON "projects" ("owner_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "projects_status_idx" ON "projects" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "projects_archived_idx" ON "projects" ("is_archived");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "projects_owner_archived_idx" ON "projects" ("owner_id","is_archived");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "projects_owner_status_idx" ON "projects" ("owner_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "projects_deleted_at_idx" ON "projects" ("deleted_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "projects_created_at_idx" ON "projects" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_title_idx" ON "tasks" ("title");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_status_idx" ON "tasks" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_priority_idx" ON "tasks" ("priority");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_assignee_idx" ON "tasks" ("assignee_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_creator_idx" ON "tasks" ("creator_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_project_idx" ON "tasks" ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_due_date_idx" ON "tasks" ("due_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_status_project_idx" ON "tasks" ("status","project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_assignee_status_idx" ON "tasks" ("assignee_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_priority_status_idx" ON "tasks" ("priority","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_deleted_at_idx" ON "tasks" ("deleted_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_created_at_idx" ON "tasks" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_completed_at_idx" ON "tasks" ("completed_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "team_members_team_user_idx" ON "team_members" ("team_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "team_members_user_idx" ON "team_members" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "team_members_role_idx" ON "team_members" ("role");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "teams_name_idx" ON "teams" ("name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "teams_created_by_idx" ON "teams" ("created_by_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workspace_members_workspace_user_idx" ON "workspace_members" ("workspace_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workspace_members_user_idx" ON "workspace_members" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workspaces_owner_idx" ON "workspaces" ("owner_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workspaces_team_idx" ON "workspaces" ("team_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workspaces_personal_owner_idx" ON "workspaces" ("is_personal","owner_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workspaces_name_idx" ON "workspaces" ("name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notification_settings_user_type_idx" ON "notification_settings" ("user_id","type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notification_settings_enabled_idx" ON "notification_settings" ("enabled");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_user_is_read_idx" ON "notifications" ("user_id","is_read");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_user_created_at_idx" ON "notifications" ("user_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_type_idx" ON "notifications" ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_priority_idx" ON "notifications" ("priority");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_category_idx" ON "notifications" ("category");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_expires_at_idx" ON "notifications" ("expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invitations_email_team_idx" ON "invitations" ("email","team_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invitations_email_workspace_idx" ON "invitations" ("email","workspace_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invitations_token_idx" ON "invitations" ("token");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invitations_status_idx" ON "invitations" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invitations_expires_at_idx" ON "invitations" ("expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invitations_invited_by_idx" ON "invitations" ("invited_by_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invitations_type_idx" ON "invitations" ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "recurring_task_instances_recurring_task_idx" ON "recurring_task_instances" ("recurring_task_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "recurring_task_instances_task_idx" ON "recurring_task_instances" ("task_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "recurring_task_instances_scheduled_date_idx" ON "recurring_task_instances" ("scheduled_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "recurring_tasks_user_idx" ON "recurring_tasks" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "recurring_tasks_project_idx" ON "recurring_tasks" ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "recurring_tasks_active_next_run_idx" ON "recurring_tasks" ("active","next_run_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "recurring_tasks_frequency_idx" ON "recurring_tasks" ("frequency");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "recurring_tasks_start_date_idx" ON "recurring_tasks" ("start_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "recurring_tasks_end_date_idx" ON "recurring_tasks" ("end_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_template_usage_template_user_idx" ON "task_template_usage" ("template_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_template_usage_user_idx" ON "task_template_usage" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_template_usage_used_at_idx" ON "task_template_usage" ("used_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_templates_user_idx" ON "task_templates" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_templates_project_idx" ON "task_templates" ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_templates_workspace_idx" ON "task_templates" ("workspace_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_templates_team_idx" ON "task_templates" ("team_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_templates_public_idx" ON "task_templates" ("is_public");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_templates_category_idx" ON "task_templates" ("category");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_templates_usage_count_idx" ON "task_templates" ("usage_count");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_templates_name_search_idx" ON "task_templates" ("name");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "activities" ADD CONSTRAINT "activities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "activities" ADD CONSTRAINT "activities_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "activities" ADD CONSTRAINT "activities_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "activities" ADD CONSTRAINT "activities_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "activities" ADD CONSTRAINT "activities_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "calendar_event_attendees" ADD CONSTRAINT "calendar_event_attendees_event_id_calendar_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "calendar_events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "calendar_event_attendees" ADD CONSTRAINT "calendar_event_attendees_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "calendar_event_reminders" ADD CONSTRAINT "calendar_event_reminders_event_id_calendar_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "calendar_events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "calendar_event_reminders" ADD CONSTRAINT "calendar_event_reminders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "calendar_integrations" ADD CONSTRAINT "calendar_integrations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "comments" ADD CONSTRAINT "comments_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "feedback" ADD CONSTRAINT "feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "feedback" ADD CONSTRAINT "feedback_admin_user_id_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "feedback_comments" ADD CONSTRAINT "feedback_comments_feedback_id_feedback_id_fk" FOREIGN KEY ("feedback_id") REFERENCES "feedback"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "feedback_comments" ADD CONSTRAINT "feedback_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "project_members" ADD CONSTRAINT "project_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tasks" ADD CONSTRAINT "tasks_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "team_members" ADD CONSTRAINT "team_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "team_members" ADD CONSTRAINT "team_members_invited_by_id_users_id_fk" FOREIGN KEY ("invited_by_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "teams" ADD CONSTRAINT "teams_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notification_settings" ADD CONSTRAINT "notification_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_id_users_id_fk" FOREIGN KEY ("invited_by_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "invitations" ADD CONSTRAINT "invitations_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "invitations" ADD CONSTRAINT "invitations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "recurring_task_instances" ADD CONSTRAINT "recurring_task_instances_recurring_task_id_recurring_tasks_id_fk" FOREIGN KEY ("recurring_task_id") REFERENCES "recurring_tasks"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "recurring_task_instances" ADD CONSTRAINT "recurring_task_instances_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "recurring_tasks" ADD CONSTRAINT "recurring_tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "recurring_tasks" ADD CONSTRAINT "recurring_tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "task_template_usage" ADD CONSTRAINT "task_template_usage_template_id_task_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "task_templates"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "task_template_usage" ADD CONSTRAINT "task_template_usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "task_template_usage" ADD CONSTRAINT "task_template_usage_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
