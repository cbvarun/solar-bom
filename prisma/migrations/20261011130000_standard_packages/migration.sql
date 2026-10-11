-- AlterTable
ALTER TABLE "BOMHeader" ADD COLUMN     "sourcePackageId" TEXT;

-- CreateTable
CREATE TABLE "StandardPackage" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacityKwp" DECIMAL(8,3) NOT NULL,
    "supplyPhase" "SupplyPhase" NOT NULL,
    "systemType" "SystemType" NOT NULL DEFAULT 'GRID_TIED',
    "moduleWp" INTEGER,
    "moduleCount" INTEGER,
    "source" TEXT NOT NULL,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT,

    CONSTRAINT "StandardPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StandardPackageLine" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "section" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "unit" TEXT NOT NULL,
    "makeScope" TEXT,
    "productId" TEXT,

    CONSTRAINT "StandardPackageLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StandardPackage_code_key" ON "StandardPackage"("code");

-- CreateIndex
CREATE INDEX "StandardPackageLine_packageId_idx" ON "StandardPackageLine"("packageId");

-- AddForeignKey
ALTER TABLE "BOMHeader" ADD CONSTRAINT "BOMHeader_sourcePackageId_fkey" FOREIGN KEY ("sourcePackageId") REFERENCES "StandardPackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StandardPackageLine" ADD CONSTRAINT "StandardPackageLine_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "StandardPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StandardPackageLine" ADD CONSTRAINT "StandardPackageLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Catalogue items and standard packages from the company's MEDA BOM document. Item text is kept as written;
-- no specifications are entered. Rows that already exist (same name, SKU or code) are left unchanged.

INSERT INTO "Manufacturer" ("id","name","illustrative","notes") VALUES ('mfr_tata_power_solar','Tata Power Solar',false,'Module make named in the company''s MEDA standard BOM ("Tata Power Solar - TC/TP"). No details verified.') ON CONFLICT ("name") DO NOTHING;

INSERT INTO "Manufacturer" ("id","name","illustrative","notes") VALUES ('mfr_meda_approved_vendor','Approved vendor (as per MEDA BOM)',true,'Placeholder: the MEDA standard BOM lists these items as "TPS Approved Vendors" without naming a make.') ON CONFLICT ("name") DO NOTHING;

INSERT INTO "Manufacturer" ("id","name","illustrative","notes") VALUES ('mfr_meda_inverter_makes','Sofar/Solis/Goodwe/Solax/Foxess or equivalent (as per MEDA BOM)',true,'Placeholder: the MEDA standard BOM allows any of Sofar, Solis, Goodwe, Solax or Foxess, or equivalent.') ON CONFLICT ("name") DO NOTHING;

INSERT INTO "Product" ("id","sku","name","model","description","categoryId","manufacturerId","unit","status","availability","illustrative","provenance","updatedAt")
SELECT 'prd_meda_mod_590_bf','MEDA-MOD-590-BF','Solar PV module 590 Wp, mono PERC bifacial DCR','As per MEDA BOM','As listed in the company''s MEDA standard BOM: "Solar PV module: 590 Wp, Mono PERC - Bifacial DCR". Make/scope: Tata Power Solar - TC/TP. No manufacturer specifications have been entered or verified.',c.id,m.id,'nos','ACTIVE','UNKNOWN',false,'USER_ESTIMATE',CURRENT_TIMESTAMP
FROM "ProductCategory" c, "Manufacturer" m WHERE c.slug = 'pv-modules' AND m.name = 'Tata Power Solar' ON CONFLICT ("sku") DO NOTHING;

INSERT INTO "Product" ("id","sku","name","model","description","categoryId","manufacturerId","unit","status","availability","illustrative","provenance","updatedAt")
SELECT 'prd_meda_ajb_acdb_1p5k','MEDA-AJB-ACDB-1P5K','AJB 1 in 1 out with fuse and SPD T2, plus ACDB 5 kW single-phase','As per MEDA BOM','As listed in the company''s MEDA standard BOM: "AJB, 1 IP 1 OP, FUSE,600V SPD T2 + ACDB 5kW 1 Phase". Make/scope: TPS Approved Vendors. No manufacturer specifications have been entered or verified.',c.id,m.id,'nos','ACTIVE','UNKNOWN',false,'USER_ESTIMATE',CURRENT_TIMESTAMP
FROM "ProductCategory" c, "Manufacturer" m WHERE c.slug = 'dc-protection' AND m.name = 'Approved vendor (as per MEDA BOM)' ON CONFLICT ("sku") DO NOTHING;

INSERT INTO "Product" ("id","sku","name","model","description","categoryId","manufacturerId","unit","status","availability","illustrative","provenance","updatedAt")
SELECT 'prd_meda_ajb_1i1o','MEDA-AJB-1I1O','AJB 1 in 1 out with fuse and SPD type II','As per MEDA BOM','As listed in the company''s MEDA standard BOM: "AJB, 1 I/P 1O/P, WITH FUSE, SPD TYPE II". Make/scope: TPS Approved Vendors. No manufacturer specifications have been entered or verified.',c.id,m.id,'nos','ACTIVE','UNKNOWN',false,'USER_ESTIMATE',CURRENT_TIMESTAMP
FROM "ProductCategory" c, "Manufacturer" m WHERE c.slug = 'dc-protection' AND m.name = 'Approved vendor (as per MEDA BOM)' ON CONFLICT ("sku") DO NOTHING;

INSERT INTO "Product" ("id","sku","name","model","description","categoryId","manufacturerId","unit","status","availability","illustrative","provenance","updatedAt")
SELECT 'prd_meda_ajb_2i2o','MEDA-AJB-2I2O','AJB 2 in 2 out with fuse and SPD type II','As per MEDA BOM','As listed in the company''s MEDA standard BOM: "AJB, 2 I/P 2 O/P, WITH FUSE, SPD TYPE II". Make/scope: TPS Approved Vendors. No manufacturer specifications have been entered or verified.',c.id,m.id,'nos','ACTIVE','UNKNOWN',false,'USER_ESTIMATE',CURRENT_TIMESTAMP
FROM "ProductCategory" c, "Manufacturer" m WHERE c.slug = 'dc-protection' AND m.name = 'Approved vendor (as per MEDA BOM)' ON CONFLICT ("sku") DO NOTHING;

INSERT INTO "Product" ("id","sku","name","model","description","categoryId","manufacturerId","unit","status","availability","illustrative","provenance","updatedAt")
SELECT 'prd_meda_acdb_3p10k','MEDA-ACDB-3P10K','ACDB up to 10 kW three-phase with CB, SPD type II and kWh meter','As per MEDA BOM','As listed in the company''s MEDA standard BOM: "ACDB UPTO 10kW 3PH WITH CB, SPD TYPE II KWH,Polycarbanate ENCL". Make/scope: TPS Approved Vendors. No manufacturer specifications have been entered or verified.',c.id,m.id,'nos','ACTIVE','UNKNOWN',false,'USER_ESTIMATE',CURRENT_TIMESTAMP
FROM "ProductCategory" c, "Manufacturer" m WHERE c.slug = 'ac-distribution' AND m.name = 'Approved vendor (as per MEDA BOM)' ON CONFLICT ("sku") DO NOTHING;

