export const isRelistedListing = product => product?.relisted_to_id != null;

export function missingRelistColumns(error) {
  return ["42703", "PGRST204"].includes(error?.code)
    && /relisted_(?:from|to)_id/i.test(String(error?.message || ""));
}

export function managementListingRows(rows, includeRelisted = false) {
  return includeRelisted ? rows : rows.filter(row => !isRelistedListing(row));
}
