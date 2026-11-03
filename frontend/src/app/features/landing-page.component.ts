import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AssetCategory } from '../core/models';
import { AuthStore } from '../state/auth.store';
import { AssetStore } from '../state/asset.store';
import { AssetImageComponent } from '../shared/asset-image.component';
import { CATEGORY_META, CATEGORY_ORDER, categoryIcon, categoryLabel } from '../shared/format';

@Component({
  selector: 'jhub-landing-page',
  standalone: true,
  imports: [RouterLink, AssetImageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './landing-page.component.html',
  styleUrl: './landing-page.component.css'
})
export class LandingPageComponent implements OnInit, OnDestroy {
  protected readonly auth = inject(AuthStore);
  protected readonly store = inject(AssetStore);
  protected readonly categories = CATEGORY_ORDER.map(value => ({ value, ...CATEGORY_META[value] }));
  protected readonly pointerPaused = signal(false);
  protected readonly focusPaused = signal(false);
  protected readonly slideIndex = signal(0);

  protected readonly featuredAssets = computed(() => [...this.store.assets()]
    .sort((a, b) =>
      Number(!!b.imageUrl) - Number(!!a.imageUrl) ||
      Number(b.availableQty > 0) - Number(a.availableQty > 0) ||
      Number(!!b.description) - Number(!!a.description))
    .slice(0, 4));

  protected readonly activeIndex = computed(() => {
    const count = this.featuredAssets().length;
    return count ? this.slideIndex() % count : 0;
  });
  protected readonly activeAsset = computed(() => this.featuredAssets()[this.activeIndex()] ?? null);
  protected readonly totalUnits = computed(() => this.store.assets().reduce((sum, asset) => sum + asset.availableQty, 0));
  protected readonly availableAssetCount = computed(() => this.store.assets().filter(asset => asset.availableQty > 0).length);
  protected readonly assetCount = computed(() => this.store.assets().length);
  protected readonly categoryCounts = computed(() => {
    const counts = new Map<AssetCategory, number>();
    for (const asset of this.store.assets()) counts.set(asset.category, (counts.get(asset.category) ?? 0) + 1);
    return counts;
  });
  protected readonly categoryLabel = categoryLabel;
  protected readonly categoryIcon = categoryIcon;

  private autoplayTimer?: ReturnType<typeof setInterval>;

  constructor() {
    this.store.load();
  }

  ngOnInit(): void {
    this.autoplayTimer = setInterval(() => {
      if (this.shouldPauseAutoplay() || this.featuredAssets().length < 2) return;
      this.goToSlide(this.activeIndex() + 1);
    }, 5500);
  }

  ngOnDestroy(): void {
    if (this.autoplayTimer !== undefined) clearInterval(this.autoplayTimer);
  }

  protected goToSlide(index: number): void {
    const count = this.featuredAssets().length;
    if (count) this.slideIndex.set((index + count) % count);
  }

  protected onShowcaseKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.goToSlide(this.activeIndex() + 1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.goToSlide(this.activeIndex() - 1);
    }
  }

  protected onShowcaseFocusOut(event: FocusEvent): void {
    const container = event.currentTarget;
    const nextTarget = event.relatedTarget;
    if (container instanceof HTMLElement && !(nextTarget instanceof Node && container.contains(nextTarget))) {
      this.focusPaused.set(false);
    }
  }

  protected countIn(category: AssetCategory): number {
    return this.categoryCounts().get(category) ?? 0;
  }

  private shouldPauseAutoplay(): boolean {
    return this.pointerPaused() ||
      this.focusPaused() ||
      document.hidden ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
}
