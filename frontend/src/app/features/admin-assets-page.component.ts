import { HttpErrorResponse, HttpEventType, HttpResponse } from '@angular/common/http';
import { KeyValuePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AssetImportPreview, AssetImportResult, AssetImportRow, AssetService } from '../core/api.service';
import { Asset, AssetCategory } from '../core/models';
import { ConfirmService } from '../core/confirm.service';
import { MediaService } from '../core/media.service';
import { ToastService } from '../core/toast.service';
import { AssetImageComponent } from '../shared/asset-image.component';
import { EmptyStateComponent } from '../shared/empty-state.component';
import { ModalComponent } from '../shared/modal.component';
import { PageHeaderComponent } from '../shared/page-header.component';
import { CATEGORY_META, CATEGORY_ORDER, categoryShort } from '../shared/format';

interface AssetDraft {
  assetTag: string;
  name: string;
  category: AssetCategory;
  description: string;
  price: number;
  totalQuantity: number;
  availableQty: number;
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** Catalogue management: asset records, photos and availability. */
@Component({
  selector: 'jhub-admin-assets-page',
  standalone: true,
  imports: [FormsModule, KeyValuePipe, AssetImageComponent, EmptyStateComponent, ModalComponent, PageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-assets-page.component.html',
  styleUrl: './admin-assets-page.component.css'
})
export class AdminAssetsPageComponent {
  private readonly assetService = inject(AssetService);
  private readonly media = inject(MediaService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);

  protected readonly categories = CATEGORY_ORDER;
  protected readonly meta = CATEGORY_META;
  protected readonly categoryShort = categoryShort;
  protected readonly assets = signal<Asset[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal(false);
  protected readonly search = signal('');
  protected readonly dialogOpen = signal(false);
  protected readonly editingId = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly formError = signal('');
  protected readonly uploadingId = signal<string | null>(null);
  protected readonly progress = signal(0);
  protected readonly busyId = signal<string | null>(null);
  protected readonly importOpen = signal(false);
  protected readonly importBusy = signal(false);
  protected readonly importProgress = signal(0);
  protected readonly importError = signal('');
  protected readonly importFile = signal<File | null>(null);
  protected readonly importPreview = signal<AssetImportPreview | null>(null);
  protected readonly importResult = signal<AssetImportResult | null>(null);
  protected readonly approveZeroPrice = signal(false);
  protected readonly importReadyRows = computed(() => (this.importPreview()?.rows ?? []).filter(row => !row.excluded && this.rowErrors(row).length === 0 && (!row.warnings.length || row.warningsApproved)));
  protected readonly importCorrectionCount = computed(() => (this.importPreview()?.rows ?? []).filter(row => !row.excluded && this.rowErrors(row).length > 0).length);
  protected readonly importWarningCount = computed(() => (this.importPreview()?.rows ?? []).filter(row => !row.excluded && row.warnings.length > 0 && !row.warningsApproved).length);
  protected form: AssetDraft = this.emptyForm();

  protected readonly visible = computed(() => {
    const query = this.search().trim().toLowerCase();
    return this.assets().filter(asset => !query || `${asset.name} ${asset.assetTag}`.toLowerCase().includes(query));
  });

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.assetService.list().subscribe({
      next: assets => {
        this.assets.set(assets);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set(true);
        this.loading.set(false);
      }
    });
  }

  protected openCreate(): void {
    this.form = this.emptyForm();
    this.editingId.set(null);
    this.formError.set('');
    this.dialogOpen.set(true);
  }

  protected edit(asset: Asset): void {
    this.form = {
      assetTag: asset.assetTag,
      name: asset.name,
      category: asset.category,
      description: asset.description,
      price: Number(asset.price),
      totalQuantity: asset.totalQuantity,
      availableQty: asset.availableQty
    };
    this.editingId.set(asset.id);
    this.formError.set('');
    this.dialogOpen.set(true);
  }

  protected closeDialog(): void {
    if (this.saving()) return;
    this.dialogOpen.set(false);
    this.editingId.set(null);
  }

  protected saveAsset(): void {
    const form = this.form;
    if (!form.assetTag.trim() || !form.name.trim() || !form.description.trim()) {
      this.formError.set('Fill in the tag, name and description.');
      return;
    }
    if (form.price < 0 || form.totalQuantity < 1 || form.availableQty < 0 || form.availableQty > form.totalQuantity) {
      this.formError.set('Quantities must be whole numbers, and available can’t exceed the total.');
      return;
    }
    this.saving.set(true);
    this.formError.set('');
    const id = this.editingId();
    const request = id ? this.assetService.update(id, form) : this.assetService.create({ ...form, imageUrl: null, specifications: {} });
    request.subscribe({
      next: asset => {
        this.assets.update(list => (id ? list.map(item => (item.id === asset.id ? asset : item)) : [...list, asset]));
        this.saving.set(false);
        this.dialogOpen.set(false);
        this.editingId.set(null);
        this.toast.success(id ? `${asset.name} was updated.` : `${asset.name} was added to the catalogue.`, id ? 'Asset updated' : 'Asset added');
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.formError.set(error.error?.message ?? 'We couldn’t save this asset. Check that the tag is unique and try again.');
      }
    });
  }

  protected openImport(): void {
    this.importOpen.set(true);
    this.importError.set('');
    this.importResult.set(null);
  }

  protected closeImport(): void {
    if (this.importBusy()) return;
    this.importOpen.set(false);
    this.importPreview.set(null);
    this.importFile.set(null);
    this.importResult.set(null);
    this.importError.set('');
    this.importProgress.set(0);
    this.approveZeroPrice.set(false);
  }

  protected selectImportFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!/\.(xlsx|csv)$/i.test(file.name)) {
      this.importError.set('Choose an .xlsx or .csv file.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      this.importError.set('Choose a file smaller than 10 MB.');
      return;
    }
    this.importFile.set(file);
    this.importPreview.set(null);
    this.importResult.set(null);
    this.importError.set('');
    this.approveZeroPrice.set(false);
  }

  protected previewImport(): void {
    const file = this.importFile();
    if (!file || this.importBusy()) return;
    this.importBusy.set(true);
    this.importProgress.set(0);
    this.importError.set('');
    this.assetService.previewImport(file).subscribe({
      next: event => {
        if (event.type === HttpEventType.UploadProgress) {
          this.importProgress.set(event.total ? Math.round((event.loaded / event.total) * 100) : 0);
        } else if (event instanceof HttpResponse) {
          const response = event.body as { success: boolean; data: AssetImportPreview } | null;
          if (response?.success) this.importPreview.set(response.data);
        }
      },
      error: (error: HttpErrorResponse) => {
        this.importBusy.set(false);
        this.importError.set(error.error?.message ?? 'The spreadsheet could not be previewed.');
      },
      complete: () => {
        this.importBusy.set(false);
        this.importProgress.set(100);
      }
    });
  }

  protected rowErrors(row: AssetImportRow): string[] {
    const errors: string[] = [];
    if (!row.item.trim()) errors.push('Item name is required.');
    if (row.item.trim().length > 120) errors.push('Item name must be 120 characters or fewer.');
    if (!row.description.trim()) errors.push('Description is required.');
    if (row.description.trim().length > 500) errors.push('Description must be 500 characters or fewer.');
    if (!Number.isInteger(row.quantity) || (row.quantity ?? 0) < 1) errors.push('Enter a positive whole-number quantity.');
    if (!row.category) errors.push('Choose a category mapping.');
    return errors;
  }

  protected confirmImport(): void {
    const preview = this.importPreview();
    const file = this.importFile();
    if (!preview || !file || !this.importReadyRows().length || this.importBusy() || !this.approveZeroPrice()) return;
    this.importBusy.set(true);
    this.importProgress.set(0);
    this.importError.set('');
    const rows = this.importReadyRows().map(row => ({
      rowNumber: row.rowNumber,
      name: row.item.trim(),
      description: row.description.trim(),
      quantity: row.quantity!,
      category: row.category!,
      price: 0,
      warningsApproved: row.warningsApproved
    }));
    this.assetService.confirmImport(file, { previewToken: preview.previewToken, approveZeroPrice: true, rows }).subscribe({
      next: event => {
        if (event.type === HttpEventType.UploadProgress) {
          this.importProgress.set(event.total ? Math.round((event.loaded / event.total) * 100) : 0);
        } else if (event instanceof HttpResponse) {
          const response = event.body as { success: boolean; data: AssetImportResult } | null;
          if (response?.success) {
            this.importResult.set(response.data);
            this.load();
          }
        }
      },
      error: (error: HttpErrorResponse) => {
        this.importBusy.set(false);
        this.importError.set(error.error?.message ?? 'The import failed. Review the report and try again.');
      },
      complete: () => {
        this.importBusy.set(false);
        this.importProgress.set(100);
      }
    });
  }

  protected toggleAvailability(asset: Asset): void {
    const availableQty = asset.availableQty ? 0 : asset.totalQuantity;
    this.busyId.set(asset.id);
    this.assetService.update(asset.id, { availableQty }).subscribe({
      next: updated => {
        this.assets.update(list => list.map(item => (item.id === updated.id ? updated : item)));
        this.busyId.set(null);
        this.toast.success(availableQty ? `${asset.name} is available again.` : `${asset.name} is marked unavailable.`);
      },
      error: () => {
        this.busyId.set(null);
        this.toast.error('The availability could not be updated.', 'Update failed');
      }
    });
  }

  protected async deleteAsset(asset: Asset): Promise<void> {
    const { confirmed } = await this.confirm.ask({
      title: `Delete ${asset.name}?`,
      message: 'This removes the asset from the catalogue. It can’t be undone, and assets with request history can’t be deleted.',
      confirmLabel: 'Delete asset',
      tone: 'danger'
    });
    if (!confirmed) return;
    this.assetService.remove(asset.id).subscribe({
      next: () => {
        this.assets.update(list => list.filter(item => item.id !== asset.id));
        this.toast.success(`${asset.name} was deleted.`);
      },
      error: () => this.toast.error('This asset may have request history. Mark it unavailable instead.', 'Couldn’t delete asset')
    });
  }

  protected upload(asset: Asset, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!IMAGE_TYPES.includes(file.type)) {
      this.toast.error('Use a JPG, PNG or WebP image.', 'Unsupported file');
      input.value = '';
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      this.toast.error('Choose an image that is 5 MB or smaller.', 'Image too large');
      input.value = '';
      return;
    }
    this.uploadingId.set(asset.id);
    this.progress.set(0);
    this.media.upload(file, 'assets', asset.id).subscribe({
      next: update => {
        this.progress.set(update.percent);
        const updated = update.result?.asset;
        if (updated) {
          this.assets.update(list => list.map(item => (item.id === updated.id ? updated : item)));
          this.toast.success(`Photo saved for ${updated.name}.`, 'Photo uploaded');
        }
      },
      error: (error: unknown) => {
        this.uploadingId.set(null);
        this.progress.set(0);
        this.toast.error((error instanceof HttpErrorResponse ? error.error?.message : undefined) ?? 'The upload failed. Try again.', 'Upload failed');
        input.value = '';
      },
      complete: () => {
        this.uploadingId.set(null);
        input.value = '';
      }
    });
  }

  protected removeImage(asset: Asset): void {
    this.uploadingId.set(asset.id);
    this.media.removeAssetImage(asset.id).subscribe({
      next: () => {
        this.assets.update(list => list.map(item => (item.id === asset.id ? { ...item, imageUrl: null } : item)));
        this.toast.success(`Photo removed from ${asset.name}.`);
      },
      error: () => this.toast.error('The photo could not be removed.', 'Update failed'),
      complete: () => this.uploadingId.set(null)
    });
  }

  private emptyForm(): AssetDraft {
    return { assetTag: '', name: '', category: AssetCategory.COMPUTING_PERIPHERALS, description: '', price: 0, totalQuantity: 1, availableQty: 1 };
  }
}