INSERT INTO "Product" ("id","sku","name","model","description","categoryId","manufacturerId","unit","status","availability","illustrative","provenance","updatedAt")
SELECT 'prd_meda_inv_1p_2k','MEDA-INV-1P-2K','Grid-tie inverter 2 kW single-phase','As per MEDA BOM','As listed in the company''s MEDA standard BOM: "Grid Connect Solar Inverter (1X2kW,230V AC, 50Hz, MPPT),". Make/scope: Sofar/Solis/Goodwe/Solax/Foxess Equlnt. No manufacturer specifications have been entered or verified.',c.id,m.id,'nos','ACTIVE','UNKNOWN',false,'USER_ESTIMATE',CURRENT_TIMESTAMP
FROM "ProductCategory" c, "Manufacturer" m WHERE c.slug = 'inverters' AND m.name = 'Sofar/Solis/Goodwe/Solax/Foxess or equivalent (as per MEDA BOM)' ON CONFLICT ("sku") DO NOTHING;

INSERT INTO "Product" ("id","sku","name","model","description","categoryId","manufacturerId","unit","status","availability","illustrative","provenance","updatedAt")
SELECT 'prd_meda_inv_1p_3k','MEDA-INV-1P-3K','Grid-tie inverter 3 kW single-phase','As per MEDA BOM','As listed in the company''s MEDA standard BOM: "Grid Connect Solar Inverter (1X3kW,230V AC, 50Hz, MPPT),". Make/scope: Sofar/Solis/Goodwe/Solax/Foxess Equlnt. No manufacturer specifications have been entered or verified.',c.id,m.id,'nos','ACTIVE','UNKNOWN',false,'USER_ESTIMATE',CURRENT_TIMESTAMP
FROM "ProductCategory" c, "Manufacturer" m WHERE c.slug = 'inverters' AND m.name = 'Sofar/Solis/Goodwe/Solax/Foxess or equivalent (as per MEDA BOM)' ON CONFLICT ("sku") DO NOTHING;

INSERT INTO "Product" ("id","sku","name","model","description","categoryId","manufacturerId","unit","status","availability","illustrative","provenance","updatedAt")
SELECT 'prd_meda_inv_1p_4k','MEDA-INV-1P-4K','Grid-tie inverter 4 kW single-phase','As per MEDA BOM','As listed in the company''s MEDA standard BOM: "Grid Connect Solar Inverter (1X4kW,230V AC, 50Hz, MPPT),". Make/scope: Sofar/Solis/Goodwe/Solax/Foxess Equlnt. No manufacturer specifications have been entered or verified.',c.id,m.id,'nos','ACTIVE','UNKNOWN',false,'USER_ESTIMATE',CURRENT_TIMESTAMP
FROM "ProductCategory" c, "Manufacturer" m WHERE c.slug = 'inverters' AND m.name = 'Sofar/Solis/Goodwe/Solax/Foxess or equivalent (as per MEDA BOM)' ON CONFLICT ("sku") DO NOTHING;

INSERT INTO "Product" ("id","sku","name","model","description","categoryId","manufacturerId","unit","status","availability","illustrative","provenance","updatedAt")
SELECT 'prd_meda_inv_1p_5k','MEDA-INV-1P-5K','Grid-tie inverter 5 kW single-phase','As per MEDA BOM','As listed in the company''s MEDA standard BOM: "Grid Connect Solar Inverter (1X5kW,230V AC, 50Hz, MPPT), DC:AC=1.3 max". Make/scope: Sofar/Solis/Goodwe/Solax/Foxess Equlnt. No manufacturer specifications have been entered or verified.',c.id,m.id,'nos','ACTIVE','UNKNOWN',false,'USER_ESTIMATE',CURRENT_TIMESTAMP
FROM "ProductCategory" c, "Manufacturer" m WHERE c.slug = 'inverters' AND m.name = 'Sofar/Solis/Goodwe/Solax/Foxess or equivalent (as per MEDA BOM)' ON CONFLICT ("sku") DO NOTHING;

INSERT INTO "Product" ("id","sku","name","model","description","categoryId","manufacturerId","unit","status","availability","illustrative","provenance","updatedAt")
SELECT 'prd_meda_inv_3p_5k','MEDA-INV-3P-5K','Grid-tie inverter 5 kW three-phase','As per MEDA BOM','As listed in the company''s MEDA standard BOM: "3P5K- 4G-DC,3PH Grid Tie Inverter". Make/scope: Sofar/Solis/Goodwe/Solax/Foxess Equlnt. No manufacturer specifications have been entered or verified.',c.id,m.id,'nos','ACTIVE','UNKNOWN',false,'USER_ESTIMATE',CURRENT_TIMESTAMP
FROM "ProductCategory" c, "Manufacturer" m WHERE c.slug = 'inverters' AND m.name = 'Sofar/Solis/Goodwe/Solax/Foxess or equivalent (as per MEDA BOM)' ON CONFLICT ("sku") DO NOTHING;

INSERT INTO "Product" ("id","sku","name","model","description","categoryId","manufacturerId","unit","status","availability","illustrative","provenance","updatedAt")
SELECT 'prd_meda_inv_3p_6k','MEDA-INV-3P-6K','Grid-tie inverter 6 kW three-phase','As per MEDA BOM','As listed in the company''s MEDA standard BOM: "3P6K- -DC,3PH Grid Tie Inverter". Make/scope: Sofar/Solis/Goodwe/Solax/Foxess Equlnt. No manufacturer specifications have been entered or verified.',c.id,m.id,'nos','ACTIVE','UNKNOWN',false,'USER_ESTIMATE',CURRENT_TIMESTAMP
FROM "ProductCategory" c, "Manufacturer" m WHERE c.slug = 'inverters' AND m.name = 'Sofar/Solis/Goodwe/Solax/Foxess or equivalent (as per MEDA BOM)' ON CONFLICT ("sku") DO NOTHING;

INSERT INTO "Product" ("id","sku","name","model","description","categoryId","manufacturerId","unit","status","availability","illustrative","provenance","updatedAt")
SELECT 'prd_meda_inv_3p_8k','MEDA-INV-3P-8K','Grid-tie inverter 8 kW three-phase','As per MEDA BOM','As listed in the company''s MEDA standard BOM: "3P8K- 4G-DC,3PH Grid Tie Inverter". Make/scope: Sofar/Solis/Goodwe/Solax/Foxess Equlnt. No manufacturer specifications have been entered or verified.',c.id,m.id,'nos','ACTIVE','UNKNOWN',false,'USER_ESTIMATE',CURRENT_TIMESTAMP
FROM "ProductCategory" c, "Manufacturer" m WHERE c.slug = 'inverters' AND m.name = 'Sofar/Solis/Goodwe/Solax/Foxess or equivalent (as per MEDA BOM)' ON CONFLICT ("sku") DO NOTHING;

