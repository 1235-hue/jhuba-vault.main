import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RequestStore } from '../state/request.store';
import { ConfirmService } from '../core/confirm.service';
import { EmptyStateComponent } from '../shared/empty-state.component';
import { PageHeaderComponent } from '../shared/page-header.component';

@Component({
  selector: 'jhub-request-cart-page',
  standalone: true,
  imports: [RouterLink, EmptyStateComponent, PageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './request-cart-page.component.html',
  styleUrl: './request-cart-page.component.css'
})
export class RequestCartPageComponent {
  protected readonly request = inject(RequestStore);
  private readonly confirm = inject(ConfirmService);

  protected async clear(): Promise<void> {
    const result = await this.confirm.ask({
      title: 'Clear your request cart?',
      message: 'All selected equipment will be removed. You can add it again from the catalogue.',
      confirmLabel: 'Clear cart',
      tone: 'danger'
    });
    if (result.confirmed) this.request.clearItems();
  }
}
