export const adminRequestQuery = statusQuery.extend({
  search: z.string().trim().max(100).optional(),
  dateFrom: z.iso.date().optional(),
  dateTo: z.iso.date().optional()
}).refine(
  query =>
    !query.dateFrom ||
    !query.dateTo ||
    query.dateFrom <= query.dateTo,
  {
    message: 'dateFrom must be on or before dateTo',
    path: ['dateTo']
  }
);

export const adminSearchQuery = z.object({
  q: z.string().trim().min(2).max(100)
});