INSERT INTO "Product" ("id","sku","name","model","description","categoryId","manufacturerId","unit","status","availability","illustrative","provenance","updatedAt")
SELECT 'prd_meda_inv_3p_10k','MEDA-INV-3P-10K','Grid-tie inverter 10 kW three-phase','As per MEDA BOM','As listed in the company''s MEDA standard BOM: "3P10K- 4G-DC,3PH Grid Tie Inverter". Make/scope: Sofar/Solis/Goodwe/Solax/Foxess Equlnt. No manufacturer specifications have been entered or verified.',c.id,m.id,'nos','ACTIVE','UNKNOWN',false,'USER_ESTIMATE',CURRENT_TIMESTAMP
FROM "ProductCategory" c, "Manufacturer" m WHERE c.slug = 'inverters' AND m.name = 'Sofar/Solis/Goodwe/Solax/Foxess or equivalent (as per MEDA BOM)' ON CONFLICT ("sku") DO NOTHING;

INSERT INTO "Product" ("id","sku","name","model","description","categoryId","manufacturerId","unit","status","availability","illustrative","provenance","updatedAt")
SELECT 'prd_meda_mc4_f','MEDA-MC4-F','MC4 female cable connector','As per MEDA BOM','As listed in the company''s MEDA standard BOM: "MC4 FEMALE CABLE CONNECTOR". Make/scope: TPS Approved Vendors. No manufacturer specifications have been entered or verified.',c.id,m.id,'nos','ACTIVE','UNKNOWN',false,'USER_ESTIMATE',CURRENT_TIMESTAMP
FROM "ProductCategory" c, "Manufacturer" m WHERE c.slug = 'dc-cables-connectors' AND m.name = 'Approved vendor (as per MEDA BOM)' ON CONFLICT ("sku") DO NOTHING;

INSERT INTO "Product" ("id","sku","name","model","description","categoryId","manufacturerId","unit","status","availability","illustrative","provenance","updatedAt")
SELECT 'prd_meda_mc4_m','MEDA-MC4-M','MC4 male cable connector','As per MEDA BOM','As listed in the company''s MEDA standard BOM: "MC4 MALE CABLE CONNECTOR". Make/scope: TPS Approved Vendors. No manufacturer specifications have been entered or verified.',c.id,m.id,'nos','ACTIVE','UNKNOWN',false,'USER_ESTIMATE',CURRENT_TIMESTAMP
FROM "ProductCategory" c, "Manufacturer" m WHERE c.slug = 'dc-cables-connectors' AND m.name = 'Approved vendor (as per MEDA BOM)' ON CONFLICT ("sku") DO NOTHING;

INSERT INTO "Product" ("id","sku","name","model","description","categoryId","manufacturerId","unit","status","availability","illustrative","provenance","updatedAt")
SELECT 'prd_meda_mc4_t_pos','MEDA-MC4-T-POS','MC4 T-branch connector (+ve) 2 in 1 out','As per MEDA BOM','As listed in the company''s MEDA standard BOM: "MC4 T BRANCH CONNECTOR (+VE) 2 IN 1 OUT, 1500VDC". Make/scope: TPS Approved Vendors. No manufacturer specifications have been entered or verified.',c.id,m.id,'nos','ACTIVE','UNKNOWN',false,'USER_ESTIMATE',CURRENT_TIMESTAMP
FROM "ProductCategory" c, "Manufacturer" m WHERE c.slug = 'dc-cables-connectors' AND m.name = 'Approved vendor (as per MEDA BOM)' ON CONFLICT ("sku") DO NOTHING;

INSERT INTO "Product" ("id","sku","name","model","description","categoryId","manufacturerId","unit","status","availability","illustrative","provenance","updatedAt")
SELECT 'prd_meda_mc4_t_neg','MEDA-MC4-T-NEG','MC4 T-branch connector (-ve) 2 in 1 out','As per MEDA BOM','As listed in the company''s MEDA standard BOM: "MC4 T BRANCH CONNECTOR (-VE) 2 IN 1 OUT, 1500VDC". Make/scope: TPS Approved Vendors. No manufacturer specifications have been entered or verified.',c.id,m.id,'nos','ACTIVE','UNKNOWN',false,'USER_ESTIMATE',CURRENT_TIMESTAMP
FROM "ProductCategory" c, "Manufacturer" m WHERE c.slug = 'dc-cables-connectors' AND m.name = 'Approved vendor (as per MEDA BOM)' ON CONFLICT ("sku") DO NOTHING;

INSERT INTO "Product" ("id","sku","name","model","description","categoryId","manufacturerId","unit","status","availability","illustrative","provenance","updatedAt")
SELECT 'prd_meda_earth_kit','MEDA-EARTH-KIT','Earthing kit 1.5 m, copper bonded, with compound','As per MEDA BOM','As listed in the company''s MEDA standard BOM: "Earthing kit 1.5M, copper Bonded , 250Micron_15Kg Compound". Make/scope: TPS Approved Vendors. No manufacturer specifications have been entered or verified.',c.id,m.id,'nos','ACTIVE','UNKNOWN',false,'USER_ESTIMATE',CURRENT_TIMESTAMP
FROM "ProductCategory" c, "Manufacturer" m WHERE c.slug = 'earthing-bonding' AND m.name = 'Approved vendor (as per MEDA BOM)' ON CONFLICT ("sku") DO NOTHING;

INSERT INTO "Product" ("id","sku","name","model","description","categoryId","manufacturerId","unit","status","availability","illustrative","provenance","updatedAt")
SELECT 'prd_meda_la_2m','MEDA-LA-2M','Lightning arrester 2 m, conventional','As per MEDA BOM','As listed in the company''s MEDA standard BOM: "LIGTHENING ARRESTOR, 2M CONVENTIONAL". Make/scope: TPS Approved Vendors. No manufacturer specifications have been entered or verified.',c.id,m.id,'nos','ACTIVE','UNKNOWN',false,'USER_ESTIMATE',CURRENT_TIMESTAMP
FROM "ProductCategory" c, "Manufacturer" m WHERE c.slug = 'lightning-protection' AND m.name = 'Approved vendor (as per MEDA BOM)' ON CONFLICT ("sku") DO NOTHING;

INSERT INTO "StandardPackage" ("id","code","name","capacityKwp","supplyPhase","systemType","moduleWp","moduleCount","source","notes","sortOrder") VALUES ('pkg_meda_2_36kw_1ph','MEDA_2_36KW_1PH','2.36 kW 1ph MEDA',2.36,'SINGLE','GRID_TIED',590,4,'BOM MEDA below 10kW - Items (company document, June 2026)','Supply items and quantities as listed in the company''s MEDA standard BOM. Makes are as written there; specifications are not manufacturer-verified. Not listed in the package: mounting structure, DC and AC cables, cable management and installation services. Add them to the project BOM if they are in scope. MEDA is Maharashtra''s agency: confirm the package against current BESCOM requirements for Bengaluru projects.',1) ON CONFLICT ("code") DO NOTHING;

