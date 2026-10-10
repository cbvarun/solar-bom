-- Quotation PDFs are now built in the browser from the data stored here.
ALTER TABLE "Quotation" ADD COLUMN "snapshot" JSONB;
