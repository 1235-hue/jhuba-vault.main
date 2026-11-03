import { AssetCategory, RequestStatus } from '../core/models';

export interface CategoryMeta {
  label: string;
  /** Shorter label used on chips and compact lists. */
  short: string;
  icon: string;
}

export const CATEGORY_META: Record<AssetCategory, CategoryMeta> = {
  [AssetCategory.IOT_PROTOTYPING]: { label: 'IoT & prototyping', short: 'IoT & prototyping', icon: 'pi-microchip' },
  [AssetCategory.COMPUTING_PERIPHERALS]: { label: 'Computing & peripherals', short: 'Computing', icon: 'pi-desktop' },
  [AssetCategory.NETWORKING_INFRASTRUCTURE]: { label: 'Networking infrastructure', short: 'Networking', icon: 'pi-share-alt' },
  [AssetCategory.AV_PRESENTATION]: { label: 'AV & presentation', short: 'AV & presentation', icon: 'pi-video' },
  [AssetCategory.OFFICE_SUPPLIES]: { label: 'Office supplies', short: 'Office supplies', icon: 'pi-pencil' },
  [AssetCategory.FURNITURE]: { label: 'Furniture', short: 'Furniture', icon: 'pi-home' },
  [AssetCategory.SOFTWARE]: { label: 'Software', short: 'Software', icon: 'pi-code' }
};

export const CATEGORY_ORDER: AssetCategory[] = [
  AssetCategory.IOT_PROTOTYPING,
  AssetCategory.COMPUTING_PERIPHERALS,
  AssetCategory.NETWORKING_INFRASTRUCTURE,
  AssetCategory.AV_PRESENTATION,
  AssetCategory.OFFICE_SUPPLIES,
  AssetCategory.FURNITURE,
  AssetCategory.SOFTWARE
];

export function categoryLabel(category: AssetCategory | string): string {
  return CATEGORY_META[category as AssetCategory]?.label ?? String(category).replaceAll('_', ' ').toLowerCase();
}

export function categoryShort(category: AssetCategory | string): string {
  return CATEGORY_META[category as AssetCategory]?.short ?? categoryLabel(category);
}

export function categoryIcon(category: AssetCategory | string): string {
  return CATEGORY_META[category as AssetCategory]?.icon ?? 'pi-box';
}

export const STATUS_LABEL: Record<RequestStatus, string> = {
  [RequestStatus.PENDING]: 'Pending review',
  [RequestStatus.APPROVED]: 'Approved',
  [RequestStatus.REJECTED]: 'Rejected',
  [RequestStatus.CHECKED_OUT]: 'Checked out',
  [RequestStatus.RETURNED]: 'Returned',
  [RequestStatus.OVERDUE]: 'Overdue'
};

export function statusLabel(status: RequestStatus | string): string {
  return STATUS_LABEL[status as RequestStatus] ?? String(status).replaceAll('_', ' ').toLowerCase();
}

/** A short, human-friendly reference for a request id, used everywhere a request is named. */
export function requestRef(id: string | null | undefined): string {
  return id ? `REQ-${id.slice(-6).toUpperCase()}` : '—';
}

export function initials(name: string | null | undefined, fallback = '?'): string {
  const letters = (name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part.charAt(0).toUpperCase())
    .join('');
  return letters || fallback;
}

export function formatKsh(value: number | string | null | undefined): string {
  const amount = Number(value ?? 0);
  return `KSh ${(Number.isFinite(amount) ? amount : 0).toLocaleString('en-KE', { maximumFractionDigits: 0 })}`;
}

/** Stock tone for availability meters: ok, low or out. */
export function stockTone(available: number, total: number): 'ok' | 'low' | 'out' {
  if (available <= 0) return 'out';
  if (total > 0 && available / total <= 0.25) return 'low';
  return 'ok';
}