INSERT INTO "StandardPackageLine" ("id","packageId","lineNo","section","description","quantity","unit","makeScope","productId")
SELECT v.id, v."packageId", v."lineNo", v.section, v.description, v.quantity, v.unit, v."makeScope", p.id FROM (VALUES
  ('pkg_meda_2_36kw_1ph_l1','pkg_meda_2_36kw_1ph',1,'PV_MODULES','Solar PV module: 590 Wp, Mono PERC - Bifacial DCR',4,'no','Tata Power Solar - TC/TP','MEDA-MOD-590-BF'),
  ('pkg_meda_2_36kw_1ph_l2','pkg_meda_2_36kw_1ph',2,'DC_WIRING','AJB, 1 IP 1 OP, FUSE,600V SPD T2 + ACDB 5kW 1 Phase',1,'no','TPS Approved Vendors','MEDA-AJB-ACDB-1P5K'),
  ('pkg_meda_2_36kw_1ph_l3','pkg_meda_2_36kw_1ph',3,'INVERTER','Grid Connect Solar Inverter (1X2kW,230V AC, 50Hz, MPPT),',1,'no','Sofar/Solis/Goodwe/Solax/Foxess Equlnt','MEDA-INV-1P-2K'),
  ('pkg_meda_2_36kw_1ph_l4','pkg_meda_2_36kw_1ph',4,'DC_WIRING','MC4 FEMALE CABLE CONNECTOR',2,'no','TPS Approved Vendors','MEDA-MC4-F'),
  ('pkg_meda_2_36kw_1ph_l5','pkg_meda_2_36kw_1ph',5,'DC_WIRING','MC4 MALE CABLE CONNECTOR',2,'no','TPS Approved Vendors','MEDA-MC4-M'),
  ('pkg_meda_2_36kw_1ph_l6','pkg_meda_2_36kw_1ph',6,'EARTHING','Earthing kit 1.5M, copper Bonded , 250Micron_15Kg Compound',3,'no','TPS Approved Vendors','MEDA-EARTH-KIT'),
  ('pkg_meda_2_36kw_1ph_l7','pkg_meda_2_36kw_1ph',7,'LIGHTNING','LIGTHENING ARRESTOR, 2M CONVENTIONAL',1,'no','TPS Approved Vendors','MEDA-LA-2M')
) AS v(id, "packageId", "lineNo", section, description, quantity, unit, "makeScope", sku)
LEFT JOIN "Product" p ON p.sku = v.sku
WHERE EXISTS (SELECT 1 FROM "StandardPackage" s WHERE s.id = v."packageId") ON CONFLICT ("id") DO NOTHING;

INSERT INTO "StandardPackage" ("id","code","name","capacityKwp","supplyPhase","systemType","moduleWp","moduleCount","source","notes","sortOrder") VALUES ('pkg_meda_2_95kw_1ph','MEDA_2_95KW_1PH','2.95 kW 1ph MEDA',2.95,'SINGLE','GRID_TIED',590,5,'BOM MEDA below 10kW - Items (company document, June 2026)','Supply items and quantities as listed in the company''s MEDA standard BOM. Makes are as written there; specifications are not manufacturer-verified. Not listed in the package: mounting structure, DC and AC cables, cable management and installation services. Add them to the project BOM if they are in scope. MEDA is Maharashtra''s agency: confirm the package against current BESCOM requirements for Bengaluru projects.',2) ON CONFLICT ("code") DO NOTHING;

INSERT INTO "StandardPackageLine" ("id","packageId","lineNo","section","description","quantity","unit","makeScope","productId")
SELECT v.id, v."packageId", v."lineNo", v.section, v.description, v.quantity, v.unit, v."makeScope", p.id FROM (VALUES
  ('pkg_meda_2_95kw_1ph_l1','pkg_meda_2_95kw_1ph',1,'PV_MODULES','Solar PV module: 590 Wp, Mono PERC - Bifacial DCR',5,'no','Tata Power Solar - TC/TP','MEDA-MOD-590-BF'),
  ('pkg_meda_2_95kw_1ph_l2','pkg_meda_2_95kw_1ph',2,'DC_WIRING','AJB, 1 IP 1 OP, FUSE,600V SPD T2 + ACDB 5kW 1 Phase',1,'no','TPS Approved Vendors','MEDA-AJB-ACDB-1P5K'),
  ('pkg_meda_2_95kw_1ph_l3','pkg_meda_2_95kw_1ph',3,'INVERTER','Grid Connect Solar Inverter (1X3kW,230V AC, 50Hz, MPPT),',1,'no','Sofar/Solis/Goodwe/Solax/Foxess Equlnt','MEDA-INV-1P-3K'),
  ('pkg_meda_2_95kw_1ph_l4','pkg_meda_2_95kw_1ph',4,'DC_WIRING','MC4 FEMALE CABLE CONNECTOR',4,'no','TPS Approved Vendors','MEDA-MC4-F'),
  ('pkg_meda_2_95kw_1ph_l5','pkg_meda_2_95kw_1ph',5,'DC_WIRING','MC4 MALE CABLE CONNECTOR',4,'no','TPS Approved Vendors','MEDA-MC4-M'),
  ('pkg_meda_2_95kw_1ph_l6','pkg_meda_2_95kw_1ph',6,'EARTHING','Earthing kit 1.5M, copper Bonded , 250Micron_15Kg Compound',3,'no','TPS Approved Vendors','MEDA-EARTH-KIT'),
  ('pkg_meda_2_95kw_1ph_l7','pkg_meda_2_95kw_1ph',7,'LIGHTNING','LIGTHENING ARRESTOR, 2M CONVENTIONAL',1,'no','TPS Approved Vendors','MEDA-LA-2M')
) AS v(id, "packageId", "lineNo", section, description, quantity, unit, "makeScope", sku)
LEFT JOIN "Product" p ON p.sku = v.sku
WHERE EXISTS (SELECT 1 FROM "StandardPackage" s WHERE s.id = v."packageId") ON CONFLICT ("id") DO NOTHING;

INSERT INTO "StandardPackage" ("id","code","name","capacityKwp","supplyPhase","systemType","moduleWp","moduleCount","source","notes","sortOrder") VALUES ('pkg_meda_3_51kw_1ph','MEDA_3_51KW_1PH','3.51 kW 1ph MEDA',3.54,'SINGLE','GRID_TIED',590,6,'BOM MEDA below 10kW - Items (company document, June 2026)','The document titles this kit 3.51 kW, but 6 × 590 Wp = 3.54 kWp; capacity is stored as 3.54 kWp. Confirm with engineering. Supply items and quantities as listed in the company''s MEDA standard BOM. Makes are as written there; specifications are not manufacturer-verified. Not listed in the package: mounting structure, DC and AC cables, cable management and installation services. Add them to the project BOM if they are in scope. MEDA is Maharashtra''s agency: confirm the package against current BESCOM requirements for Bengaluru projects.',3) ON CONFLICT ("code") DO NOTHING;

