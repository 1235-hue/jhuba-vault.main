import 'dotenv/config';
import { AssetCategory, Prisma, PrismaClient } from '@prisma/client';
import { readFile } from 'node:fs/promises';

interface SourceRow {
  row: number;
  item: string;
  description: string;
  quantity: string;
  category: string;
}

interface RegisterInput {
  workbook: string;
  sheet: string;
  blankRows: number;
  rows: SourceRow[];
}

interface PreparedRow {
  source: SourceRow;
  assetTag: string;
  name: string;
  category: AssetCategory;
  totalQuantity: number;
  quantityUnit: string;
  reviewReasons: string[];
}

const isApply = process.argv.includes('--apply');
const inputIndex = process.argv.indexOf('--input');
const inputPath = inputIndex >= 0 ? process.argv[inputIndex + 1] : undefined;
if (isApply && process.env.ASSET_REGISTER_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.ASSET_REGISTER_DATABASE_URL;
}
const prisma = new PrismaClient();

function normalized(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

function categoryFromSource(source: string): { category?: AssetCategory; review?: string } {
  const value = normalized(source);
  if (value === 'iot & prototyping') return { category: AssetCategory.IOT_PROTOTYPING };
  if (value === 'computing & peripherals') return { category: AssetCategory.COMPUTING_PERIPHERALS };
  if (value === 'av & presentation') return { category: AssetCategory.AV_PRESENTATION };
  if (value === 'networking & infrastructure') return { category: AssetCategory.NETWORKING_INFRASTRUCTURE };
  if (value === 'office supplies & stationery' || value === 'stationery') {
    return { category: AssetCategory.OFFICE_SUPPLIES };
  }
  if (value === 'stationery office supplies & stationery') {
    return { category: AssetCategory.OFFICE_SUPPLIES, review: 'Category text contains a duplicated/combined label; mapped to Office Supplies.' };
  }
  if (value === 'stationnetworking & infrastructureery') {
    return { category: AssetCategory.NETWORKING_INFRASTRUCTURE, review: 'Category text is malformed; mapped to Networking based on the source text and Switch item.' };
  }
  if (value === 'software') return { category: AssetCategory.SOFTWARE };
  return {};
}

function parseQuantity(source: string): { quantity?: number; unit: string; issue?: string } {
  const raw = source.trim();
  if (!raw) return { unit: '', issue: 'Quantity is blank.' };
  if (/[\r\n]/.test(raw)) {
    return { unit: '', issue: 'Quantity spans multiple lines and cannot be safely reduced to one stock count.' };
  }
  const match = raw.match(/^(\d+)(?:\.0+)?\s*([a-zA-Z]+)?(?:\s+.*)?$/);
  if (!match) return { unit: '', issue: `Quantity format is ambiguous: "${raw}".` };
  const quantity = Number(match[1]);
  if (!Number.isSafeInteger(quantity) || quantity < 1) {
    return { unit: '', issue: `Quantity must be a positive whole number: "${raw}".` };
  }
  return { quantity, unit: match[2] ?? '' };
}

function specificationsRecord(value: Prisma.JsonValue): Record<string, Prisma.JsonValue> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  return value as Record<string, Prisma.JsonValue>;
}

function makePreparedRow(row: SourceRow): { prepared?: PreparedRow; issues: string[] } {
  const issues: string[] = [];
  const name = row.item.trim().replace(/\s+/g, ' ');
  if (!name) issues.push('Item name is blank.');

  const quantity = parseQuantity(row.quantity);
  if (quantity.issue) issues.push(quantity.issue);

  const mappedCategory = categoryFromSource(row.category);
  if (!mappedCategory.category) issues.push(`Category is not supported: "${row.category}".`);
  if (!row.category.trim()) issues.push('Category is blank.');

  if (!row.description.trim()) issues.push('Description is blank in the source register.');
  if (mappedCategory.review) issues.push(mappedCategory.review);

  if (!name || quantity.quantity === undefined || !mappedCategory.category) {
    return { issues };
  }

  return {
    issues,
    prepared: {
      source: row,
      assetTag: `JHUB-REG-2026-${String(row.row).padStart(4, '0')}`,
      name,
      category: mappedCategory.category,
      totalQuantity: quantity.quantity,
      quantityUnit: quantity.unit,
      reviewReasons: issues.filter(issue => !issue.startsWith('Description is blank'))
    }
  };
}

