import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AssetService } from '../core/api.service';
import { Asset, AssetCategory } from '../core/models';
import { AssetStore } from '../state/asset.store';

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

const LOW_STOCK_LIMIT = 3;

@Component({
  selector: 'jhub-admin-inventory-page',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="inventory-page page-width">
      <header class="inventory-heading">
        <div>
          <p class="eyebrow">ADMINISTRATION / INVENTORY</p>
          <h1>Inventory <em>overview.</em></h1>
          <p class="intro">Manage and track inventory items, categories, and stock levels.</p>
        </div>
        <button class="primary-button add-button" type="button" (click)="openCreate()">＋ Add Item</button>
      </header>

      @if (store.loading()) {
        <div class="page-message" role="status">Loading inventory…</div>
      }
      @if (store.error()) {
        <div class="page-message error" role="alert">{{ store.error() }} <button type="button" (click)="store.load()">Try again</button></div>
      }
      @if (feedback()) {
        <div class="page-message" [class.error]="feedbackIsError()" role="status">{{ feedback() }}<button type="button" (click)="feedback.set('')" aria-label="Dismiss">×</button></div>
      }

      <section class="summary-grid" aria-label="Inventory summary">
        <article class="summary-card"><span class="summary-icon blue"><i class="pi pi-box"></i></span><div><small>Total Items</small><strong>{{ totalUnits() }}</strong><p>Units in inventory</p></div></article>
        <article class="summary-card"><span class="summary-icon green"><i class="pi pi-check-circle"></i></span><div><small>In Stock</small><strong>{{ availableUnits() }}</strong><p>Units available</p></div></article>
        <article class="summary-card"><span class="summary-icon amber"><i class="pi pi-exclamation-triangle"></i></span><div><small>Low Stock</small><strong>{{ lowStockCount() }}</strong><p>Items at 1–{{ lowStockLimit }} units</p></div></article>
        <article class="summary-card"><span class="summary-icon red"><i class="pi pi-clock"></i></span><div><small>Out of Stock</small><strong>{{ outOfStockCount() }}</strong><p>Items with none available</p></div></article>
        <article class="summary-card"><span class="summary-icon violet"><i class="pi pi-users"></i></span><div><small>Total Suppliers</small><strong>—</strong><p>Supplier records not tracked</p></div></article>
      </section>

      <section class="categories-section" aria-labelledby="category-heading">
        <div class="section-heading"><h2 id="category-heading">Inventory Categories</h2><button type="button" class="arrow-link" (click)="selectCategory(null)">View All Categories →</button></div>
        <div class="category-grid">
          @for (category of categories; track category.value) {
            <button type="button" class="category-card" [class.selected]="selectedCategory() === category.value" [attr.aria-pressed]="selectedCategory() === category.value" (click)="selectCategory(category.value)">
              <span class="category-icon" [class]="category.tone"><i [class]="category.icon"></i></span>
              <span><strong>{{ category.label }}</strong><small>{{ categoryCount(category.value) }} items</small></span>
            </button>
          }
        </div>
      </section>

      <section class="inventory-panel" aria-labelledby="items-heading">
        <div class="panel-toolbar">
          <div class="panel-title"><h2 id="items-heading">Inventory Items</h2><span>{{ filteredAssets().length }} items</span></div>
          <div class="controls">
            <label class="search-field"><i class="pi pi-search"></i><input type="search" aria-label="Search by item name, SKU, or category" placeholder="Search name, SKU, or category..." [ngModel]="search()" (ngModelChange)="search.set($event)"></label>
            <label class="select-control"><span class="sr-only">Filter by stock status</span><i class="pi pi-filter"></i><select [ngModel]="stockFilter()" (ngModelChange)="stockFilter.set($event)"><option value="ALL">All statuses</option><option value="IN_STOCK">In Stock</option><option value="LOW_STOCK">Low Stock</option><option value="OUT_OF_STOCK">Out of Stock</option></select></label>
            <label class="select-control category-control"><span class="sr-only">Filter by category</span><select [ngModel]="selectedCategory()" (ngModelChange)="selectCategory($event)"><option [ngValue]="null">All Categories</option>@for (category of categories; track category.value) { <option [ngValue]="category.value">{{ category.label }}</option> }</select></label>
          </div>
        </div>
        <div class="table-scroll">
          <table>
            <thead><tr>
              <th class="check-cell"><input type="checkbox" aria-label="Select all visible items" [checked]="allVisibleSelected()" [indeterminate]="someVisibleSelected()" (change)="toggleAll($event)"></th>
              <th>Item Name</th><th>SKU</th><th>Category</th><th>Quantity</th><th>Unit Price<br>(KSh)</th><th>Total Value<br>(KSh)</th><th>Status</th><th>Actions</th>
            </tr></thead>
            <tbody>
              @for (asset of filteredAssets(); track asset.id) {
                <tr>
                  <td class="check-cell"><input type="checkbox" [attr.aria-label]="'Select ' + asset.name" [checked]="isSelected(asset.id)" (change)="toggleSelected(asset.id, $event)"></td>
                  <td><div class="item-cell"><span class="item-image">@if (asset.imageUrl) { <img [src]="asset.imageUrl" [alt]="asset.name"> } @else { <i [class]="categoryIcon(asset.category)"></i> }</span><span class="item-copy"><strong>{{ asset.name }}</strong><small>{{ asset.description }}</small></span></div></td>
                  <td class="sku">{{ asset.assetTag }}</td><td><span class="category-pill">{{ categoryLabel(asset.category) }}</span></td>
                  <td class="quantity">{{ asset.availableQty }} <small>/ {{ asset.totalQuantity }}</small></td>
                  <td>{{ formatPrice(asset.price) }}</td><td>{{ formatPrice(assetValue(asset)) }}</td>
                  <td><span class="status-badge" [class.low]="stockStatus(asset) === 'Low Stock'" [class.out]="stockStatus(asset) === 'Out of Stock'">{{ stockStatus(asset) }}</span></td>
                  <td><div class="row-actions"><button type="button" class="action-button" (click)="view(asset)"><i class="pi pi-eye"></i> View</button><button type="button" class="action-button" (click)="edit(asset)"><i class="pi pi-pencil"></i> Edit</button><details class="row-menu"><summary aria-label="More actions"><i class="pi pi-ellipsis-v"></i></summary><div><button type="button" (click)="deleteAsset(asset)">Delete item</button></div></details></div></td>
                </tr>
              } @empty {
                <tr><td colspan="9"><div class="empty-state"><i class="pi pi-search"></i><strong>No inventory items found</strong><p>Try another search or filter, or add a new item.</p><button type="button" class="secondary-button clear-button" (click)="clearFilters()">Clear filters</button></div></td></tr>
              }
            </tbody>
          </table>
        </div>
        @if (selectedIds().length) { <div class="selection-footer" role="status">{{ selectedIds().length }} selected <button type="button" (click)="selectedIds.set([])">Clear selection</button></div> }
      </section>
    </main>

    @if (dialogMode()) {
      <div class="modal-backdrop" (click)="closeDialog()">
        <section class="asset-dialog" role="dialog" aria-modal="true" [attr.aria-labelledby]="dialogMode() === 'view' ? 'view-title' : 'form-title'" (click)="$event.stopPropagation()">
          @if (dialogMode() === 'view' && selectedAsset(); as asset) {
            <div class="dialog-heading"><div><p class="eyebrow">INVENTORY ITEM</p><h2 id="view-title">{{ asset.name }}</h2></div><button type="button" class="dialog-close" (click)="closeDialog()" aria-label="Close">×</button></div>
            <p class="detail-description">{{ asset.description }}</p>
            <dl class="detail-grid"><div><dt>SKU</dt><dd>{{ asset.assetTag }}</dd></div><div><dt>Category</dt><dd>{{ categoryLabel(asset.category) }}</dd></div><div><dt>Available quantity</dt><dd>{{ asset.availableQty }} of {{ asset.totalQuantity }}</dd></div><div><dt>Unit price</dt><dd>{{ formatPrice(asset.price) }}</dd></div><div><dt>Total value</dt><dd>{{ formatPrice(assetValue(asset)) }}</dd></div><div><dt>Status</dt><dd>{{ stockStatus(asset) }}</dd></div></dl>
            <div class="dialog-actions"><button type="button" class="secondary-button" (click)="closeDialog()">Close</button><button type="button" class="primary-button" (click)="edit(asset)">Edit item</button></div>
          } @else {
            <form (ngSubmit)="saveAsset()">
              <div class="dialog-heading"><div><p class="eyebrow">INVENTORY MANAGEMENT</p><h2 id="form-title">{{ editingId() ? 'Edit inventory item' : 'Add inventory item' }}</h2></div><button type="button" class="dialog-close" (click)="closeDialog()" aria-label="Close">×</button></div>
              <div class="form-grid">
                <label>Item name<input name="name" [(ngModel)]="form.name" required maxlength="120"></label>
                <label>SKU<input name="assetTag" [(ngModel)]="form.assetTag" required maxlength="64"></label>
                <label>Category<select name="category" [(ngModel)]="form.category" required>@for (category of categories; track category.value) { <option [ngValue]="category.value">{{ category.label }}</option> }</select></label>
                <label>Unit price (KSh)<input name="price" type="number" min="0" step="0.01" [(ngModel)]="form.price" required></label>
                <label>Total quantity<input name="totalQuantity" type="number" min="1" step="1" [(ngModel)]="form.totalQuantity" required></label>
                <label>Available quantity<input name="availableQty" type="number" min="0" [max]="form.totalQuantity" step="1" [(ngModel)]="form.availableQty" required></label>
                <label class="full-width">Description<textarea name="description" rows="3" [(ngModel)]="form.description" required maxlength="500"></textarea></label>
              </div>
              @if (formError()) { <p class="form-error" role="alert">{{ formError() }}</p> }
              <div class="dialog-actions"><button type="button" class="secondary-button" (click)="closeDialog()">Cancel</button><button type="submit" class="primary-button" [disabled]="saving()">{{ saving() ? 'Saving…' : editingId() ? 'Save changes' : 'Add item' }}</button></div>
            </form>
          }
        </section>
      </div>
    }
  `,
  styles: [`
    :host{display:block;color:var(--ink,#172033)}
    .inventory-page{width:min(1160px,calc(100% - 48px));margin:0 auto;padding:44px 0 72px}
    .inventory-heading{display:flex;align-items:end;justify-content:space-between;gap:20px;margin-bottom:25px}
    .eyebrow{color:var(--green,#3ea945);font-size:10px;font-weight:800;letter-spacing:2px;margin:0 0 10px}
    .inventory-heading h1{font:400 clamp(34px,4vw,46px)/1.05 Georgia,serif;color:var(--navy,#262571);margin:0}
    .inventory-heading h1 em{color:var(--green,#3ea945)}
    .intro{color:#7c8492;font-size:13px;margin:8px 0 0}
    .add-button{padding:12px 18px;gap:8px}
    .summary-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:13px;margin-bottom:26px}
    .summary-card{min-height:112px;background:#fff;border:1px solid #e6e8ee;border-radius:8px;padding:16px;display:flex;align-items:flex-start;justify-content:space-between;gap:9px}
    .summary-card small{display:block;color:#727c8d;font-size:10px;font-weight:800;letter-spacing:.7px}
    .summary-card strong{display:block;color:#172033;font-size:24px;margin-top:5px}
    .summary-card p{color:#7c8492;font-size:10px;margin:5px 0 0}
    .summary-icon{width:36px;height:36px;border-radius:9px;display:grid;place-items:center;flex:none}
    .summary-icon.blue{background:#edf3ff;color:#2a4695}.summary-icon.green{background:#eaf7ec;color:#3ea945}.summary-icon.amber{background:#fff6e7;color:#c78620}.summary-icon.red{background:#fff0f0;color:#e6292a}.summary-icon.violet{background:#f4effb;color:#8061b2}
    .categories-section{margin-bottom:22px}.section-heading{display:flex;align-items:center;justify-content:space-between;margin-bottom:11px}.section-heading h2,.panel-title h2{font-size:17px;color:#172033;margin:0}
    .arrow-link{border:0;background:transparent;color:var(--blue,#2a4695);font-size:12px;font-weight:700;text-decoration:none}
    .category-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px}
    .category-card{min-width:0;min-height:67px;padding:9px 10px;background:#fff;border:1px solid #e6e8ee;border-radius:8px;display:flex;align-items:center;gap:10px;text-align:left;cursor:pointer}
    .category-card:hover,.category-card.selected{border-color:#aab8df;box-shadow:0 0 0 2px #2625710b}
    .category-icon{width:35px;height:35px;border-radius:8px;display:grid;place-items:center;flex:none}
    .category-icon.blue{background:#edf3ff;color:#2a4695}.category-icon.green{background:#eaf7ec;color:#3ea945}.category-icon.violet{background:#f4effb;color:#8061b2}.category-icon.amber{background:#fff6e7;color:#c78620}.category-icon.teal{background:#eaf8f8;color:#148b91}.category-icon.gray{background:#f0f2f5;color:#687284}
    .category-card strong,.category-card small{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.category-card strong{font-size:11px;color:#344054}.category-card small{font-size:10px;color:#7c8492;margin-top:3px}
    .inventory-panel{background:#fff;border:1px solid #e6e8ee;border-radius:8px;overflow:hidden}
    .panel-toolbar{min-height:63px;padding:13px 17px;display:flex;justify-content:space-between;align-items:center;gap:14px;border-bottom:1px solid #edf0f4}
    .panel-title{display:flex;align-items:baseline;gap:9px;white-space:nowrap}.panel-title span{font-size:11px;color:#7c8492}
    .controls{display:flex;align-items:center;gap:8px}
    .search-field,.select-control{height:34px;border:1px solid #dce0e8;border-radius:5px;display:flex;align-items:center;gap:7px;padding:0 9px;color:#788397;background:#fff}
    .search-field{width:240px}.search-field input{min-width:0;width:100%;border:0;outline:0;color:#172033;font-size:11px;background:transparent}.search-field input::placeholder{color:#8a93a2}
    .select-control select{max-width:145px;border:0;background:transparent;outline:0;color:#586174;font-size:11px}
    .category-control select{max-width:128px}
    .table-scroll{width:100%;overflow-x:auto}
    table{width:100%;min-width:970px;border-collapse:collapse;text-align:left}
    th{height:48px;padding:8px 9px;background:#fafbfc;border-bottom:1px solid #e6e8ee;color:#687284;font-size:9px;letter-spacing:.45px;text-transform:uppercase}
    td{height:68px;padding:9px;border-bottom:1px solid #edf0f4;color:#586174;font-size:10px;vertical-align:middle}
    tbody tr:last-child td{border-bottom:0}th:first-child,td:first-child{padding-left:17px}
    .check-cell{width:38px}input[type=checkbox]{width:14px;height:14px;accent-color:var(--navy,#262571);vertical-align:middle}
    .item-cell{min-width:200px;display:flex;align-items:center;gap:9px}.item-image{width:38px;height:38px;border-radius:5px;background:#f2f4f8;color:#55678c;display:grid;place-items:center;overflow:hidden;flex:none}.item-image img{width:100%;height:100%;object-fit:cover}
    .item-copy{min-width:0;max-width:205px}.item-copy strong,.item-copy small{display:block}.item-copy strong{font-size:10px;color:#262571}.item-copy small{font-size:9px;color:#8a93a2;margin-top:3px;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
    .sku{font-family:Consolas,monospace;color:#667083;font-size:9px}.category-pill{display:inline-block;border-radius:12px;padding:5px 8px;background:#eef2fa;color:#344d88;font-size:9px;font-weight:700;white-space:nowrap}
    .quantity{font-weight:700;color:#344054}.quantity small{font-weight:400;color:#8993a1}
    .status-badge{display:inline-flex;border-radius:12px;padding:5px 8px;background:#eaf7ec;color:#287c32;font-size:9px;font-weight:700;white-space:nowrap}.status-badge.low{background:#fff5e5;color:#aa7015}.status-badge.out{background:#fff0f0;color:#c52c2d}
    .row-actions{display:flex;align-items:center;gap:4px;white-space:nowrap}.action-button{height:26px;padding:0 7px;border:1px solid #dce0e8;border-radius:4px;background:#fff;color:#586174;display:inline-flex;align-items:center;gap:4px;font-size:9px}.action-button:hover{border-color:#aab8df;color:var(--navy,#262571)}
    .row-menu{position:relative}.row-menu summary{width:22px;height:27px;display:grid;place-items:center;list-style:none;color:#7c8492;cursor:pointer}.row-menu summary::-webkit-details-marker{display:none}.row-menu>div{position:absolute;right:0;top:100%;z-index:3;min-width:110px;padding:4px;background:white;border:1px solid #e6e8ee;box-shadow:0 8px 18px #17203320}.row-menu button{width:100%;padding:8px;border:0;background:#fff;text-align:left;color:#a51f20;font-size:10px}
    .empty-state{min-height:190px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;color:#7c8492}.empty-state>i{font-size:20px;color:#8994a5}.empty-state strong{color:#344054;margin-top:10px;font-size:13px}.empty-state p{margin:5px 0 12px;font-size:11px}.clear-button{padding:8px 12px}
    .selection-footer{padding:10px 17px;border-top:1px solid #edf0f4;color:#586174;font-size:11px}.selection-footer button,.page-message button{margin-left:9px;border:0;background:transparent;color:var(--navy,#262571);font-size:11px;text-decoration:underline}
    .page-message{margin-bottom:12px;padding:11px 14px;border:1px solid #dce8dc;background:#f5fbf5;color:#26742b;font-size:12px}.page-message.error{border-color:#ead4d4;background:#fff7f7;color:#a51f20}
    .modal-backdrop{position:fixed;inset:0;z-index:30;background:#17203380;display:grid;place-items:center;padding:20px;overflow:auto}.asset-dialog{width:min(560px,100%);max-height:90vh;overflow:auto;padding:23px;background:white;border:1px solid #e6e8ee;box-shadow:0 20px 60px #17203330}
    .dialog-heading{display:flex;justify-content:space-between;gap:12px}.dialog-heading h2{font-size:20px;color:var(--navy,#262571);margin:0}.dialog-heading .eyebrow{margin-bottom:6px}.dialog-close{border:0;background:none;color:#687284;font-size:24px;line-height:1}
    .detail-description{font-size:12px;color:#687284;line-height:1.5}.detail-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.detail-grid div{padding:10px;background:#f7f8fb}.detail-grid dt{font-size:9px;text-transform:uppercase;letter-spacing:.5px;color:#7c8492}.detail-grid dd{margin:4px 0 0;color:#262571;font-size:12px;font-weight:700}
    .form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.form-grid label{display:grid;gap:5px;color:#586174;font-size:11px}.form-grid input,.form-grid select,.form-grid textarea{width:100%;min-height:36px;padding:8px;border:1px solid #dce0e8;border-radius:3px;color:#172033;background:#fff;font:inherit;font-size:11px}.form-grid textarea{resize:vertical}.full-width{grid-column:1/-1}.form-error{color:#a51f20;font-size:11px}.dialog-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:18px}.dialog-actions .primary-button,.dialog-actions .secondary-button{padding:10px 14px;cursor:pointer}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
    @media(max-width:1050px){.summary-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.category-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.panel-toolbar{align-items:flex-start;flex-direction:column}.controls{width:100%}.search-field{flex:1}}
    @media(max-width:640px){.inventory-page{width:calc(100% - 28px);padding:30px 0 48px}.inventory-heading{align-items:flex-start;flex-direction:column}.inventory-heading h1{font-size:36px}.summary-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.summary-card{min-height:98px;padding:12px}.summary-card strong{font-size:21px}.summary-card p{font-size:9px}.summary-card:last-child{grid-column:span 2}.category-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.category-card{padding:8px}.panel-toolbar{padding:12px}.controls{flex-wrap:wrap}.search-field{width:100%;flex:auto}.select-control{flex:1;justify-content:center}.select-control select,.category-control select{max-width:100%;min-width:0}.detail-grid,.form-grid{grid-template-columns:1fr}.full-width{grid-column:auto}.asset-dialog{padding:17px}}
  `]
})
export class AdminInventoryPageComponent {
  protected readonly store = inject(AssetStore);
  private readonly assetService = inject(AssetService);
  protected readonly search = signal('');
  protected readonly selectedCategory = signal<AssetCategory | null>(null);
  protected readonly stockFilter = signal<StockFilter>('ALL');
  protected readonly selectedIds = signal<string[]>([]);
  protected readonly dialogMode = signal<'view' | 'edit' | 'create' | null>(null);
  protected readonly selectedAsset = signal<Asset | null>(null);
  protected readonly editingId = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly formError = signal('');
  protected readonly feedback = signal('');
  protected readonly feedbackIsError = signal(false);
  protected readonly lowStockLimit = LOW_STOCK_LIMIT;
  protected readonly categories: InventoryCategory[] = [
    { label: 'Computing', value: AssetCategory.COMPUTING_PERIPHERALS, icon: 'pi pi-desktop', tone: 'blue' },
    { label: 'Networking', value: AssetCategory.NETWORKING_INFRASTRUCTURE, icon: 'pi pi-share-alt', tone: 'green' },
    { label: 'IoT & Sensors', value: AssetCategory.IOT_PROTOTYPING, icon: 'pi pi-microchip', tone: 'violet' },
    { label: 'AV Equipment', value: AssetCategory.AV_PRESENTATION, icon: 'pi pi-video', tone: 'amber' },
    { label: 'Tools', value: AssetCategory.OFFICE_SUPPLIES, icon: 'pi pi-cog', tone: 'teal' },
    { label: 'Other', value: AssetCategory.FURNITURE, icon: 'pi pi-ellipsis-h', tone: 'gray' }
  ];
  protected form: AssetDraft = this.emptyDraft();
  protected readonly filteredAssets = computed(() => {
    const query = this.search().trim().toLowerCase();
    const category = this.selectedCategory();
    const stock = this.stockFilter();
    return this.store.assets().filter(asset => {
      const matchesText = !query || `${asset.name} ${asset.assetTag} ${this.categoryLabel(asset.category)} ${asset.description}`.toLowerCase().includes(query);
      const matchesCategory = category === null || asset.category === category;
      const matchesStock = stock === 'ALL' || (stock === 'IN_STOCK' ? asset.availableQty > LOW_STOCK_LIMIT : stock === 'LOW_STOCK' ? asset.availableQty > 0 && asset.availableQty <= LOW_STOCK_LIMIT : asset.availableQty === 0);
      return matchesText && matchesCategory && matchesStock;
    });
  });
  protected readonly totalUnits = computed(() => this.store.assets().reduce((sum, asset) => sum + asset.totalQuantity, 0));
  protected readonly availableUnits = computed(() => this.store.assets().reduce((sum, asset) => sum + asset.availableQty, 0));
  protected readonly lowStockCount = computed(() => this.store.assets().filter(asset => asset.availableQty > 0 && asset.availableQty <= LOW_STOCK_LIMIT).length);
  protected readonly outOfStockCount = computed(() => this.store.assets().filter(asset => asset.availableQty === 0).length);
  protected readonly allVisibleSelected = computed(() => this.filteredAssets().length > 0 && this.filteredAssets().every(asset => this.selectedIds().includes(asset.id)));
  protected readonly someVisibleSelected = computed(() => this.filteredAssets().some(asset => this.selectedIds().includes(asset.id)) && !this.allVisibleSelected());

  constructor() {
    this.store.load();
  }

  protected categoryLabel(category: AssetCategory): string {
    return this.categories.find(item => item.value === category)?.label ?? category.replaceAll('_', ' ');
  }

  protected categoryIcon(category: AssetCategory): string {
    return this.categories.find(item => item.value === category)?.icon ?? 'pi pi-box';
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
    return `KSh ${Number(value).toLocaleString('en-KE', { maximumFractionDigits: 0 })}`;
  }

  protected stockStatus(asset: Asset): string {
    if (asset.availableQty === 0) return 'Out of Stock';
    return asset.availableQty <= LOW_STOCK_LIMIT ? 'Low Stock' : 'In Stock';
  }

  protected isSelected(id: string): boolean {
    return this.selectedIds().includes(id);
  }

  protected toggleSelected(id: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.selectedIds.update(ids => checked ? [...new Set([...ids, id])] : ids.filter(selected => selected !== id));
  }

  protected toggleAll(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const visible = this.filteredAssets().map(asset => asset.id);
    this.selectedIds.update(ids => checked ? [...new Set([...ids, ...visible])] : ids.filter(id => !visible.includes(id)));
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
        this.feedbackIsError.set(false);
        this.feedback.set(editingId ? 'Inventory item updated.' : 'Inventory item added.');
        this.editingId.set(null);
        this.store.load();
      },
      error: error => {
        this.saving.set(false);
        this.formError.set(error?.error?.message ?? 'Unable to save the inventory item. Please try again.');
      }
    });
  }

  protected deleteAsset(asset: Asset): void {
    if (!window.confirm(`Delete ${asset.name}? This cannot be undone.`)) return;
    this.assetService.remove(asset.id).subscribe({
      next: () => {
        this.feedbackIsError.set(false);
        this.feedback.set(`${asset.name} was deleted.`);
        this.selectedIds.update(ids => ids.filter(id => id !== asset.id));
        this.store.load();
      },
      error: error => {
        this.feedbackIsError.set(true);
        this.feedback.set(error?.error?.message ?? 'Unable to delete this item. It may have request history.');
      }
    });
  }

  private emptyDraft(): AssetDraft {
    return { assetTag: '', name: '', category: AssetCategory.COMPUTING_PERIPHERALS, description: '', price: 0, totalQuantity: 1, availableQty: 1 };
  }

  private draftFromAsset(asset: Asset): AssetDraft {
    return { assetTag: asset.assetTag, name: asset.name, category: asset.category, description: asset.description, price: Number(asset.price), totalQuantity: asset.totalQuantity, availableQty: asset.availableQty };
  }
}