INSERT INTO "StandardPackageLine" ("id","packageId","lineNo","section","description","quantity","unit","makeScope","productId")
SELECT v.id, v."packageId", v."lineNo", v.section, v.description, v.quantity, v.unit, v."makeScope", p.id FROM (VALUES
  ('pkg_meda_3_51kw_1ph_l1','pkg_meda_3_51kw_1ph',1,'PV_MODULES','Solar PV module: 590 Wp, Mono PERC - Bifacial DCR',6,'no','Tata Power Solar - TC/TP','MEDA-MOD-590-BF'),
  ('pkg_meda_3_51kw_1ph_l2','pkg_meda_3_51kw_1ph',2,'DC_WIRING','AJB, 1 IP 1 OP, FUSE,600V SPD T2 + ACDB 5kW 1 Phase',1,'no','TPS Approved Vendors','MEDA-AJB-ACDB-1P5K'),
  ('pkg_meda_3_51kw_1ph_l3','pkg_meda_3_51kw_1ph',3,'INVERTER','Grid Connect Solar Inverter (1X3kW,230V AC, 50Hz, MPPT),',1,'no','Sofar/Solis/Goodwe/Solax/Foxess Equlnt','MEDA-INV-1P-3K'),
  ('pkg_meda_3_51kw_1ph_l4','pkg_meda_3_51kw_1ph',4,'DC_WIRING','MC4 FEMALE CABLE CONNECTOR',4,'no','TPS Approved Vendors','MEDA-MC4-F'),
  ('pkg_meda_3_51kw_1ph_l5','pkg_meda_3_51kw_1ph',5,'DC_WIRING','MC4 MALE CABLE CONNECTOR',4,'no','TPS Approved Vendors','MEDA-MC4-M'),
  ('pkg_meda_3_51kw_1ph_l6','pkg_meda_3_51kw_1ph',6,'EARTHING','Earthing kit 1.5M, copper Bonded , 250Micron_15Kg Compound',3,'no','TPS Approved Vendors','MEDA-EARTH-KIT'),
  ('pkg_meda_3_51kw_1ph_l7','pkg_meda_3_51kw_1ph',7,'LIGHTNING','LIGTHENING ARRESTOR, 2M CONVENTIONAL',1,'no','TPS Approved Vendors','MEDA-LA-2M')
) AS v(id, "packageId", "lineNo", section, description, quantity, unit, "makeScope", sku)
LEFT JOIN "Product" p ON p.sku = v.sku
WHERE EXISTS (SELECT 1 FROM "StandardPackage" s WHERE s.id = v."packageId") ON CONFLICT ("id") DO NOTHING;

INSERT INTO "StandardPackage" ("id","code","name","capacityKwp","supplyPhase","systemType","moduleWp","moduleCount","source","notes","sortOrder") VALUES ('pkg_meda_4_72kw_1ph','MEDA_4_72KW_1PH','4.72 kW 1ph MEDA',4.72,'SINGLE','GRID_TIED',590,8,'BOM MEDA below 10kW - Items (company document, June 2026)','Supply items and quantities as listed in the company''s MEDA standard BOM. Makes are as written there; specifications are not manufacturer-verified. Not listed in the package: mounting structure, DC and AC cables, cable management and installation services. Add them to the project BOM if they are in scope. MEDA is Maharashtra''s agency: confirm the package against current BESCOM requirements for Bengaluru projects.',4) ON CONFLICT ("code") DO NOTHING;

INSERT INTO "StandardPackageLine" ("id","packageId","lineNo","section","description","quantity","unit","makeScope","productId")
SELECT v.id, v."packageId", v."lineNo", v.section, v.description, v.quantity, v.unit, v."makeScope", p.id FROM (VALUES
  ('pkg_meda_4_72kw_1ph_l1','pkg_meda_4_72kw_1ph',1,'PV_MODULES','Solar PV module: 590 Wp, Mono PERC - Bifacial DCR',8,'no','Tata Power Solar - TC/TP','MEDA-MOD-590-BF'),
  ('pkg_meda_4_72kw_1ph_l2','pkg_meda_4_72kw_1ph',2,'DC_WIRING','AJB, 1 IP 1 OP, FUSE,600V SPD T2 + ACDB 5kW 1 Phase',1,'no','TPS Approved Vendors','MEDA-AJB-ACDB-1P5K'),
  ('pkg_meda_4_72kw_1ph_l3','pkg_meda_4_72kw_1ph',3,'INVERTER','Grid Connect Solar Inverter (1X4kW,230V AC, 50Hz, MPPT),',1,'no','Sofar/Solis/Goodwe/Solax/Foxess Equlnt','MEDA-INV-1P-4K'),
  ('pkg_meda_4_72kw_1ph_l4','pkg_meda_4_72kw_1ph',4,'DC_WIRING','MC4 FEMALE CABLE CONNECTOR',5,'no','TPS Approved Vendors','MEDA-MC4-F'),
  ('pkg_meda_4_72kw_1ph_l5','pkg_meda_4_72kw_1ph',5,'DC_WIRING','MC4 MALE CABLE CONNECTOR',5,'no','TPS Approved Vendors','MEDA-MC4-M'),
  ('pkg_meda_4_72kw_1ph_l6','pkg_meda_4_72kw_1ph',6,'EARTHING','Earthing kit 1.5M, copper Bonded , 250Micron_15Kg Compound',3,'no','TPS Approved Vendors','MEDA-EARTH-KIT'),
  ('pkg_meda_4_72kw_1ph_l7','pkg_meda_4_72kw_1ph',7,'LIGHTNING','LIGTHENING ARRESTOR, 2M CONVENTIONAL',1,'no','TPS Approved Vendors','MEDA-LA-2M')
) AS v(id, "packageId", "lineNo", section, description, quantity, unit, "makeScope", sku)
LEFT JOIN "Product" p ON p.sku = v.sku
WHERE EXISTS (SELECT 1 FROM "StandardPackage" s WHERE s.id = v."packageId") ON CONFLICT ("id") DO NOTHING;

INSERT INTO "StandardPackage" ("id","code","name","capacityKwp","supplyPhase","systemType","moduleWp","moduleCount","source","notes","sortOrder") VALUES ('pkg_meda_5_31kw_1ph','MEDA_5_31KW_1PH','5.31 kW 1ph MEDA',5.31,'SINGLE','GRID_TIED',590,9,'BOM MEDA below 10kW - Items (company document, June 2026)','Supply items and quantities as listed in the company''s MEDA standard BOM. Makes are as written there; specifications are not manufacturer-verified. Not listed in the package: mounting structure, DC and AC cables, cable management and installation services. Add them to the project BOM if they are in scope. MEDA is Maharashtra''s agency: confirm the package against current BESCOM requirements for Bengaluru projects.',5) ON CONFLICT ("code") DO NOTHING;

