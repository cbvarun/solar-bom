-- AlterTable
ALTER TABLE "Enquiry" ADD COLUMN     "packageId" TEXT;

-- AddForeignKey
ALTER TABLE "Enquiry" ADD CONSTRAINT "Enquiry_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "StandardPackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

