import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Asset, AssetCategory } from '../core/models';
import { AssetStore } from '../state/asset.store';
import { RequestStore } from '../state/request.store';
import { AssetImageComponent } from '../shared/asset-image.component';
import { EmptyStateComponent } from '../shared/empty-state.component';
import { PageHeaderComponent } from '../shared/page-header.component';
import { CATEGORY_META, CATEGORY_ORDER, categoryShort, stockTone } from '../shared/format';

@Component({
  selector: 'jhub-catalogue-page',
  standalone: true,
  imports: [FormsModule, RouterLink, AssetImageComponent, EmptyStateComponent, PageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './catalogue-page.component.html',
  styleUrl: './catalogue-page.component.css'
})
export class CataloguePageComponent {
  protected readonly assets = inject(AssetStore);
  protected readonly request = inject(RequestStore);
  protected readonly categories = CATEGORY_ORDER;
  protected readonly meta = CATEGORY_META;
  protected readonly categoryShort = categoryShort;
  protected readonly stockTone = stockTone;
  protected readonly skeletons = [1, 2, 3, 4, 5, 6];

  constructor() {
    this.assets.load();
    inject(ActivatedRoute).queryParamMap.pipe(takeUntilDestroyed()).subscribe(params => {
      const category = params.get('category');
      if (category && (Object.values(AssetCategory) as string[]).includes(category)) {
        this.assets.setCategory(category as AssetCategory);
      }
    });
  }

  protected countIn(category: AssetCategory): number {
    return this.assets.assets().filter(asset => asset.category === category).length;
  }

  protected inRequest(assetId: string): number {
    return this.request.draft().items.find(item => item.assetId === assetId)?.quantity ?? 0;
  }

  protected add(asset: Asset): void {
    this.request.addAsset(asset);
  }

  protected change(asset: Asset, delta: number): void {
    const next = this.inRequest(asset.id) + delta;
    if (next <= 0) this.request.removeAsset(asset.id);
    else this.request.setQuantity(asset.id, next);
  }

  protected hasFilters(): boolean {
    return !!this.assets.search() || this.assets.category() !== 'ALL' || this.assets.availability() !== 'ALL';
  }
}
