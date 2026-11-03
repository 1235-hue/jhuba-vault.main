import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

export interface Crumb {
  label: string;
  link?: string;
}

@Component({
  selector: 'jhub-page-header',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="page-head">
      <div class="page-head-copy">
        @if (crumbs.length) {
          <nav class="breadcrumb" aria-label="Breadcrumb">
            @for (crumb of crumbs; track crumb.label; let last = $last) {
              @if (crumb.link && !last) {
                <a [routerLink]="crumb.link">{{ crumb.label }}</a>
                <i class="pi pi-chevron-right" aria-hidden="true"></i>
              } @else {
                <span [attr.aria-current]="last ? 'page' : null">{{ crumb.label }}</span>
                @if (!last) { <i class="pi pi-chevron-right" aria-hidden="true"></i> }
              }
            }
          </nav>
        }
        <h1>{{ title }}</h1>
        @if (subtitle) { <p class="page-sub">{{ subtitle }}</p> }
      </div>
      <div class="page-actions"><ng-content></ng-content></div>
    </header>
  `,
  styles: [`:host { display: block; } .page-actions:empty { display: none; }`]
})
export class PageHeaderComponent {
  @Input({ required: true }) title = '';
  @Input() subtitle = '';
  @Input() crumbs: Crumb[] = [];
}
