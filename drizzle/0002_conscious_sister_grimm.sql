CREATE TABLE "summaries" (
	"id" text PRIMARY KEY NOT NULL,
	"videoId" text NOT NULL,
	"bullets" text NOT NULL,
	"paragraph" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "summary_video_idx" ON "summaries" USING btree ("videoId");