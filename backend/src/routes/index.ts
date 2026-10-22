import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import multer from 'multer';
import { Prisma, RequestStatus, Role } from '@prisma/client';
import { prisma } from '../config/prisma';
import { HttpError } from '../middleware/errors';
import { requireAuth, requireRole } from '../middleware/auth';
import { adminRequestQuery, adminSearchQuery, assetSchema, kenyanPhoneNumberSchema, loginSchema, registerSchema, rejectSchema, requestSchema, statusQuery } from '../validators/schemas';
import { signToken } from '../utils/jwt';
import { audit } from '../services/audit.service';
import { sendApprovalEmail } from '../services/mail.service';
import { markOverdueRequests } from '../services/overdue.service';
import { deleteImage, uploadImage } from '../services/media.service';
import { isSupportedImageFile } from '../services/image-validation';

const router = Router();
const routeId = (req: Request): string => { const value = req.params.id; return Array.isArray(value) ? value[0] : value; };
const admin = [requireAuth, requireRole(Role.ADMIN)];
const innovator = [requireAuth, requireRole(Role.INNOVATOR)];
const publicUser = (user: { passwordHash: string } & Record<string, unknown>) => { const { passwordHash: _passwordHash, ...safe } = user; return safe; };
const publicAsset = <T extends { imagePublicId?: string | null }>(asset: T): Omit<T, 'imagePublicId'> => { const { imagePublicId: _imagePublicId, ...safe } = asset; return safe; };
const includeRequest = { innovator: { select: { id: true, fullName: true, email: true, phoneNumber: true, identificationId: true, department: true, role: true } }, teamMembers: true, requestItems: { include: { asset: true } } } as const satisfies Prisma.AssetRequestInclude;

router.get('/health', async (_req, res) => { await prisma.$queryRaw`SELECT 1`; res.json({ success: true, data: { status: 'ok', service: 'jhub-africa-vault-api' } }); });

router.post('/auth/register', async (req, res) => { const input = registerSchema.parse(req.body); const { password: _password, ...profile } = input; const passwordHash = await bcrypt.hash(input.password, 12); try { const user = await prisma.user.create({ data: { ...profile, passwordHash }, select: { id: true, fullName: true, email: true, phoneNumber: true, identificationId: true, department: true, bio: true, githubUrl: true, avatarUrl: true, role: true, createdAt: true, updatedAt: true } }); res.status(201).json({ success: true, data: { user, token: signToken(user.id, user.role) } }); } catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new HttpError(409, 'DUPLICATE_USER', 'Email or identification number already exists'); throw error; } });
router.post('/auth/login', async (req, res) => { const input = loginSchema.parse(req.body); const user = await prisma.user.findUnique({ where: { email: input.email } }); if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) throw new HttpError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect'); res.json({ success: true, data: { user: publicUser(user), token: signToken(user.id, user.role) } }); });
router.get('/auth/me', requireAuth, async (req, res) => { const user = await prisma.user.findUnique({ where: { id: req.auth!.userId } }); if (!user) throw new HttpError(404, 'USER_NOT_FOUND', 'User not found'); res.json({ success: true, data: publicUser(user) }); });

router.get('/users/me', requireAuth, async (req, res) => { const user = await prisma.user.findUnique({ where: { id: req.auth!.userId } }); if (!user) throw new HttpError(404, 'USER_NOT_FOUND', 'User not found'); res.json({ success: true, data: publicUser(user) }); });
router.patch('/users/me', requireAuth, async (req, res) => { const body = req.body as Record<string, unknown>; const allowed = ['fullName', 'phoneNumber', 'identificationId', 'department', 'bio', 'githubUrl', 'avatarUrl']; const data = Object.fromEntries(Object.entries(body).filter(([key]) => allowed.includes(key))); if (body.phoneNumber !== undefined) data.phoneNumber = kenyanPhoneNumberSchema.parse(body.phoneNumber); try { const user = await prisma.user.update({ where: { id: req.auth!.userId }, data }); res.json({ success: true, data: publicUser(user) }); } catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new HttpError(409, 'DUPLICATE_IDENTIFICATION', 'Identification number already exists'); throw error; } });

