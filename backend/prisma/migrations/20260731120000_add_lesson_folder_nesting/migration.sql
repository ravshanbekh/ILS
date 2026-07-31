-- AlterTable
ALTER TABLE "lesson_folders" ADD COLUMN "parent_id" UUID;

-- AddForeignKey
ALTER TABLE "lesson_folders" ADD CONSTRAINT "lesson_folders_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "lesson_folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
