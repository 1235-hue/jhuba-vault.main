import { describe, expect, it } from 'vitest';
import { adminSearchQuery, assetSchema, requestSchema } from '../validators/schemas';

describe('request validation', () => {
  it('requires at least one requested item', () => { const result = requestSchema.safeParse({ projectName: 'Test', projectAbstract: 'A valid project abstract', loanDays: 7, startDate: '2026-09-28', items: [], teamMembers: [] }); expect(result.success).toBe(false); });
  it('accepts a valid request shape', () => { const result = requestSchema.safeParse({ projectName: 'Test', projectAbstract: 'A valid project abstract', loanDays: 7, startDate: '2026-09-28', items: [{ assetId: '00000000-0000-4000-8000-000000000001', quantity: 1 }], teamMembers: [] }); expect(result.success).toBe(true); });
  it('rejects invalid asset price and inventory values', () => { const result = assetSchema.safeParse({ assetTag: 'JHUB-001', name: 'Test asset', category: 'FURNITURE', description: 'A test asset', price: -1, totalQuantity: 2, availableQty: 3, specifications: {} }); expect(result.success).toBe(false); });
});

describe('admin search validation', () => {
  it('requires a trimmed query of at least two characters', () => {
    expect(adminSearchQuery.safeParse({ q: ' a ' }).success).toBe(false);
    expect(adminSearchQuery.safeParse({ q: '  asset  ' })).toMatchObject({
      success: true,
      data: { q: 'asset' }
    });
  });
});
