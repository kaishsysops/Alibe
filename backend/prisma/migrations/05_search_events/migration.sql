-- "Popular right now": what people really search for.
CREATE TABLE "SearchEvent" (
    "id" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "userKey" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SearchEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SearchEvent_term_userKey_day_key" ON "SearchEvent"("term", "userKey", "day");
CREATE INDEX "SearchEvent_day_idx" ON "SearchEvent"("day");
