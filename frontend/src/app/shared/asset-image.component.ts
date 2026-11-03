import { ChangeDetectionStrategy, Component, Input, OnChanges, SimpleChanges } from '@angular/core';

@Component({
  selector: 'jhub-asset-image',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@if (url && !failed) {
    <img [src]="url" [alt]="alt" [style.object-fit]="fit" [attr.loading]="loading" decoding="async" (error)="failed = true" />
  } @else {
    <span class="fallback" role="img" [attr.aria-label]="alt + ' (no photo available)'"><i class="pi pi-box" aria-hidden="true"></i></span>
  }`,
  styles: [`
    :host { display: grid; place-items: center; width: 100%; height: 100%; min-height: 140px; overflow: hidden; background: var(--surface-2); }
    img { display: block; width: 100%; height: 100%; object-fit: cover; }
    .fallback { display: grid; place-items: center; width: 64px; height: 64px; border-radius: var(--r-xl); background: var(--navy-50); color: var(--navy); font-size: 1.6rem; }
  `]
})
export class AssetImageComponent implements OnChanges {
  @Input() url: string | null | undefined;
  @Input() alt = 'JHUB Africa asset';
  @Input() fit: 'cover' | 'contain' = 'cover';
  @Input() loading: 'eager' | 'lazy' = 'lazy';
  protected failed = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['url']) this.failed = false;
  }
}
