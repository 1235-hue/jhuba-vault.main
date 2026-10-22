import { AssetCategory, RequestStatus } from '@prisma/client';
import { z } from 'zod';

export const kenyanPhoneNumberSchema = z.string().trim().regex(
  /^\+254[17]\d{8}$/,
  'Enter a valid Kenyan phone number in +254 format.'
);

export const registerSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254).transform(value => value.toLowerCase()),
  password: z.string().min(8).max(128),
  phoneNumber: kenyanPhoneNumberSchema,
  identificationId: z.string().trim().min(1).max(64),
  department: z.string().trim().max(120).optional()
});

export const loginSchema = z.object({
  email: z.string().trim().email().max(254).transform(value => value.toLowerCase()),
  password: z.string().min(1).max(128)
});

export const assetSchema = z.object({
  assetTag: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(120),
  category: z.nativeEnum(AssetCategory),
  description: z.string().trim().min(1).max(500),
  price: z.coerce.number().finite().min(0),
  totalQuantity: z.number().int().min(1),
  availableQty: z.number().int().min(0),
  imageUrl: z.string().url().nullable().optional(),
  specifications: z.record(z.string(), z.string())
});

export const requestSchema = z.object({
  projectName: z.string().trim().min(1).max(120),
  projectAbstract: z.string().trim().min(20).max(5000),
  loanDays: z.number().int().min(1).max(365),
  startDate: z.iso.date(),
  items: z.array(z.object({
    assetId: z.uuid(),
    quantity: z.number().int().min(1)
  })).min(1).max(100),
  teamMembers: z.array(z.object({
    fullName: z.string().trim().min(1).max(120),
    email: z.string().trim().email().max(254).transform(value => value.toLowerCase()),
    phoneNumber: z.string().trim().min(3).max(40),
    studentOrIdNo: z.string().trim().min(1).max(64),
    roleInProject: z.string().trim().min(1).max(120)
  })).max(50)
});

export const rejectSchema = z.object({
  rejectionReason: z.string().trim().min(1).max(1000)
});

export const statusQuery = z.object({
  status: z.nativeEnum(RequestStatus).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10)
});

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
