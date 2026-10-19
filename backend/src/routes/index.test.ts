import { describe, expect, it } from 'vitest';
import { adminRequestQuery, assetSchema, requestSchema } from '../validators/schemas';

describe('request validation', () => {
  it('requires at least one requested item', () => { const result = requestSchema.safeParse({ projectName: 'Test', projectAbstract: 'A valid project abstract', loanDays: 7, startDate: '2026-09-28', items: [], teamMembers: [] }); expect(result.success).toBe(false); });
  it('accepts a valid request shape', () => { const result = requestSchema.safeParse({ projectName: 'Test', projectAbstract: 'A valid project abstract', loanDays: 7, startDate: '2026-09-28', items: [{ assetId: '00000000-0000-4000-8000-000000000001', quantity: 1 }], teamMembers: [] }); expect(result.success).toBe(true); });
  it('rejects invalid asset price and inventory values', () => { const result = assetSchema.safeParse({ assetTag: 'JHUB-001', name: 'Test asset', category: 'FURNITURE', description: 'A test asset', price: -1, totalQuantity: 2, availableQty: 3, specifications: {} }); expect(result.success).toBe(false); });
  it('accepts valid admin request date filters', () => { expect(adminRequestQuery.safeParse({ dateFrom: '2026-04-01', dateTo: '2026-04-30' }).success).toBe(true); });
  it('rejects an inverted admin request date range', () => { expect(adminRequestQuery.safeParse({ dateFrom: '2026-04-30', dateTo: '2026-04-01' }).success).toBe(false); });
});
