import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { RequestService } from '../core/api.service';
import { AssetRequest, RequestStatus } from '../core/models';
import { EmptyStateComponent } from '../shared/empty-state.component';
import { PageHeaderComponent } from '../shared/page-header.component';
import { ReqRefPipe } from '../shared/req-ref.pipe';
import { StatusBadgeComponent } from '../shared/status-badge.component';
import { statusLabel } from '../shared/format';

type Filter = 'ALL' | RequestStatus;

@Component({
  selector: 'jhub-request-history-page',
  standalone: true,
  imports: [DatePipe, RouterLink, EmptyStateComponent, PageHeaderComponent, ReqRefPipe, StatusBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './request-history-page.component.html',
  styleUrl: './request-history-page.component.css'
})
export class RequestHistoryPageComponent {
  private readonly service = inject(RequestService);
  /** The same screen serves "My requests" and "Active loans". */
  protected readonly loansView = inject(ActivatedRoute).snapshot.data['view'] === 'loans';

  protected readonly requests = signal<AssetRequest[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly filter = signal<Filter>('ALL');
  protected readonly statusLabel = statusLabel;

  protected readonly scoped = computed(() =>
    this.loansView
      ? this.requests().filter(request => request.status === RequestStatus.CHECKED_OUT || request.status === RequestStatus.OVERDUE)
      : this.requests()
  );

  protected readonly filters = computed(() => {
    const statuses = [RequestStatus.PENDING, RequestStatus.APPROVED, RequestStatus.CHECKED_OUT, RequestStatus.OVERDUE, RequestStatus.RETURNED, RequestStatus.REJECTED];
    return statuses
      .map(status => ({ status, count: this.scoped().filter(request => request.status === status).length }))
      .filter(entry => entry.count > 0);
  });

  protected readonly visible = computed(() => {
    const filter = this.filter();
    return [...this.scoped()]
      .filter(request => filter === 'ALL' || request.status === filter)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  });

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.service.listAllMine().subscribe({
      next: requests => {
        this.requests.set(requests);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Check your connection and try again.');
        this.loading.set(false);
      }
    });
  }

  protected itemSummary(request: AssetRequest): string {
    return request.requestItems.map(item => `${item.asset.name} × ${item.quantity}`).join(', ') || '—';
  }
}
