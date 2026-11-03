import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { Asset, AssetCategory } from './core/models';
import { LandingPageComponent } from './features/landing-page.component';

function makeAsset(id: string, overrides: Partial<Asset> = {}): Asset {
  return {
    id,
    assetTag: `TAG-${id}`,
    name: `Equipment ${id}`,
    category: AssetCategory.IOT_PROTOTYPING,
    description: `Description for ${id}`,
    price: 0,
    totalQuantity: 3,
    availableQty: 2,
    imageUrl: null,
    specifications: {},
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides
  };
}

describe('LandingPageComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LandingPageComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]
    }).compileComponents();
  });

  it('renders the headline and primary sections with a catalogue fallback for empty inventory', () => {
    const fixture = TestBed.createComponent(LandingPageComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne('/api/assets').flush({ success: true, data: [] });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('h1').textContent).toContain('Build the future');
    expect(fixture.nativeElement.querySelector('#categories')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('#how-it-works')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.showcase-empty h2').textContent).toContain('Ready for your next idea');
    expect(fixture.nativeElement.querySelector('.showcase-empty a').getAttribute('href')).toBe('/catalogue');

    fixture.destroy();
    http.verify();
  });

  it('shows up to four real inventory items and navigates to the selected asset', () => {
    const fixture = TestBed.createComponent(LandingPageComponent);
    const http = TestBed.inject(HttpTestingController);
    const assets = Array.from({ length: 5 }, (_, index) => makeAsset(`asset-${index + 1}`));
    fixture.detectChanges();
    http.expectOne('/api/assets').flush({ success: true, data: assets });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.pagination-dot').length).toBe(4);
    expect(fixture.nativeElement.querySelector('.showcase-name').textContent).toContain('Equipment asset-1');
    fixture.nativeElement.querySelector('.showcase-next').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.showcase-name').textContent).toContain('Equipment asset-2');
    expect(fixture.nativeElement.querySelector('.showcase-image-link').getAttribute('href')).toBe('/assets/asset-2');
    fixture.nativeElement.querySelector('.showcase').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.showcase-name').textContent).toContain('Equipment asset-3');

    fixture.destroy();
    http.verify();
  });

  it('shows the branded image fallback when a featured image fails', () => {
    const fixture = TestBed.createComponent(LandingPageComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne('/api/assets').flush({
      success: true,
      data: [makeAsset('broken', { imageUrl: 'data:image/png;base64,invalid' })]
    });
    fixture.detectChanges();

    fixture.nativeElement.querySelector('.showcase-image img').dispatchEvent(new Event('error'));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.showcase-image .fallback').getAttribute('aria-label'))
      .toContain('Equipment broken');

    fixture.destroy();
    http.verify();
  });

  it('shows an explicit inventory error fallback', () => {
    const fixture = TestBed.createComponent(LandingPageComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne('/api/assets').flush('Unavailable', { status: 503, statusText: 'Service Unavailable' });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.showcase-empty h2').textContent).toContain('Explore the catalogue');
    expect(fixture.nativeElement.querySelector('.hero-live').textContent).toContain('temporarily unavailable');

    fixture.destroy();
    http.verify();
  });
});