INSERT INTO "StandardPackageLine" ("id","packageId","lineNo","section","description","quantity","unit","makeScope","productId")
SELECT v.id, v."packageId", v."lineNo", v.section, v.description, v.quantity, v.unit, v."makeScope", p.id FROM (VALUES
  ('pkg_meda_5_31kw_1ph_l1','pkg_meda_5_31kw_1ph',1,'PV_MODULES','Solar PV module: 590 Wp, Mono PERC - Bifacial DCR',9,'no','Tata Power Solar - TC/TP','MEDA-MOD-590-BF'),
  ('pkg_meda_5_31kw_1ph_l2','pkg_meda_5_31kw_1ph',2,'DC_WIRING','AJB, 1 IP 1 OP, FUSE,600V SPD T2 + ACDB 5kW 1 Phase',1,'no','TPS Approved Vendors','MEDA-AJB-ACDB-1P5K'),
  ('pkg_meda_5_31kw_1ph_l3','pkg_meda_5_31kw_1ph',3,'INVERTER','Grid Connect Solar Inverter (1X5kW,230V AC, 50Hz, MPPT), DC:AC=1.3 max',1,'no','Sofar/Solis/Goodwe/Solax/Foxess Equlnt','MEDA-INV-1P-5K'),
  ('pkg_meda_5_31kw_1ph_l4','pkg_meda_5_31kw_1ph',4,'DC_WIRING','MC4 FEMALE CABLE CONNECTOR',5,'no','TPS Approved Vendors','MEDA-MC4-F'),
  ('pkg_meda_5_31kw_1ph_l5','pkg_meda_5_31kw_1ph',5,'DC_WIRING','MC4 MALE CABLE CONNECTOR',5,'no','TPS Approved Vendors','MEDA-MC4-M'),
  ('pkg_meda_5_31kw_1ph_l6','pkg_meda_5_31kw_1ph',6,'EARTHING','Earthing kit 1.5M, copper Bonded , 250Micron_15Kg Compound',3,'no','TPS Approved Vendors','MEDA-EARTH-KIT'),
  ('pkg_meda_5_31kw_1ph_l7','pkg_meda_5_31kw_1ph',7,'LIGHTNING','LIGTHENING ARRESTOR, 2M CONVENTIONAL',1,'no','TPS Approved Vendors','MEDA-LA-2M')
) AS v(id, "packageId", "lineNo", section, description, quantity, unit, "makeScope", sku)
LEFT JOIN "Product" p ON p.sku = v.sku
WHERE EXISTS (SELECT 1 FROM "StandardPackage" s WHERE s.id = v."packageId") ON CONFLICT ("id") DO NOTHING;

INSERT INTO "StandardPackage" ("id","code","name","capacityKwp","supplyPhase","systemType","moduleWp","moduleCount","source","notes","sortOrder") VALUES ('pkg_meda_5_31kw_3ph','MEDA_5_31KW_3PH','5.31 kW 3ph MEDA',5.31,'THREE','GRID_TIED',590,9,'BOM MEDA below 10kW - Items (company document, June 2026)','Supply items and quantities as listed in the company''s MEDA standard BOM. Makes are as written there; specifications are not manufacturer-verified. Not listed in the package: mounting structure, DC and AC cables, cable management and installation services. Add them to the project BOM if they are in scope. MEDA is Maharashtra''s agency: confirm the package against current BESCOM requirements for Bengaluru projects.',6) ON CONFLICT ("code") DO NOTHING;

INSERT INTO "StandardPackageLine" ("id","packageId","lineNo","section","description","quantity","unit","makeScope","productId")
SELECT v.id, v."packageId", v."lineNo", v.section, v.description, v.quantity, v.unit, v."makeScope", p.id FROM (VALUES
  ('pkg_meda_5_31kw_3ph_l1','pkg_meda_5_31kw_3ph',1,'PV_MODULES','Solar PV module: 590 Wp, Mono PERC - Bifacial DCR',9,'no','Tata Power Solar - TC/TP','MEDA-MOD-590-BF'),
  ('pkg_meda_5_31kw_3ph_l2','pkg_meda_5_31kw_3ph',2,'DC_WIRING','AJB, 1 I/P 1O/P, WITH FUSE, SPD TYPE II',1,'no','TPS Approved Vendors','MEDA-AJB-1I1O'),
  ('pkg_meda_5_31kw_3ph_l3','pkg_meda_5_31kw_3ph',3,'AC_WIRING','ACDB UPTO 10kW 3PH WITH CB, SPD TYPE II KWH,Polycarbanate ENCL',1,'no','TPS Approved Vendors','MEDA-ACDB-3P10K'),
  ('pkg_meda_5_31kw_3ph_l4','pkg_meda_5_31kw_3ph',4,'INVERTER','3P5K- 4G-DC,3PH Grid Tie Inverter',1,'no','Sofar/Solis/Goodwe/Solax/Foxess Equlnt','MEDA-INV-3P-5K'),
  ('pkg_meda_5_31kw_3ph_l5','pkg_meda_5_31kw_3ph',5,'DC_WIRING','MC4 FEMALE CABLE CONNECTOR',6,'no','TPS Approved Vendors','MEDA-MC4-F'),
  ('pkg_meda_5_31kw_3ph_l6','pkg_meda_5_31kw_3ph',6,'DC_WIRING','MC4 MALE CABLE CONNECTOR',6,'no','TPS Approved Vendors','MEDA-MC4-M'),
  ('pkg_meda_5_31kw_3ph_l7','pkg_meda_5_31kw_3ph',7,'EARTHING','Earthing kit 1.5M, copper Bonded , 250Micron_15Kg Compound',3,'no','TPS Approved Vendors','MEDA-EARTH-KIT'),
  ('pkg_meda_5_31kw_3ph_l8','pkg_meda_5_31kw_3ph',8,'LIGHTNING','LIGTHENING ARRESTOR, 2M CONVENTIONAL',1,'no','TPS Approved Vendors','MEDA-LA-2M')
) AS v(id, "packageId", "lineNo", section, description, quantity, unit, "makeScope", sku)
LEFT JOIN "Product" p ON p.sku = v.sku
WHERE EXISTS (SELECT 1 FROM "StandardPackage" s WHERE s.id = v."packageId") ON CONFLICT ("id") DO NOTHING;

INSERT INTO "StandardPackage" ("id","code","name","capacityKwp","supplyPhase","systemType","moduleWp","moduleCount","source","notes","sortOrder") VALUES ('pkg_meda_6_49kw_3ph','MEDA_6_49KW_3PH','6.49 kW 3ph MEDA',6.49,'THREE','GRID_TIED',590,11,'BOM MEDA below 10kW - Items (company document, June 2026)','Supply items and quantities as listed in the company''s MEDA standard BOM. Makes are as written there; specifications are not manufacturer-verified. Not listed in the package: mounting structure, DC and AC cables, cable management and installation services. Add them to the project BOM if they are in scope. MEDA is Maharashtra''s agency: confirm the package against current BESCOM requirements for Bengaluru projects.',7) ON CONFLICT ("code") DO NOTHING;

