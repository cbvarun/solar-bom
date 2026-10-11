/** BOM sections a standard package line can belong to. Shared by the admin page and its server action. */
export const PACKAGE_SECTIONS = ["PV_MODULES", "INVERTER", "DC_WIRING", "AC_WIRING", "EARTHING", "LIGHTNING", "MOUNTING", "METERING", "MONITORING", "CABLE_MGMT", "SAFETY", "SERVICES"] as const;
/** Blank rows offered for adding lines on the edit form. */
export const PACKAGE_EXTRA_ROWS = 3;
