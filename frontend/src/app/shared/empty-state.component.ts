import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'jhub-empty',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="empty">
      <span class="empty-icon" [class.is-danger]="tone === 'danger'" aria-hidden="true"><i class="pi" [class]="'pi ' + icon"></i></span>
      <h3>{{ title }}</h3>
      @if (text) { <p>{{ text }}</p> }
      <div class="empty-actions"><ng-content></ng-content></div>
    </div>
  `,
  styles: [`:host { display: block; } .empty-actions:empty { display: none; }`]
})
export class EmptyStateComponent {
  @Input() icon = 'pi-inbox';
  @Input({ required: true }) title = '';
  @Input() text = '';
  @Input() tone: 'neutral' | 'danger' = 'neutral';
}
