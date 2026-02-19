import {
  pgTable,
  text,
  timestamp,
  integer,
  jsonb,
  primaryKey,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "@auth/core/adapters";
import type { TranscriptSegment } from "@/lib/types";

// Auth.js adapter tables

export const users = pgTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  ]
);

// Application tables

export const transcripts = pgTable(
  "transcripts",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    videoId: text("videoId").notNull(),
    videoUrl: text("videoUrl").notNull(),
    videoTitle: text("videoTitle").notNull(),
    thumbnailUrl: text("thumbnailUrl"),
    videoDuration: integer("videoDuration"),
    segments: jsonb("segments").$type<TranscriptSegment[]>().notNull(),
    savedAt: timestamp("savedAt", { mode: "date" }).defaultNow().notNull(),
  },
  (transcript) => [
    uniqueIndex("transcript_user_video_idx").on(
      transcript.userId,
      transcript.videoId
    ),
  ]
);

export const summaries = pgTable(
  "summaries",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    videoId: text("videoId").notNull(),
    bullets: text("bullets").notNull(),
    paragraph: text("paragraph").notNull(),
    createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  },
  (summary) => [
    uniqueIndex("summary_video_idx").on(summary.videoId),
  ]
);