router.get('/assets', async (req, res) => { const search = typeof req.query.search === 'string' ? req.query.search : undefined; const category = typeof req.query.category === 'string' ? req.query.category : undefined; const availability = typeof req.query.availability === 'string' ? req.query.availability : undefined; const assets = await prisma.asset.findMany({ where: { ...(category ? { category: category as never } : {}), ...(availability === 'IN_STOCK' ? { availableQty: { gt: 0 } } : availability === 'CHECKED_OUT' ? { availableQty: 0 } : {}), ...(search ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { assetTag: { contains: search, mode: 'insensitive' } }, { description: { contains: search, mode: 'insensitive' } }] } : {}) }, orderBy: { name: 'asc' } }); res.json({ success: true, data: assets.map(asset => publicAsset(asset)) }); });
router.get('/assets/:id', async (req, res) => { const asset = await prisma.asset.findUnique({ where: { id: req.params.id } }); if (!asset) throw new HttpError(404, 'ASSET_NOT_FOUND', 'Asset not found'); res.json({ success: true, data: publicAsset(asset) }); });
router.post('/assets', ...admin, async (req, res) => { const input = assetSchema.parse(req.body); const asset = await prisma.asset.create({ data: input }); await audit(prisma, req.auth!.userId, 'ASSET_CREATED', 'Asset', asset.id, { assetTag: asset.assetTag }); res.status(201).json({ success: true, data: asset }); });
router.patch('/assets/:id', ...admin, async (req, res) => { const id = routeId(req); const input = assetSchema.partial().parse(req.body); const current = await prisma.asset.findUnique({ where: { id } }); if (!current) throw new HttpError(404, 'ASSET_NOT_FOUND', 'Asset not found'); if (input.availableQty !== undefined && input.availableQty > (input.totalQuantity ?? current.totalQuantity)) throw new HttpError(422, 'INVALID_INVENTORY', 'Available quantity cannot exceed total quantity'); const asset = await prisma.asset.update({ where: { id }, data: input }); await audit(prisma, req.auth!.userId, 'ASSET_UPDATED', 'Asset', asset.id, input as Prisma.InputJsonValue); res.json({ success: true, data: asset }); });
router.delete('/assets/:id', ...admin, async (req, res) => { const count = await prisma.requestItem.count({ where: { assetId: req.params.id } }); if (count) throw new HttpError(409, 'ASSET_HAS_HISTORY', 'Asset cannot be deleted because it has request history'); await prisma.asset.delete({ where: { id: req.params.id } }); await audit(prisma, req.auth!.userId, 'ASSET_DELETED', 'Asset', req.params.id); res.status(204).send(); });

router.post('/requests', ...innovator, async (req, res) => { const input = requestSchema.parse(req.body); const assetIds = input.items.map(item => item.assetId); if (new Set(assetIds).size !== assetIds.length) throw new HttpError(422, 'DUPLICATE_ASSET', 'Each asset may only appear once in a request'); const expectedReturn = new Date(input.startDate); expectedReturn.setDate(expectedReturn.getDate() + input.loanDays); const created = await prisma.$transaction(async tx => { const assets = await tx.asset.findMany({ where: { id: { in: assetIds } } }); if (assets.length !== input.items.length) throw new HttpError(404, 'ASSET_NOT_FOUND', 'One or more assets were not found'); for (const item of input.items) { const asset = assets.find(candidate => candidate.id === item.assetId)!; if (item.quantity > asset.availableQty) throw new HttpError(409, 'INSUFFICIENT_INVENTORY', `Insufficient inventory for ${asset.name}`); } return tx.assetRequest.create({ data: { projectName: input.projectName, projectAbstract: input.projectAbstract, loanDays: input.loanDays, startDate: input.startDate, expectedReturn, innovatorId: req.auth!.userId, teamMembers: { create: input.teamMembers }, requestItems: { create: input.items } }, include: includeRequest }); }); res.status(201).json({ success: true, data: created }); });
router.get('/requests', ...innovator, async (req, res) => { const query = statusQuery.parse(req.query); const where = { innovatorId: req.auth!.userId, ...(query.status ? { status: query.status } : {}) }; const [items, total] = await prisma.$transaction([prisma.assetRequest.findMany({ where, include: { requestItems: { include: { asset: true } }, teamMembers: true }, orderBy: { createdAt: 'desc' }, skip: (query.page - 1) * query.limit, take: query.limit }), prisma.assetRequest.count({ where })]); res.json({ success: true, data: { items, page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } }); });
router.get('/requests/:id', requireAuth, async (req, res) => { const request = await prisma.assetRequest.findUnique({ where: { id: req.params.id }, include: includeRequest }); if (!request || (req.auth!.role !== Role.ADMIN && request.innovatorId !== req.auth!.userId)) throw new HttpError(404, 'REQUEST_NOT_FOUND', 'Request not found'); res.json({ success: true, data: request }); });

