CREATE TABLE "lesson_observations" (
    "id" UUID NOT NULL,
    "teacher_id" UUID NOT NULL,
    "teacher_name" VARCHAR(100) NOT NULL,
    "observer_id" UUID NOT NULL,
    "observer_name" VARCHAR(100) NOT NULL,
    "group_id" UUID,
    "group_name" VARCHAR(100) NOT NULL,
    "topic" VARCHAR(200) NOT NULL,
    "students_enrolled" INTEGER NOT NULL,
    "students_present" INTEGER NOT NULL,
    "scores" JSONB NOT NULL,
    "total_score" INTEGER NOT NULL,
    "criteria_version" INTEGER NOT NULL DEFAULT 1,
    "children_answer" TEXT,
    "strengths" TEXT NOT NULL,
    "improvements" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lesson_observations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "lesson_observations_teacher_id_created_at_idx" ON "lesson_observations"("teacher_id", "created_at");
CREATE INDEX "lesson_observations_created_at_idx" ON "lesson_observations"("created_at");
