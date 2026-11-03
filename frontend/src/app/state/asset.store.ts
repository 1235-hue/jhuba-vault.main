import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { AssetService } from '../core/api.service';
import { Asset, AssetCategory } from '../core/models';

interface AssetState { assets: Asset[]; search: string; category: AssetCategory | 'ALL'; availability: 'ALL' | 'IN_STOCK' | 'CHECKED_OUT' | 'UNDER_MAINTENANCE'; loading: boolean; error: string | null; }
export const AssetStore = signalStore(
  { providedIn: 'root' },
  withState<AssetState>({ assets: [], search: '', category: 'ALL', availability: 'ALL', loading: false, error: null }),
  withComputed(({ assets, search, category, availability }) => ({
    filteredAssets: computed(() => assets().filter(asset => {
      const query = search().trim().toLowerCase();
      const matchesSearch = !query || `${asset.name} ${asset.assetTag} ${asset.description} ${Object.values(asset.specifications).join(' ')}`.toLowerCase().includes(query);
      const matchesCategory = category() === 'ALL' || asset.category === category();
      const matchesAvailability = availability() === 'ALL' || (availability() === 'IN_STOCK' ? asset.availableQty > 0 : availability() === 'CHECKED_OUT' ? asset.availableQty === 0 : false);
      return matchesSearch && matchesCategory && matchesAvailability;
    })),
    selectedCount: computed(() => assets().length)
  })),
  withMethods((store, assetService = inject(AssetService)) => ({
    load(): void {
      patchState(store, { loading: true, error: null });
      assetService.list().subscribe({
        next: assets => patchState(store, { assets, loading: false }),
        error: () => patchState(store, { assets: [], loading: false, error: 'Unable to load catalogue assets.' })
      });
    },
    setSearch(search: string): void { patchState(store, { search }); },
    setCategory(category: AssetCategory | 'ALL'): void { patchState(store, { category }); },
    setAvailability(availability: AssetState['availability']): void { patchState(store, { availability }); },
    clearFilters(): void { patchState(store, { search: '', category: 'ALL', availability: 'ALL' }); }
  }))
);
