-- AlterTable
ALTER TABLE "StandardPackage" ADD COLUMN     "customerTypes" "CustomerType"[] DEFAULT ARRAY[]::"CustomerType"[],
ADD COLUMN     "roofTypes" "RoofType"[] DEFAULT ARRAY[]::"RoofType"[];


-- The MEDA kits come from the company's residential rooftop BOM; roof type is left open
-- because the kit lists no mounting structure. Both can be changed in Admin > Standard packages.
UPDATE "StandardPackage" SET "customerTypes" = ARRAY['RESIDENTIAL']::"CustomerType"[] WHERE "id" LIKE 'pkg_meda_%';
