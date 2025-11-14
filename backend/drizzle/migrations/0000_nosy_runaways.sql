CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS "use_cases" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "title" text NOT NULL,
        "problem" text NOT NULL,
        "embedding" vector(1536),
        "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