async function main(): Promise<void> {
  if (!inputPath) throw new Error('Usage: tsx prisma/import-asset-register.ts --input <json> [--dry-run|--apply]');
  if (isApply && process.env.ASSET_REGISTER_TARGET !== 'development') {
    throw new Error('Import writes are disabled unless ASSET_REGISTER_TARGET=development.');
  }
  if (isApply && process.env.ASSET_REGISTER_CONFIRM !== 'IMPORT_TO_NON_PRODUCTION') {
    throw new Error('Import writes require ASSET_REGISTER_CONFIRM=IMPORT_TO_NON_PRODUCTION.');
  }
  if (isApply && !process.env.ASSET_REGISTER_DATABASE_URL) {
    throw new Error('Import writes require ASSET_REGISTER_DATABASE_URL for a separate development/staging database.');
  }

  const input = JSON.parse(await readFile(inputPath, 'utf8')) as RegisterInput;
  if (!Array.isArray(input.rows) || !Number.isInteger(input.blankRows)) {
    throw new Error('Prepared workbook data is malformed.');
  }

  const records = await prisma.asset.findMany({
    select: { id: true, assetTag: true, name: true, specifications: true }
  });
  const byTag = new Map(records.map(record => [record.assetTag, record]));
  const allPrepared: PreparedRow[] = [];
  const manualReview: Array<{ row: number; item: string; reason: string }> = [];
  const qualityReview: Array<{ row: number; item: string; reason: string }> = [];
  const normalizationReview: Array<{ row: number; item: string; reason: string }> = [];
  let missingDescriptions = 0;
  let normalizationReviewRows = 0;

  for (const source of input.rows) {
    const result = makePreparedRow(source);
    for (const issue of result.issues) {
      if (issue.startsWith('Description is blank')) {
        missingDescriptions++;
        qualityReview.push({ row: source.row, item: source.item, reason: issue });
      } else if (result.prepared?.reviewReasons.includes(issue)) {
        continue;
      } else {
        manualReview.push({ row: source.row, item: source.item, reason: issue });
      }
    }
    if (result.prepared) {
      allPrepared.push(result.prepared);
      if (result.prepared.reviewReasons.length) {
        normalizationReviewRows++;
        normalizationReview.push({
          row: source.row,
          item: result.prepared.name,
          reason: result.prepared.reviewReasons.join(' ')
        });
      }
    }
  }

  const readyToCreate: PreparedRow[] = [];
  let alreadyImported = 0;
  for (const row of allPrepared) {
    const tagged = byTag.get(row.assetTag);
    if (tagged) {
      const metadata = specificationsRecord(tagged.specifications);
      if (
        metadata.officialRegisterSource === input.workbook &&
        metadata.officialRegisterRow === String(row.source.row)
      ) {
        alreadyImported++;
      } else {
        manualReview.push({
          row: row.source.row,
          item: row.name,
          reason: `Generated asset tag ${row.assetTag} already belongs to a different record.`
        });
      }
      continue;
    }

    const sourceName = normalized(row.source.item);
    const candidates = records.filter(record => {
      const candidateName = normalized(record.name);
      return candidateName.length >= 8 &&
        (sourceName === candidateName ||
          sourceName.startsWith(`${candidateName} `) ||
          candidateName.startsWith(`${sourceName} `));
    });
    if (candidates.length) {
      manualReview.push({
        row: row.source.row,
        item: row.name,
        reason: `Possible existing match; review before importing: ${candidates.map(candidate => `${candidate.name} (${candidate.assetTag})`).join(', ')}.`
      });
      continue;
    }
    readyToCreate.push(row);
  }

  const unitCounts = new Map<string, number>();
  for (const row of readyToCreate) {
    if (row.quantityUnit) unitCounts.set(row.quantityUnit, (unitCounts.get(row.quantityUnit) ?? 0) + 1);
  }

  let created = 0;
  if (isApply && readyToCreate.length) {
    created = await prisma.$transaction(async transaction => {
      let count = 0;
      for (const row of readyToCreate) {
        const reviewNotes = row.reviewReasons.join(' ');
        const specifications: Record<string, string> = {
          officialRegisterSource: input.workbook,
          officialRegisterSheet: input.sheet,
          officialRegisterRow: String(row.source.row),
          officialRegisterItem: row.source.item,
          officialRegisterDescription: row.source.description,
          officialRegisterQuantity: row.source.quantity,
          officialRegisterQuantityUnit: row.quantityUnit,
          officialRegisterCategory: row.source.category
        };
        if (reviewNotes) specifications.officialRegisterReview = reviewNotes;

        const asset = await transaction.asset.create({
          data: {
            assetTag: row.assetTag,
            name: row.name,
            category: row.category,
            description: row.source.description.trim(),
            totalQuantity: row.totalQuantity,
            availableQty: row.totalQuantity,
            imageUrl: null,
            price: 0,
            specifications
          }
        });
        await transaction.auditLog.create({
          data: {
            action: 'ASSET_REGISTER_IMPORTED',
            entityType: 'Asset',
            entityId: asset.id,
            metadata: {
              assetTag: row.assetTag,
              source: input.workbook,
              sourceRow: row.source.row
            }
          }
        });
        count++;
      }
      return count;
    });
  }

  const report = {
    workbook: input.workbook,
    worksheet: input.sheet,
    totalNonblankSourceRows: input.rows.length,
    blankRowsIgnored: input.blankRows,
    validRowsPrepared: allPrepared.length,
    rowsReadyToImport: readyToCreate.length,
    rowsHeldForManualReview: manualReview.length,
    rowsWithMissingItem: manualReview.filter(item => item.reason === 'Item name is blank.').length,
    rowsWithMissingQuantity: manualReview.filter(item => item.reason === 'Quantity is blank.').length,
    rowsWithAmbiguousQuantity: manualReview.filter(item => item.reason.startsWith('Quantity spans') || item.reason.startsWith('Quantity format')).length,
    rowsWithBlankDescription: missingDescriptions,
    descriptionQualityReview: qualityReview,
    unitBearingQuantities: Object.fromEntries(unitCounts),
    rowsWithCategoryNormalizationReview: normalizationReviewRows,
    categoryNormalizationReview: normalizationReview,
    existingRecordsMatchedByImportIdentity: alreadyImported,
    possibleExistingMatchesHeld: manualReview.filter(item => item.reason.startsWith('Possible existing match')).length,
    newRecordsCreated: created,
    existingRecordsUpdated: 0,
    dryRun: !isApply,
    requiresSoftwareMigration: allPrepared.some(row => row.category === AssetCategory.SOFTWARE),
    manualReview
  };
  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch(error => {
    console.error('Asset register import failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
