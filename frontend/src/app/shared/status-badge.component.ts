import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RequestStatus } from '../core/models';
import { statusLabel } from './format';

@Component({
  selector: 'jhub-status',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="badge" [class]="'badge badge-' + tone">{{ label }}</span>`,
  styles: [`:host { display: inline-flex; }`]
})
export class StatusBadgeComponent {
  @Input({ required: true }) status!: RequestStatus | string;

  protected get tone(): string {
    return String(this.status).toLowerCase();
  }

  protected get label(): string {
    return statusLabel(this.status);
  }
}
