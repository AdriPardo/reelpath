-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "billingStatus" TEXT,
ADD COLUMN "subscriptionRenewsAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "StripeWebhookEvent" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StripeWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StripeWebhookEvent_eventId_key" ON "StripeWebhookEvent"("eventId");