router.get('/admin/requests', ...admin, async (req, res) => {
  const query = adminRequestQuery.parse(req.query);
  await markOverdueRequests();
  const search = query.search;
  const requestIdSearch = search?.replace(/^REQ[-\s]*/i, '');
  const searchConditions: Prisma.AssetRequestWhereInput[] = search ? [
    { projectName: { contains: search, mode: 'insensitive' } },
    { projectAbstract: { contains: search, mode: 'insensitive' } },
    { innovator: { fullName: { contains: search, mode: 'insensitive' } } },
    { innovator: { identificationId: { contains: search, mode: 'insensitive' } } },
    { id: { contains: search, mode: 'insensitive' } },
    ...(requestIdSearch && requestIdSearch !== search ? [{ id: { endsWith: requestIdSearch, mode: 'insensitive' as const } }] : [])
  ] : [];
  const dateFrom = query.dateFrom ? new Date(`${query.dateFrom}T00:00:00.000Z`) : undefined;
  const dateToExclusive = query.dateTo ? new Date(`${query.dateTo}T00:00:00.000Z`) : undefined;
  dateToExclusive?.setUTCDate(dateToExclusive.getUTCDate() + 1);
  const where: Prisma.AssetRequestWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(dateFrom || dateToExclusive ? {
      createdAt: {
        ...(dateFrom ? { gte: dateFrom } : {}),
        ...(dateToExclusive ? { lt: dateToExclusive } : {})
      }
    } : {}),
    ...(search ? { OR: searchConditions } : {})
  };
  const [items, total, pending, approved, rejected, checkedOut, returned, overdue] = await prisma.$transaction([
    prisma.assetRequest.findMany({
      where,
      include: includeRequest,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit
    }),
    prisma.assetRequest.count({ where }),
    prisma.assetRequest.count({ where: { status: RequestStatus.PENDING } }),
    prisma.assetRequest.count({ where: { status: RequestStatus.APPROVED } }),
    prisma.assetRequest.count({ where: { status: RequestStatus.REJECTED } }),
    prisma.assetRequest.count({ where: { status: RequestStatus.CHECKED_OUT } }),
    prisma.assetRequest.count({ where: { status: RequestStatus.RETURNED } }),
    prisma.assetRequest.count({ where: { status: RequestStatus.OVERDUE } })
  ]);
  const statusCounts: Record<RequestStatus, number> = {
    [RequestStatus.PENDING]: pending,
    [RequestStatus.APPROVED]: approved,
    [RequestStatus.REJECTED]: rejected,
    [RequestStatus.CHECKED_OUT]: checkedOut,
    [RequestStatus.RETURNED]: returned,
    [RequestStatus.OVERDUE]: overdue
  };
  res.json({
    success: true,
    data: {
      items,
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
      statusCounts: { ...statusCounts, total: Object.values(statusCounts).reduce((sum, count) => sum + count, 0) }
    }
  });
});
router.patch('/admin/requests/:id/approve', ...admin, async (req, res) => { const approved = await prisma.$transaction(async tx => { const request = await tx.assetRequest.findUnique({ where: { id: req.params.id }, include: includeRequest }); if (!request) throw new HttpError(404, 'REQUEST_NOT_FOUND', 'Request not found'); if (request.status !== RequestStatus.PENDING) throw new HttpError(409, 'INVALID_STATUS', 'Only pending requests can be approved'); for (const item of request.requestItems) { const updated = await tx.asset.updateMany({ where: { id: item.assetId, availableQty: { gte: item.quantity } }, data: { availableQty: { decrement: item.quantity } } }); if (updated.count !== 1) throw new HttpError(409, 'INSUFFICIENT_INVENTORY', `Insufficient inventory for asset ${item.assetId}`); } const result = await tx.assetRequest.update({ where: { id: request.id }, data: { status: RequestStatus.APPROVED }, include: includeRequest }); await audit(tx, req.auth!.userId, 'REQUEST_APPROVED', 'AssetRequest', result.id); return result; }); const user = approved.innovator; void sendApprovalEmail(user.email, approved.projectName, approved.id).catch(error => console.error('Approval email failed', error)); res.json({ success: true, data: approved }); });
router.patch('/admin/requests/:id/reject', ...admin, async (req, res) => { const input = rejectSchema.parse(req.body); const result = await prisma.$transaction(async tx => { const request = await tx.assetRequest.findUnique({ where: { id: req.params.id } }); if (!request) throw new HttpError(404, 'REQUEST_NOT_FOUND', 'Request not found'); if (request.status !== RequestStatus.PENDING) throw new HttpError(409, 'INVALID_STATUS', 'Only pending requests can be rejected'); const updated = await tx.assetRequest.update({ where: { id: request.id }, data: { status: RequestStatus.REJECTED, rejectionReason: input.rejectionReason }, include: includeRequest }); await audit(tx, req.auth!.userId, 'REQUEST_REJECTED', 'AssetRequest', updated.id, { rejectionReason: input.rejectionReason }); return updated; }); res.json({ success: true, data: result }); });
router.patch('/admin/requests/:id/checkout', ...admin, async (req, res) => { const result = await prisma.assetRequest.updateMany({ where: { id: req.params.id, status: RequestStatus.APPROVED }, data: { status: RequestStatus.CHECKED_OUT } }); if (!result.count) throw new HttpError(409, 'INVALID_STATUS', 'Only approved requests can be checked out'); const request = await prisma.assetRequest.findUnique({ where: { id: req.params.id }, include: includeRequest }); await audit(prisma, req.auth!.userId, 'REQUEST_CHECKED_OUT', 'AssetRequest', req.params.id); res.json({ success: true, data: request }); });
router.patch('/admin/requests/:id/return', ...admin, async (req, res) => { const result = await prisma.$transaction(async tx => { const request = await tx.assetRequest.findUnique({ where: { id: req.params.id }, include: { requestItems: true } }); if (!request) throw new HttpError(404, 'REQUEST_NOT_FOUND', 'Request not found'); if (request.status !== RequestStatus.CHECKED_OUT) throw new HttpError(409, 'INVALID_STATUS', 'Only checked-out requests can be returned'); for (const item of request.requestItems) { const asset = await tx.asset.findUnique({ where: { id: item.assetId } }); if (!asset) throw new HttpError(404, 'ASSET_NOT_FOUND', 'Requested asset no longer exists'); await tx.asset.update({ where: { id: item.assetId }, data: { availableQty: Math.min(asset.availableQty + item.quantity, asset.totalQuantity) } }); } return tx.assetRequest.update({ where: { id: request.id }, data: { status: RequestStatus.RETURNED, actualReturn: new Date() }, include: includeRequest }); }); await audit(prisma, req.auth!.userId, 'REQUEST_RETURNED', 'AssetRequest', result.id); res.json({ success: true, data: result }); });

