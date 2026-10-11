-- Generated with the MEDA package migration (20261011130000_standard_packages). Run by prisma/seed.ts on fresh databases,
-- where the migration ran before categories existed. Safe to run repeatedly.

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


-- Suitability (see migration 20261011170000_package_suitability).
UPDATE "StandardPackage" SET "customerTypes" = ARRAY['RESIDENTIAL']::"CustomerType"[] WHERE "id" LIKE 'pkg_meda_%';
