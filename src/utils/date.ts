/**
 * Computes exact UTC start and end Date objects for a given month and year.
 * @param year e.g. 2026
 * @param month 1-indexed month (1 = January, 12 = December)
 */
export const getMonthDateRangeUTC = (year: number, month: number) => {
  const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  return { startDate, endDate };
};
