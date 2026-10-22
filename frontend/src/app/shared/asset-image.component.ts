import { ChangeDetectionStrategy, Component, Input, OnChanges, SimpleChanges } from '@angular/core';

@Component({
  selector: 'jhub-asset-image',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@if (url && !failed) { <img [src]="url" [alt]="alt" [style.object-fit]="fit" [attr.loading]="loading" decoding="async" (error)="failed = true"> } @else { <span class="asset-fallback" aria-hidden="true">⌁</span> }`,
  styles: [`:host{display:grid;place-items:center;width:100%;height:100%;min-height:140px;background:#e8f1e9;overflow:hidden}.asset-fallback{font:76px Georgia,serif;color:#3ea945}img{display:block;width:100%;height:100%;object-fit:cover}`]
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
