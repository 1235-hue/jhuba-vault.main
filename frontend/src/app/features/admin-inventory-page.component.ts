import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AssetService } from '../core/api.service';
import { Asset, AssetCategory } from '../core/models';
import { AssetStore } from '../state/asset.store';
import { ConfirmService } from '../core/confirm.service';
import { ToastService } from '../core/toast.service';
import { EmptyStateComponent } from '../shared/empty-state.component';
import { ModalComponent } from '../shared/modal.component';
import { PageHeaderComponent } from '../shared/page-header.component';
import { CATEGORY_META, CATEGORY_ORDER, categoryIcon as iconFor, categoryLabel as labelFor, formatKsh } from '../shared/format';

type StockFilter = 'ALL' | 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
interface InventoryCategory {
  label: string;
  value: AssetCategory;
  icon: string;
  tone: string;
}
interface AssetDraft {
  assetTag: string;
  name: string;
  category: AssetCategory;
  description: string;
  price: number;
  totalQuantity: number;
  availableQty: number;
}

/** An asset is low on stock once a quarter or less of its units remain. */
const isLow = (asset: Asset): boolean => asset.availableQty > 0 && asset.availableQty / Math.max(asset.totalQuantity, 1) <= 0.25;

@Component({
  selector: 'jhub-admin-inventory-page',
  standalone: true,
  imports: [FormsModule, EmptyStateComponent, ModalComponent, PageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-inventory-page.component.html',
  styleUrl: './admin-inventory-page.component.css'
})
export class AdminInventoryPageComponent {
  protected readonly store = inject(AssetStore);
  private readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  protected readonly search = signal('');
  protected readonly selectedCategory = signal<AssetCategory | null>(null);
  protected readonly stockFilter = signal<StockFilter>('ALL');
  protected readonly dialogMode = signal<'view' | 'edit' | 'create' | null>(null);
  protected readonly selectedAsset = signal<Asset | null>(null);
  protected readonly editingId = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly formError = signal('');
  protected readonly categories: InventoryCategory[] = CATEGORY_ORDER.map(value => ({ value, label: CATEGORY_META[value].short, icon: 'pi-' + CATEGORY_META[value].icon.replace('pi-',''), tone: '' }));
  protected form: AssetDraft = this.emptyDraft();
  protected readonly filteredAssets = computed(() => {
    const query = this.search().trim().toLowerCase();
    const category = this.selectedCategory();
    const stock = this.stockFilter();
    return this.store.assets().filter(asset => {
      const matchesText = !query || `${asset.name} ${asset.assetTag} ${this.categoryLabel(asset.category)} ${asset.description}`.toLowerCase().includes(query);
      const matchesCategory = category === null || asset.category === category;
      const matchesStock = stock === 'ALL' || (stock === 'IN_STOCK' ? asset.availableQty > 0 && !isLow(asset) : stock === 'LOW_STOCK' ? isLow(asset) : asset.availableQty === 0);
      return matchesText && matchesCategory && matchesStock;
    });
  });
  protected readonly totalUnits = computed(() => this.store.assets().reduce((sum, asset) => sum + asset.totalQuantity, 0));
  protected readonly availableUnits = computed(() => this.store.assets().reduce((sum, asset) => sum + asset.availableQty, 0));
  protected readonly lowStockCount = computed(() => this.store.assets().filter(isLow).length);
  protected readonly outOfStockCount = computed(() => this.store.assets().filter(asset => asset.availableQty === 0).length);

  constructor() {
    this.store.load();
  }

  protected categoryLabel(category: AssetCategory): string {
    return labelFor(category);
  }

  protected categoryIcon(category: AssetCategory): string {
    return iconFor(category);
  }

  protected categoryCount(category: AssetCategory): number {
    return this.store.assets().filter(asset => asset.category === category).length;
  }

  protected selectCategory(category: AssetCategory | null): void {
    this.selectedCategory.set(category);
  }

  protected assetValue(asset: Asset): number {
    return Number(asset.price) * asset.totalQuantity;
  }

  protected formatPrice(value: number | string): string {
    return formatKsh(value);
  }

  protected stockStatus(asset: Asset): string {
    if (asset.availableQty === 0) return 'Out of stock';
    return isLow(asset) ? 'Low stock' : 'In stock';
  }




  protected clearFilters(): void {
    this.search.set('');
    this.selectedCategory.set(null);
    this.stockFilter.set('ALL');
  }

  protected view(asset: Asset): void {
    this.selectedAsset.set(asset);
    this.editingId.set(null);
    this.dialogMode.set('view');
  }

  protected edit(asset: Asset): void {
    this.form = this.draftFromAsset(asset);
    this.editingId.set(asset.id);
    this.selectedAsset.set(asset);
    this.formError.set('');
    this.dialogMode.set('edit');
  }

  protected openCreate(): void {
    this.form = this.emptyDraft();
    this.editingId.set(null);
    this.selectedAsset.set(null);
    this.formError.set('');
    this.dialogMode.set('create');
  }

  protected closeDialog(): void {
    if (this.saving()) return;
    this.dialogMode.set(null);
    this.selectedAsset.set(null);
    this.editingId.set(null);
    this.formError.set('');
  }

  protected saveAsset(): void {
    if (this.saving()) return;
    if (this.form.availableQty > this.form.totalQuantity) {
      this.formError.set('Available quantity cannot exceed total quantity.');
      return;
    }
    if (!Number.isFinite(this.form.price) || this.form.price < 0 || !Number.isInteger(this.form.totalQuantity) || !Number.isInteger(this.form.availableQty)) {
      this.formError.set('Enter a valid price and whole-number quantities.');
      return;
    }
    this.saving.set(true);
    this.formError.set('');
    const payload = { ...this.form, specifications: {} };
    const editingId = this.editingId();
    const request = editingId ? this.assetService.update(editingId, payload) : this.assetService.create(payload);
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.dialogMode.set(null);
        this.toast.success(editingId ? 'Inventory item updated.' : 'Inventory item added.');
        this.editingId.set(null);
        this.store.load();
      },
      error: error => {
        this.saving.set(false);
        this.formError.set(error?.error?.message ?? 'Unable to save the inventory item. Please try again.');
      }
    });
  }

  protected async deleteAsset(asset: Asset): Promise<void> {
    const { confirmed } = await this.confirm.ask({
      title: `Delete ${asset.name}?`,
      message: 'This removes the item from the catalogue and inventory. It can’t be undone, and items with request history can’t be deleted.',
      confirmLabel: 'Delete item',
      tone: 'danger'
    });
    if (!confirmed) return;
    this.assetService.remove(asset.id).subscribe({
      next: () => {
        this.toast.success(`${asset.name} was deleted.`);
        this.store.load();
      },
      error: error => this.toast.error(error?.error?.message ?? 'This item may have request history. Mark it unavailable instead.', 'Couldn’t delete item')
    });
  }

  private emptyDraft(): AssetDraft {
    return { assetTag: '', name: '', category: AssetCategory.COMPUTING_PERIPHERALS, description: '', price: 0, totalQuantity: 1, availableQty: 1 };
  }

  private draftFromAsset(asset: Asset): AssetDraft {
    return { assetTag: asset.assetTag, name: asset.name, category: asset.category, description: asset.description, price: Number(asset.price), totalQuantity: asset.totalQuantity, availableQty: asset.availableQty };
  }
}
