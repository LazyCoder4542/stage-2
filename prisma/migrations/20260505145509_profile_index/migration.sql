-- DropIndex
DROP INDEX "Profile_id_idx";

-- DropIndex
DROP INDEX "Profile_name_idx";

-- CreateIndex
CREATE INDEX "Profile_gender_age_group_country_id_idx" ON "Profile"("gender", "age_group", "country_id");

-- CreateIndex
CREATE INDEX "Profile_age_idx" ON "Profile"("age");

-- CreateIndex
CREATE INDEX "Profile_created_at_idx" ON "Profile"("created_at");

-- CreateIndex
CREATE INDEX "Profile_gender_probability_idx" ON "Profile"("gender_probability");
