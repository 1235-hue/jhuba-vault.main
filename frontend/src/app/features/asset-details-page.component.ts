import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Asset } from '../core/models';
import { AssetService } from '../core/api.service';
import { AssetImageComponent } from '../shared/asset-image.component';
import { EmptyStateComponent } from '../shared/empty-state.component';
import { PageHeaderComponent } from '../shared/page-header.component';
import { RequestStore } from '../state/request.store';
import { categoryLabel, stockTone } from '../shared/format';

@Component({
  selector: 'jhub-asset-details-page',
  standalone: true,
  imports: [CurrencyPipe, RouterLink, AssetImageComponent, EmptyStateComponent, PageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './asset-details-page.component.html',
  styleUrl: './asset-details-page.component.css'
})
export class AssetDetailsPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly assetService = inject(AssetService);
  protected readonly request = inject(RequestStore);

  protected readonly asset = signal<Asset | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly quantity = signal(1);
  protected readonly stockTone = stockTone;

  protected readonly inRequest = computed(() => {
    const asset = this.asset();
    return asset ? (this.request.draft().items.find(item => item.assetId === asset.id)?.quantity ?? 0) : 0;
  });

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe(params => this.loadAsset(params.get('id')));
  }

  protected specifications(): Array<[string, string]> {
    return Object.entries(this.asset()?.specifications ?? {});
  }

  protected categoryLabel(): string {
    const category = this.asset()?.category;
    return category ? categoryLabel(category) : '';
  }

  protected step(delta: number): void {
    const asset = this.asset();
    if (!asset) return;
    this.quantity.set(Math.max(1, Math.min(asset.availableQty, this.quantity() + delta)));
  }

  protected requestAsset(): void {
    const asset = this.asset();
    if (!asset || asset.availableQty < 1) return;
    this.request.addAsset(asset, this.quantity());
    this.quantity.set(1);
  }

  protected loadAsset(id: string | null): void {
    this.loading.set(true);
    this.error.set(null);
    if (!id) {
      this.error.set('No asset was specified.');
      this.loading.set(false);
      return;
    }
    this.assetService.getById(id).subscribe({
      next: asset => {
        if (this.route.snapshot.paramMap.get('id') !== id) return;
        this.asset.set(asset);
        this.quantity.set(1);
        this.loading.set(false);
      },
      error: (error: { status?: number }) => {
        if (this.route.snapshot.paramMap.get('id') !== id) return;
        this.asset.set(null);
        this.error.set(error?.status === 404 ? 'not-found' : 'failed');
        this.loading.set(false);
      }
    });
  }
}