INSERT INTO "StandardPackageLine" ("id","packageId","lineNo","section","description","quantity","unit","makeScope","productId")
SELECT v.id, v."packageId", v."lineNo", v.section, v.description, v.quantity, v.unit, v."makeScope", p.id FROM (VALUES
  ('pkg_meda_6_49kw_3ph_l1','pkg_meda_6_49kw_3ph',1,'PV_MODULES','Solar PV module: 590 Wp, Mono PERC - Bifacial DCR',11,'no','Tata Power Solar - TC/TP','MEDA-MOD-590-BF'),
  ('pkg_meda_6_49kw_3ph_l2','pkg_meda_6_49kw_3ph',2,'DC_WIRING','AJB, 1 I/P 1O/P, WITH FUSE, SPD TYPE II',1,'no','TPS Approved Vendors','MEDA-AJB-1I1O'),
  ('pkg_meda_6_49kw_3ph_l3','pkg_meda_6_49kw_3ph',3,'AC_WIRING','ACDB UPTO 10kW 3PH WITH CB, SPD TYPE II KWH,Polycarbanate ENCL',1,'no','TPS Approved Vendors','MEDA-ACDB-3P10K'),
  ('pkg_meda_6_49kw_3ph_l4','pkg_meda_6_49kw_3ph',4,'INVERTER','3P6K- -DC,3PH Grid Tie Inverter',1,'no','Sofar/Solis/Goodwe/Solax/Foxess Equlnt','MEDA-INV-3P-6K'),
  ('pkg_meda_6_49kw_3ph_l5','pkg_meda_6_49kw_3ph',5,'DC_WIRING','MC4 FEMALE CABLE CONNECTOR',6,'no','TPS Approved Vendors','MEDA-MC4-F'),
  ('pkg_meda_6_49kw_3ph_l6','pkg_meda_6_49kw_3ph',6,'DC_WIRING','MC4 MALE CABLE CONNECTOR',6,'no','TPS Approved Vendors','MEDA-MC4-M'),
  ('pkg_meda_6_49kw_3ph_l7','pkg_meda_6_49kw_3ph',7,'EARTHING','Earthing kit 1.5M, copper Bonded , 250Micron_15Kg Compound',3,'no','TPS Approved Vendors','MEDA-EARTH-KIT'),
  ('pkg_meda_6_49kw_3ph_l8','pkg_meda_6_49kw_3ph',8,'LIGHTNING','LIGTHENING ARRESTOR, 2M CONVENTIONAL',1,'no','TPS Approved Vendors','MEDA-LA-2M')
) AS v(id, "packageId", "lineNo", section, description, quantity, unit, "makeScope", sku)
LEFT JOIN "Product" p ON p.sku = v.sku
WHERE EXISTS (SELECT 1 FROM "StandardPackage" s WHERE s.id = v."packageId") ON CONFLICT ("id") DO NOTHING;

INSERT INTO "StandardPackage" ("id","code","name","capacityKwp","supplyPhase","systemType","moduleWp","moduleCount","source","notes","sortOrder") VALUES ('pkg_meda_8_85kw_3ph','MEDA_8_85KW_3PH','8.85 kW 3ph MEDA',8.85,'THREE','GRID_TIED',590,15,'BOM MEDA below 10kW - Items (company document, June 2026)','Supply items and quantities as listed in the company''s MEDA standard BOM. Makes are as written there; specifications are not manufacturer-verified. Not listed in the package: mounting structure, DC and AC cables, cable management and installation services. Add them to the project BOM if they are in scope. MEDA is Maharashtra''s agency: confirm the package against current BESCOM requirements for Bengaluru projects.',8) ON CONFLICT ("code") DO NOTHING;

INSERT INTO "StandardPackageLine" ("id","packageId","lineNo","section","description","quantity","unit","makeScope","productId")
SELECT v.id, v."packageId", v."lineNo", v.section, v.description, v.quantity, v.unit, v."makeScope", p.id FROM (VALUES
  ('pkg_meda_8_85kw_3ph_l1','pkg_meda_8_85kw_3ph',1,'PV_MODULES','Solar PV module: 590 Wp, Mono PERC - Bifacial DCR',15,'no','Tata Power Solar - TC/TP','MEDA-MOD-590-BF'),
  ('pkg_meda_8_85kw_3ph_l2','pkg_meda_8_85kw_3ph',2,'DC_WIRING','AJB, 2 I/P 2 O/P, WITH FUSE, SPD TYPE II',1,'no','TPS Approved Vendors','MEDA-AJB-2I2O'),
  ('pkg_meda_8_85kw_3ph_l3','pkg_meda_8_85kw_3ph',3,'AC_WIRING','ACDB UPTO 10kW 3PH WITH CB, SPD TYPE II KWH,Polycarbanate ENCL',1,'no','TPS Approved Vendors','MEDA-ACDB-3P10K'),
  ('pkg_meda_8_85kw_3ph_l4','pkg_meda_8_85kw_3ph',4,'INVERTER','3P8K- 4G-DC,3PH Grid Tie Inverter',1,'no','Sofar/Solis/Goodwe/Solax/Foxess Equlnt','MEDA-INV-3P-8K'),
  ('pkg_meda_8_85kw_3ph_l5','pkg_meda_8_85kw_3ph',5,'DC_WIRING','MC4 FEMALE CABLE CONNECTOR',8,'no','TPS Approved Vendors','MEDA-MC4-F'),
  ('pkg_meda_8_85kw_3ph_l6','pkg_meda_8_85kw_3ph',6,'DC_WIRING','MC4 MALE CABLE CONNECTOR',8,'no','TPS Approved Vendors','MEDA-MC4-M'),
  ('pkg_meda_8_85kw_3ph_l7','pkg_meda_8_85kw_3ph',7,'EARTHING','Earthing kit 1.5M, copper Bonded , 250Micron_15Kg Compound',3,'no','TPS Approved Vendors','MEDA-EARTH-KIT'),
  ('pkg_meda_8_85kw_3ph_l8','pkg_meda_8_85kw_3ph',8,'LIGHTNING','LIGTHENING ARRESTOR, 2M CONVENTIONAL',2,'no','TPS Approved Vendors','MEDA-LA-2M')
) AS v(id, "packageId", "lineNo", section, description, quantity, unit, "makeScope", sku)
LEFT JOIN "Product" p ON p.sku = v.sku
WHERE EXISTS (SELECT 1 FROM "StandardPackage" s WHERE s.id = v."packageId") ON CONFLICT ("id") DO NOTHING;