router.get('/admin/dashboard', ...admin, async (_req, res) => {
  await markOverdueRequests();
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setHours(0, 0, 0, 0);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  const [
    assets,
    inventory,
    checkedOutInventory,
    pending,
    approved,
    checkedOut,
    returned,
    overdue,
    users,
    categories,
    requestActivity,
    recentRequests,
    recentActivity
  ] = await prisma.$transaction([
    prisma.asset.count(),
    prisma.asset.aggregate({ _sum: { availableQty: true } }),
    prisma.requestItem.aggregate({
      where: { request: { status: { in: [RequestStatus.CHECKED_OUT, RequestStatus.OVERDUE] } } },
      _sum: { quantity: true }
    }),
    prisma.assetRequest.count({ where: { status: RequestStatus.PENDING } }),
    prisma.assetRequest.count({ where: { status: RequestStatus.APPROVED } }),
    prisma.assetRequest.count({ where: { status: RequestStatus.CHECKED_OUT } }),
    prisma.assetRequest.count({ where: { status: RequestStatus.RETURNED } }),
    prisma.assetRequest.count({ where: { status: RequestStatus.OVERDUE } }),
    prisma.user.count(),
    prisma.asset.groupBy({
      by: ['category'],
      _sum: { totalQuantity: true },
      orderBy: { category: 'asc' }
    }),
    prisma.$queryRaw<Array<{ month: Date; status: RequestStatus; count: bigint }>>`
      SELECT date_trunc('month', "createdAt") AS month, status, COUNT(*) AS count
      FROM "AssetRequest"
      WHERE "createdAt" >= ${sixMonthsAgo}
      GROUP BY month, status
      ORDER BY month ASC
    `,
    prisma.assetRequest.findMany({
      include: includeRequest,
      orderBy: { createdAt: 'desc' },
      take: 5
    }),
    prisma.auditLog.findMany({
      include: { actor: { select: { id: true, fullName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 8
    })
  ]);
  const activityByMonth = new Map<string, { pending: number; approved: number; rejected: number }>();
  for (const entry of requestActivity) {
    const month = entry.month.toISOString().slice(0, 7);
    const values = activityByMonth.get(month) ?? { pending: 0, approved: 0, rejected: 0 };
    if (entry.status === RequestStatus.PENDING) values.pending = Number(entry.count);
    if (entry.status === RequestStatus.APPROVED) values.approved = Number(entry.count);
    if (entry.status === RequestStatus.REJECTED) values.rejected = Number(entry.count);
    activityByMonth.set(month, values);
  }
  res.json({
    success: true,
    data: {
      totalAssets: assets,
      availableInventory: inventory._sum.availableQty ?? 0,
      checkedOutInventory: checkedOutInventory._sum.quantity ?? 0,
      pendingRequests: pending,
      approvedRequests: approved,
      checkedOutRequests: checkedOut,
      returnedRequests: returned,
      overdueRequests: overdue,
      users,
      categoryDistribution: categories.map(item => ({ category: item.category, quantity: item._sum?.totalQuantity ?? 0 })),
      requestActivity: Array.from(activityByMonth, ([month, counts]) => ({ month, ...counts })),
      recentRequests,
      recentActivity
    }
  });
});
router.get('/admin/search', ...admin, async (req, res) => {
  const { q } = adminSearchQuery.parse(req.query);
  const contains = { contains: q, mode: 'insensitive' as const };
  const [assets, requests, users] = await prisma.$transaction([
    prisma.asset.findMany({
      where: { OR: [{ name: contains }, { assetTag: contains }, { description: contains }] },
      select: { id: true, name: true, assetTag: true },
      orderBy: { name: 'asc' },
      take: 5
    }),
    prisma.assetRequest.findMany({
      where: {
        OR: [
          { projectName: contains },
          { projectAbstract: contains },
          { innovator: { fullName: contains } }
        ]
      },
      select: {
        id: true,
        projectName: true,
        status: true,
        innovator: { select: { fullName: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    }),
    prisma.user.findMany({
      where: { OR: [{ fullName: contains }, { email: contains }] },
      select: { id: true, fullName: true, email: true, role: true },
      orderBy: { fullName: 'asc' },
      take: 5
    })
  ]);
  res.json({
    success: true,
    data: [
      ...assets.map(asset => ({
        type: 'asset',
        id: asset.id,
        label: asset.name,
        detail: asset.assetTag,
        href: `/assets/${asset.id}`
      })),
      ...requests.map(request => ({
        type: 'request',
        id: request.id,
        label: request.projectName,
        detail: `${request.innovator.fullName} · ${request.status}`,
        href: `/app/requests/${request.id}`
      })),
      ...users.map(user => ({
        type: 'user',
        id: user.id,
        label: user.fullName,
        detail: `${user.email} · ${user.role}`,
        href: '/admin/users'
      }))
    ]
  });
});
router.get('/admin/inventory', ...admin, async (_req, res) => { const assets = await prisma.asset.findMany({ orderBy: { assetTag: 'asc' } }); res.json({ success: true, data: assets }); });
router.get('/admin/users', ...admin, async (_req, res) => { const users = await prisma.user.findMany({ select: { id: true, fullName: true, email: true, phoneNumber: true, identificationId: true, department: true, role: true, createdAt: true, updatedAt: true }, orderBy: { createdAt: 'desc' } }); res.json({ success: true, data: users }); });
router.patch('/admin/users/:id', ...admin, async (req, res) => { const data = { fullName: typeof req.body.fullName === 'string' ? req.body.fullName.trim() : undefined, phoneNumber: typeof req.body.phoneNumber === 'string' ? kenyanPhoneNumberSchema.parse(req.body.phoneNumber) : undefined, department: typeof req.body.department === 'string' ? req.body.department.trim() : undefined, role: Object.values(Role).includes(req.body.role) ? req.body.role as Role : undefined }; const user = await prisma.user.update({ where: { id: req.params.id }, data, select: { id: true, fullName: true, email: true, phoneNumber: true, identificationId: true, department: true, role: true, createdAt: true, updatedAt: true } }); await audit(prisma, req.auth!.userId, 'USER_UPDATED', 'User', user.id, { fields: Object.keys(data).filter(key => data[key as keyof typeof data] !== undefined) }); res.json({ success: true, data: user }); });
router.get('/admin/audit', ...admin, async (_req, res) => { const logs = await prisma.auditLog.findMany({ include: { actor: { select: { id: true, fullName: true, email: true } } }, orderBy: { createdAt: 'desc' }, take: 100 }); res.json({ success: true, data: logs }); });

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (_req, file, cb) => cb(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) });
const validateAssetImage = (req: Request, _res: Response, next: NextFunction): void => {
  if (!req.file || !isSupportedImageFile(req.file)) {
    next(new HttpError(400, 'INVALID_IMAGE_TYPE', 'Upload a valid JPEG, PNG, or WebP image smaller than 5MB'));
    return;
  }
  next();
};
router.post('/uploads/profile', requireAuth, upload.single('file'), async (req, res) => { if (!req.file) throw new HttpError(400, 'IMAGE_REQUIRED', 'An image file is required'); const uploaded = await uploadImage(req.file.buffer, 'jhub-africa-vault/profiles'); const user = await prisma.user.update({ where: { id: req.auth!.userId }, data: { avatarUrl: uploaded.secureUrl } }); res.json({ success: true, data: { url: uploaded.secureUrl, user: publicUser(user) } }); });
router.post('/uploads/assets/:id/image', ...admin, upload.single('file'), validateAssetImage, async (req, res) => { const current = await prisma.asset.findUnique({ where: { id: req.params.id } }); if (!current) throw new HttpError(404, 'ASSET_NOT_FOUND', 'Asset not found'); const uploaded = await uploadImage(req.file!.buffer, `jhub-africa-vault/assets/${current.id}`); const asset = await prisma.asset.update({ where: { id: current.id }, data: { imageUrl: uploaded.secureUrl, imagePublicId: uploaded.publicId } }); await audit(prisma, req.auth!.userId, current.imagePublicId ? 'ASSET_IMAGE_REPLACED' : 'ASSET_IMAGE_UPLOADED', 'Asset', asset.id, { publicId: uploaded.publicId }); if (current.imagePublicId) void deleteImage(current.imagePublicId).catch(error => console.error('Old asset image cleanup failed', error)); res.json({ success: true, data: publicAsset(asset) }); });
router.delete('/uploads/assets/:id/image', ...admin, async (req, res) => { const asset = await prisma.asset.findUnique({ where: { id: req.params.id } }); if (!asset) throw new HttpError(404, 'ASSET_NOT_FOUND', 'Asset not found'); if (asset.imagePublicId) await deleteImage(asset.imagePublicId); const updated = await prisma.asset.update({ where: { id: asset.id }, data: { imageUrl: null, imagePublicId: null } }); await audit(prisma, req.auth!.userId, 'ASSET_IMAGE_REMOVED', 'Asset', asset.id); res.json({ success: true, data: publicAsset(updated) }); });
router.patch('/admin/requests/:id/items/:itemId', ...admin, async (req, res) => { const quantity = Number(req.body.quantity); if (!Number.isInteger(quantity) || quantity < 1) throw new HttpError(422, 'INVALID_QUANTITY', 'Quantity must be a positive integer'); const updated = await prisma.$transaction(async tx => { const request = await tx.assetRequest.findUnique({ where: { id: req.params.id } }); if (!request || request.status !== RequestStatus.PENDING) throw new HttpError(409, 'INVALID_STATUS', 'Only pending requests can be modified'); const item = await tx.requestItem.findFirst({ where: { id: req.params.itemId, requestId: request.id } }); if (!item) throw new HttpError(404, 'REQUEST_ITEM_NOT_FOUND', 'Request item not found'); const asset = await tx.asset.findUnique({ where: { id: item.assetId } }); if (!asset || quantity > asset.availableQty) throw new HttpError(409, 'INSUFFICIENT_INVENTORY', 'Requested quantity is unavailable'); const result = await tx.requestItem.update({ where: { id: item.id }, data: { quantity }, include: { asset: true } }); await audit(tx, req.auth!.userId, 'REQUEST_QUANTITY_MODIFIED', 'RequestItem', item.id, { quantity }); return result; }); res.json({ success: true, data: updated }); });

export default router;
