-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" TIMESTAMP(3),
    "accessToken" TEXT NOT NULL,
    "userId" BIGINT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "accountOwner" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT,
    "collaborator" BOOLEAN DEFAULT false,
    "emailVerified" BOOLEAN DEFAULT false,
    "refreshToken" TEXT,
    "refreshTokenExpires" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TierRule" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "productIds" TEXT NOT NULL DEFAULT '[]',
    "collectionIds" TEXT NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TierRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TierLevel" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "minValue" DOUBLE PRECISION NOT NULL,
    "maxValue" DOUBLE PRECISION,
    "tagValue" TEXT,
    "discount" DOUBLE PRECISION NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "shopifyDiscountId" TEXT,

    CONSTRAINT "TierLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSettings" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "showPricingTable" BOOLEAN NOT NULL DEFAULT true,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TierRule_shop_idx" ON "TierRule"("shop");

-- CreateIndex
CREATE INDEX "TierLevel_ruleId_idx" ON "TierLevel"("ruleId");

-- CreateIndex
CREATE UNIQUE INDEX "AppSettings_shop_key" ON "AppSettings"("shop");

-- AddForeignKey
ALTER TABLE "TierLevel" ADD CONSTRAINT "TierLevel_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "TierRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
