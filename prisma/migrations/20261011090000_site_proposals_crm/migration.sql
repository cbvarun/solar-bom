-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EnquiryStatus" ADD VALUE 'CONTACTED';
ALTER TYPE "EnquiryStatus" ADD VALUE 'SITE_VISIT';
ALTER TYPE "EnquiryStatus" ADD VALUE 'PROPOSAL_SENT';
ALTER TYPE "EnquiryStatus" ADD VALUE 'WON';
ALTER TYPE "EnquiryStatus" ADD VALUE 'LOST';

-- AlterEnum
ALTER TYPE "QuotationStatus" ADD VALUE 'ACCEPTED';

-- AlterTable
ALTER TABLE "Enquiry" ADD COLUMN     "lostReason" TEXT,
ADD COLUMN     "nextFollowUpAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Quotation" ADD COLUMN     "acceptanceNote" TEXT,
ADD COLUMN     "acceptedAt" TIMESTAMP(3),
ADD COLUMN     "acceptedByEmail" TEXT,
ADD COLUMN     "acceptedByName" TEXT,
ADD COLUMN     "acceptedIp" TEXT,
ADD COLUMN     "acceptedUserAgent" TEXT,
ADD COLUMN     "shareToken" TEXT,
ADD COLUMN     "sharedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "EnquiryNote" (
    "id" TEXT NOT NULL,
    "enquiryId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnquiryNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteAssessment" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "roofOutline" JSONB,
    "roofOutlineAreaM2" DECIMAL(10,2),
    "tiltDeg" DECIMAL(5,2),
    "azimuthDeg" DECIMAL(6,2),
    "systemLossPct" DECIMAL(5,2),
    "shadingLossPct" DECIMAL(5,2),
    "yieldEstimate" JSONB,
    "tariffInrPerKwh" DECIMAL(8,3),
    "tariffSource" TEXT,
    "subsidySchemeId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "SiteAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubsidyScheme" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "customerTypes" "CustomerType"[],
    "slabs" JSONB NOT NULL,
    "maxCapacityKw" DECIMAL(10,2),
    "maxAmountInr" DECIMAL(14,2),
    "sourceUrl" TEXT,
    "notes" TEXT,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubsidyScheme_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EnquiryNote_enquiryId_createdAt_idx" ON "EnquiryNote"("enquiryId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SiteAssessment_projectId_key" ON "SiteAssessment"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "SubsidyScheme_code_key" ON "SubsidyScheme"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Quotation_shareToken_key" ON "Quotation"("shareToken");

-- AddForeignKey
ALTER TABLE "EnquiryNote" ADD CONSTRAINT "EnquiryNote_enquiryId_fkey" FOREIGN KEY ("enquiryId") REFERENCES "Enquiry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteAssessment" ADD CONSTRAINT "SiteAssessment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Savings rules. No values: engineering or sales sets them before they are used.
INSERT INTO "EngineRule" ("id", "key", "label", "group", "valueNumber", "unit", "description", "provenance", "isAssumption", "updatedAt") VALUES
  (gen_random_uuid()::text, 'savings_degradation_pct_per_yr', 'Module output degradation per year', 'Savings', NULL, '%/yr', 'Used for multi-year generation and savings. Take it from the selected module''s warranty datasheet. Leave blank to show first-year figures only.', 'ENGINEER_ENTERED', true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'savings_tariff_escalation_pct_per_yr', 'Electricity tariff change per year', 'Savings', NULL, '%/yr', 'Assumed yearly change in the customer''s tariff for multi-year savings. Leave blank to assume no change.', 'ENGINEER_ENTERED', true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'savings_analysis_years', 'Savings analysis period', 'Savings', NULL, 'years', 'Number of years shown in the savings projection. Leave blank to show first-year savings and simple payback only.', 'ENGINEER_ENTERED', true, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

-- Subsidy scheme placeholder: inactive, no amounts. Staff enter the slabs from the official notification.
INSERT INTO "SubsidyScheme" ("id", "code", "name", "customerTypes", "slabs", "sourceUrl", "notes", "active", "updatedAt") VALUES
  (gen_random_uuid()::text, 'PM_SURYA_GHAR', 'PM Surya Ghar: Muft Bijli Yojana (central financial assistance)', ARRAY['RESIDENTIAL']::"CustomerType"[], '[]'::jsonb, 'https://pmsuryaghar.gov.in', 'Enter the current assistance per kW and caps from the official notification, attach the source, then activate. Eligibility is decided by the scheme portal and DISCOM, not by this estimate.', false, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;