INSERT INTO "StandardPackage" ("id","code","name","capacityKwp","supplyPhase","systemType","moduleWp","moduleCount","source","notes","sortOrder") VALUES ('pkg_meda_10_03kw_3ph','MEDA_10_03KW_3PH','10.03 kW 3ph MEDA',10.03,'THREE','GRID_TIED',590,17,'BOM MEDA below 10kW - Items (company document, June 2026)','Supply items and quantities as listed in the company''s MEDA standard BOM. Makes are as written there; specifications are not manufacturer-verified. Not listed in the package: mounting structure, DC and AC cables, cable management and installation services. Add them to the project BOM if they are in scope. MEDA is Maharashtra''s agency: confirm the package against current BESCOM requirements for Bengaluru projects.',9) ON CONFLICT ("code") DO NOTHING;

INSERT INTO "StandardPackageLine" ("id","packageId","lineNo","section","description","quantity","unit","makeScope","productId")
SELECT v.id, v."packageId", v."lineNo", v.section, v.description, v.quantity, v.unit, v."makeScope", p.id FROM (VALUES
  ('pkg_meda_10_03kw_3ph_l1','pkg_meda_10_03kw_3ph',1,'PV_MODULES','Solar PV module: 590 Wp, Mono PERC - Bifacial DCR',17,'no','Tata Power Solar - TC/TP','MEDA-MOD-590-BF'),
  ('pkg_meda_10_03kw_3ph_l2','pkg_meda_10_03kw_3ph',2,'DC_WIRING','AJB, 2 I/P 2 O/P, WITH FUSE, SPD TYPE II',1,'no','TPS Approved Vendors','MEDA-AJB-2I2O'),
  ('pkg_meda_10_03kw_3ph_l3','pkg_meda_10_03kw_3ph',3,'AC_WIRING','ACDB UPTO 10kW 3PH WITH CB, SPD TYPE II KWH,Polycarbanate ENCL',1,'no','TPS Approved Vendors','MEDA-ACDB-3P10K'),
  ('pkg_meda_10_03kw_3ph_l4','pkg_meda_10_03kw_3ph',4,'INVERTER','3P10K- 4G-DC,3PH Grid Tie Inverter',1,'no','Sofar/Solis/Goodwe/Solax/Foxess Equlnt','MEDA-INV-3P-10K'),
  ('pkg_meda_10_03kw_3ph_l5','pkg_meda_10_03kw_3ph',5,'DC_WIRING','MC4 FEMALE CABLE CONNECTOR',8,'no','TPS Approved Vendors','MEDA-MC4-F'),
  ('pkg_meda_10_03kw_3ph_l6','pkg_meda_10_03kw_3ph',6,'DC_WIRING','MC4 MALE CABLE CONNECTOR',8,'no','TPS Approved Vendors','MEDA-MC4-M'),
  ('pkg_meda_10_03kw_3ph_l7','pkg_meda_10_03kw_3ph',7,'DC_WIRING','MC4 T BRANCH CONNECTOR (+VE) 2 IN 1 OUT, 1500VDC',2,'no','TPS Approved Vendors','MEDA-MC4-T-POS'),
  ('pkg_meda_10_03kw_3ph_l8','pkg_meda_10_03kw_3ph',8,'DC_WIRING','MC4 T BRANCH CONNECTOR (-VE) 2 IN 1 OUT, 1500VDC',2,'no','TPS Approved Vendors','MEDA-MC4-T-NEG'),
  ('pkg_meda_10_03kw_3ph_l9','pkg_meda_10_03kw_3ph',9,'EARTHING','Earthing kit 1.5M, copper Bonded , 250Micron_15Kg Compound',3,'no','TPS Approved Vendors','MEDA-EARTH-KIT'),
  ('pkg_meda_10_03kw_3ph_l10','pkg_meda_10_03kw_3ph',10,'LIGHTNING','LIGTHENING ARRESTOR, 2M CONVENTIONAL',2,'no','TPS Approved Vendors','MEDA-LA-2M')
) AS v(id, "packageId", "lineNo", section, description, quantity, unit, "makeScope", sku)
LEFT JOIN "Product" p ON p.sku = v.sku
WHERE EXISTS (SELECT 1 FROM "StandardPackage" s WHERE s.id = v."packageId") ON CONFLICT ("id") DO NOTHING;

UPDATE "StandardPackageLine" l SET "productId" = p.id FROM (VALUES
  ('Solar PV module: 590 Wp, Mono PERC - Bifacial DCR','MEDA-MOD-590-BF'),
  ('AJB, 1 IP 1 OP, FUSE,600V SPD T2 + ACDB 5kW 1 Phase','MEDA-AJB-ACDB-1P5K'),
  ('AJB, 1 I/P 1O/P, WITH FUSE, SPD TYPE II','MEDA-AJB-1I1O'),
  ('AJB, 2 I/P 2 O/P, WITH FUSE, SPD TYPE II','MEDA-AJB-2I2O'),
  ('ACDB UPTO 10kW 3PH WITH CB, SPD TYPE II KWH,Polycarbanate ENCL','MEDA-ACDB-3P10K'),
  ('Grid Connect Solar Inverter (1X2kW,230V AC, 50Hz, MPPT),','MEDA-INV-1P-2K'),
  ('Grid Connect Solar Inverter (1X3kW,230V AC, 50Hz, MPPT),','MEDA-INV-1P-3K'),
  ('Grid Connect Solar Inverter (1X4kW,230V AC, 50Hz, MPPT),','MEDA-INV-1P-4K'),
  ('Grid Connect Solar Inverter (1X5kW,230V AC, 50Hz, MPPT), DC:AC=1.3 max','MEDA-INV-1P-5K'),
  ('3P5K- 4G-DC,3PH Grid Tie Inverter','MEDA-INV-3P-5K'),
  ('3P6K- -DC,3PH Grid Tie Inverter','MEDA-INV-3P-6K'),
  ('3P8K- 4G-DC,3PH Grid Tie Inverter','MEDA-INV-3P-8K'),
  ('3P10K- 4G-DC,3PH Grid Tie Inverter','MEDA-INV-3P-10K'),
  ('MC4 FEMALE CABLE CONNECTOR','MEDA-MC4-F'),
  ('MC4 MALE CABLE CONNECTOR','MEDA-MC4-M'),
  ('MC4 T BRANCH CONNECTOR (+VE) 2 IN 1 OUT, 1500VDC','MEDA-MC4-T-POS'),
  ('MC4 T BRANCH CONNECTOR (-VE) 2 IN 1 OUT, 1500VDC','MEDA-MC4-T-NEG'),
  ('Earthing kit 1.5M, copper Bonded , 250Micron_15Kg Compound','MEDA-EARTH-KIT'),
  ('LIGTHENING ARRESTOR, 2M CONVENTIONAL','MEDA-LA-2M')
) AS v(description, sku) JOIN "Product" p ON p.sku = v.sku
WHERE l."productId" IS NULL AND l."packageId" LIKE 'pkg_meda_%' AND l.description = v.description;
