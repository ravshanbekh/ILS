-- CreateEnum
CREATE TYPE "FreezeReason" AS ENUM ('moliyaviy', 'kochib_ketish', 'vaqtincha_toxtatgan', 'kasallik', 'kanikul', 'boshqa_fan', 'kurs_tugadi', 'motivatsiya', 'ish_tadbir', 'universitet', 'shaxsiy', 'oqituvchidan_norozi', 'boshqa', 'sabab_korsatilmagan');

-- CreateTable
CREATE TABLE "student_freezes" (
    "id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "frozen_by_id" UUID NOT NULL,
    "frozen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "reason" "FreezeReason" NOT NULL,
    "detailed_note" VARCHAR(1000),
    "phone" VARCHAR(30),
    "start_date" TIMESTAMP(3),
    "filial" VARCHAR(100),
    "student_name" VARCHAR(200) NOT NULL,
    "teacher_name" VARCHAR(200),
    "group_name" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_freezes_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "student_freezes" ADD CONSTRAINT "student_freezes_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_freezes" ADD CONSTRAINT "student_freezes_frozen_by_id_fkey" FOREIGN KEY ("frozen_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
