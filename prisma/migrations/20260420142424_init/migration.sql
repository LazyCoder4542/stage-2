-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('male', 'female');

-- CreateEnum
CREATE TYPE "AgeGroup" AS ENUM ('child', 'teenager', 'adult', 'senior');

-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gender" "Gender" NOT NULL,
    "gender_probability" DOUBLE PRECISION NOT NULL,
    "age" INTEGER NOT NULL,
    "age_group" "AgeGroup" NOT NULL,
    "country_id" TEXT NOT NULL,
    "country_name" TEXT NOT NULL,
    "country_probability" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Profile_name_key" ON "Profile"("name");

-- CreateIndex
CREATE INDEX "Profile_id_idx" ON "Profile"("id");

-- CreateIndex
CREATE INDEX "Profile_name_idx" ON "Profile"("name");
