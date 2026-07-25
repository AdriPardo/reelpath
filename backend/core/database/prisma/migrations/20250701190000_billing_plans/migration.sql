-- CreateTable
CREATE TABLE "PlanDefinition" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priceMonthlyCents" INTEGER,
    "stripePriceId" TEXT,
    "limits" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanDefinition_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "planLimits" JSONB;
ALTER TABLE "Organization" ADD COLUMN "stripeCustomerId" TEXT;
ALTER TABLE "Organization" ADD COLUMN "stripeSubscriptionId" TEXT;
ALTER TABLE "Organization" ADD COLUMN "trialEndsAt" TIMESTAMP(3);
