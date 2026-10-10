/**
 * Company details shown across the site and on quotations. Values come from
 * environment variables so they are not hard-coded; placeholders make it
 * obvious when they have not been configured.
 */
export const company = {
  name: process.env.NEXT_PUBLIC_COMPANY_NAME ?? "Rooftop Solar Engineering Co. (configure name)",
  shortName: process.env.NEXT_PUBLIC_COMPANY_SHORT ?? "RSE",
  phone: process.env.NEXT_PUBLIC_COMPANY_PHONE ?? "Phone not configured",
  email: process.env.NEXT_PUBLIC_COMPANY_EMAIL ?? "sales@example.com",
  address: process.env.NEXT_PUBLIC_COMPANY_ADDRESS ?? "Office address not configured, Bengaluru, Karnataka",
  gstin: process.env.NEXT_PUBLIC_COMPANY_GSTIN ?? "GSTIN not configured",
  serviceAreas: [
    "Bengaluru Urban district",
    "Bengaluru Rural district",
    "Whitefield, Mahadevapura and Outer Ring Road",
    "Electronic City, Bommasandra and Hosur Road",
    "Yelahanka, Hebbal and North Bengaluru",
    "Peenya, Rajajinagar and West Bengaluru",
    "Jayanagar, JP Nagar and South Bengaluru",
  ],
};
