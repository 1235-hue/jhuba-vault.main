import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { AssetService } from '../core/api.service';
import { Asset, AssetCategory } from '../core/models';

const now = new Date().toISOString();
export const demoAssets: Asset[] = [
  { id: 'asset-keyboard', assetTag: 'JHUB-COM-031', name: 'Mechanical Keyboard', category: AssetCategory.COMPUTING_PERIPHERALS, description: 'Durable USB keyboard for lab workstations.', price: 0, totalQuantity: 12, availableQty: 9, specifications: { Connection: 'USB-C', Layout: 'Full size' }, createdAt: now, updatedAt: now },
  { id: 'asset-dock', assetTag: 'JHUB-COM-032', name: 'USB-C Docking Station', category: AssetCategory.COMPUTING_PERIPHERALS, description: 'Multi-port docking station for shared workstations.', price: 0, totalQuantity: 8, availableQty: 6, specifications: { Ports: 'USB-C, HDMI, Ethernet' }, createdAt: now, updatedAt: now },
  { id: 'asset-esp32', assetTag: 'JHUB-IOT-001', name: 'ESP32 DevKit', category: AssetCategory.IOT_PROTOTYPING, description: 'Wi-Fi and Bluetooth enabled development board for connected prototypes.', price: 0, totalQuantity: 20, availableQty: 12, specifications: { Processor: 'Dual-core Xtensa', Connectivity: 'Wi-Fi / Bluetooth', Voltage: '3.3V' }, createdAt: now, updatedAt: now },
  { id: 'asset-pi4', assetTag: 'JHUB-IOT-014', name: 'Raspberry Pi 4', category: AssetCategory.IOT_PROTOTYPING, description: 'Compact single-board computer for software, sensing, and edge computing projects.', price: 0, totalQuantity: 10, availableQty: 6, specifications: { Memory: '4GB RAM', Connectivity: 'Wi-Fi / Bluetooth / Ethernet', Ports: 'USB 3.0' }, createdAt: now, updatedAt: now },
  { id: 'asset-router', assetTag: 'JHUB-NET-003', name: 'TP-Link Router', category: AssetCategory.NETWORKING_INFRASTRUCTURE, description: 'Reliable wireless networking equipment for demonstrations and field testing.', price: 0, totalQuantity: 12, availableQty: 8, specifications: { Standard: '802.11ac', Bands: 'Dual-band', Ports: '4 x LAN' }, createdAt: now, updatedAt: now },
  { id: 'asset-switch', assetTag: 'JHUB-NET-004', name: '8-Port Network Switch', category: AssetCategory.NETWORKING_INFRASTRUCTURE, description: 'Compact managed switch for prototyping network layouts.', price: 0, totalQuantity: 6, availableQty: 4, specifications: { Ports: '8 x Gigabit Ethernet', Type: 'Managed' }, createdAt: now, updatedAt: now },
  { id: 'asset-arduino', assetTag: 'JHUB-IOT-007', name: 'Arduino Uno R3', category: AssetCategory.IOT_PROTOTYPING, description: 'Accessible microcontroller platform for rapid electronics prototyping.', price: 0, totalQuantity: 18, availableQty: 16, specifications: { Microcontroller: 'ATmega328P', Flash: '32KB', Input: '7-12V' }, createdAt: now, updatedAt: now },
  { id: 'asset-webcam', assetTag: 'JHUB-AV-011', name: 'Logitech Webcam', category: AssetCategory.AV_PRESENTATION, description: 'HD webcam for demos, remote collaboration, and project documentation.', price: 0, totalQuantity: 8, availableQty: 3, specifications: { Resolution: '1080p', Microphone: 'Stereo', Connection: 'USB' }, createdAt: now, updatedAt: now },
  { id: 'asset-projector', assetTag: 'JHUB-AV-012', name: 'Portable Projector', category: AssetCategory.AV_PRESENTATION, description: 'Compact projector for demonstrations and presentations.', price: 0, totalQuantity: 4, availableQty: 2, specifications: { Resolution: '1080p', Connection: 'HDMI' }, createdAt: now, updatedAt: now },
  { id: 'asset-caliper', assetTag: 'JHUB-OFF-001', name: 'Digital Caliper', category: AssetCategory.OFFICE_SUPPLIES, description: 'Precision caliper for workshop measurements.', price: 0, totalQuantity: 10, availableQty: 7, specifications: { Range: '0-150mm', Display: 'LCD' }, createdAt: now, updatedAt: now },
  { id: 'asset-toolkit', assetTag: 'JHUB-OFF-002', name: 'Precision Toolkit', category: AssetCategory.OFFICE_SUPPLIES, description: 'Hand tools for electronics assembly and maintenance.', price: 0, totalQuantity: 6, availableQty: 4, specifications: { Pieces: '32', Case: 'Portable' }, createdAt: now, updatedAt: now },
  { id: 'asset-bench', assetTag: 'JHUB-FUR-001', name: 'ESD Workbench', category: AssetCategory.FURNITURE, description: 'Anti-static workbench for safe electronics assembly.', price: 0, totalQuantity: 3, availableQty: 2, specifications: { Surface: 'ESD laminate', Width: '120cm' }, createdAt: now, updatedAt: now },
  { id: 'asset-desk', assetTag: 'JHUB-FUR-002', name: 'Adjustable Lab Desk', category: AssetCategory.FURNITURE, description: 'Adjustable desk for collaborative lab work.', price: 0, totalQuantity: 5, availableQty: 3, specifications: { Height: 'Adjustable', Width: '140cm' }, createdAt: now, updatedAt: now },
  { id: 'asset-meter', assetTag: 'JHUB-IOT-021', name: 'Digital Multimeter', category: AssetCategory.IOT_PROTOTYPING, description: 'Handheld meter for measuring voltage, current, resistance, and continuity.', price: 0, totalQuantity: 5, availableQty: 4, specifications: { Display: 'LCD', Measurements: 'AC/DC voltage, current, resistance', Safety: 'CAT III' }, createdAt: now, updatedAt: now }
];

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
        next: assets => {
          const loadedTags = new Set(assets.map(asset => asset.assetTag));
          patchState(store, { assets: [...assets, ...demoAssets.filter(asset => !loadedTags.has(asset.assetTag))], loading: false });
        },
        error: () => patchState(store, { assets: demoAssets, loading: false, error: 'Unable to load catalogue assets.' })
      });
    },
    setSearch(search: string): void { patchState(store, { search }); },
    setCategory(category: AssetCategory | 'ALL'): void { patchState(store, { category }); },
    setAvailability(availability: AssetState['availability']): void { patchState(store, { availability }); },
    clearFilters(): void { patchState(store, { search: '', category: 'ALL', availability: 'ALL' }); }
  }))
);
