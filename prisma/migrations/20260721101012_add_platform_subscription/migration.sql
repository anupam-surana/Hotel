-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'HALTED', 'CANCELLED', 'EXPIRED');

-- CreateTable
CREATE TABLE "PlatformSubscription" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
    "razorpayCustomerId" TEXT,
    "razorpaySubscriptionId" TEXT,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlatformSubscription_hotelId_key" ON "PlatformSubscription"("hotelId");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformSubscription_razorpaySubscriptionId_key" ON "PlatformSubscription"("razorpaySubscriptionId");

-- AddForeignKey
ALTER TABLE "PlatformSubscription" ADD CONSTRAINT "PlatformSubscription_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
