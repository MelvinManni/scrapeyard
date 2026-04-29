-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "team" TEXT,
    "role" TEXT NOT NULL DEFAULT 'member',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" BIGINT NOT NULL,
    "last_active_at" BIGINT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_requests" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "team" TEXT,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" BIGINT NOT NULL,

    CONSTRAINT "access_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keywords_json" TEXT NOT NULL,
    "cron" TEXT NOT NULL,
    "filter_prompt" TEXT,
    "status" TEXT NOT NULL DEFAULT 'running',
    "last_run_at" BIGINT,
    "next_run_at" BIGINT,
    "last_error" TEXT,
    "created_at" BIGINT NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "runs" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "started_at" BIGINT NOT NULL,
    "finished_at" BIGINT,
    "status" TEXT NOT NULL,
    "results_count" INTEGER NOT NULL DEFAULT 0,
    "duration_ms" INTEGER,
    "error" TEXT,

    CONSTRAINT "runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "results" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "run_id" TEXT,
    "source" TEXT,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "snippet" TEXT,
    "image_url" TEXT,
    "tag" TEXT,
    "published_at" BIGINT,
    "fetched_at" BIGINT NOT NULL,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "url_hash" TEXT NOT NULL,

    CONSTRAINT "results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "jobs_owner_id_idx" ON "jobs"("owner_id");

-- CreateIndex
CREATE INDEX "runs_job_id_started_at_idx" ON "runs"("job_id", "started_at" DESC);

-- CreateIndex
CREATE INDEX "results_job_id_fetched_at_idx" ON "results"("job_id", "fetched_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "results_job_id_url_hash_key" ON "results"("job_id", "url_hash");

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "runs" ADD CONSTRAINT "runs_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "results" ADD CONSTRAINT "results_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "results" ADD CONSTRAINT "results_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
