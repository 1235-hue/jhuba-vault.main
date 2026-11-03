import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RequestService } from '../core/api.service';
import { AssetRequest, RequestItem, RequestStatus } from '../core/models';
import { AuthStore } from '../state/auth.store';
import { EmptyStateComponent } from '../shared/empty-state.component';
import { PageHeaderComponent } from '../shared/page-header.component';
import { ReqRefPipe } from '../shared/req-ref.pipe';
import { StatusBadgeComponent } from '../shared/status-badge.component';

interface LoanRow {
  request: AssetRequest;
  item: RequestItem;
}

@Component({
  selector: 'jhub-innovator-dashboard-page',
  standalone: true,
  imports: [DatePipe, RouterLink, EmptyStateComponent, PageHeaderComponent, ReqRefPipe, StatusBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './innovator-dashboard-page.component.html',
  styleUrl: './innovator-dashboard-page.component.css'
})
export class InnovatorDashboardPageComponent {
  private readonly requestService = inject(RequestService);
  protected readonly auth = inject(AuthStore);
  protected readonly requests = signal<AssetRequest[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly RequestStatus = RequestStatus;
  protected readonly sortedRequests = computed(() =>
    [...this.requests()].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  );
  protected readonly recentRequests = computed(() => this.sortedRequests().slice(0, 5));
  protected readonly loanRequests = computed(() =>
    this.sortedRequests().filter(request => this.isActiveLoan(request))
  );
  protected readonly loanRows = computed<LoanRow[]>(() =>
    this.loanRequests().flatMap(request => request.requestItems.map(item => ({ request, item })))
  );
  protected readonly activeLoanCount = computed(() => this.loanRequests().length);
  protected readonly overdueLoanCount = computed(() =>
    this.loanRequests().filter(request => this.isOverdue(request)).length
  );
  protected readonly returnedItemCount = computed(() =>
    this.requests()
      .filter(request => request.status === RequestStatus.RETURNED)
      .reduce((total, request) => total + request.requestItems.reduce((items, item) => items + item.quantity, 0), 0)
  );

  constructor() {
    this.loadRequests();
  }

  protected loadRequests(): void {
    this.loading.set(true);
    this.error.set(null);
    this.requestService.listAllMine().subscribe({
      next: requests => {
        this.requests.set(requests);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Unable to load your workspace. Please try again.');
        this.loading.set(false);
      }
    });
  }

  protected count(status: RequestStatus): number {
    return this.requests().filter(request => request.status === status).length;
  }

  protected isActiveLoan(request: AssetRequest): boolean {
    return request.status === RequestStatus.CHECKED_OUT || request.status === RequestStatus.OVERDUE;
  }

  protected isOverdue(request: AssetRequest): boolean {
    if (request.status === RequestStatus.OVERDUE) return true;
    if (request.status !== RequestStatus.CHECKED_OUT || !request.expectedReturn) return false;
    const expectedReturn = new Date(request.expectedReturn).getTime();
    return !Number.isNaN(expectedReturn) && expectedReturn < Date.now();
  }

  protected requestedItems(request: AssetRequest): string {
    return request.requestItems.map(item => item.asset.name).join(', ') || '—';
  }

  protected statusLabel(status: RequestStatus): string {
    return status.replaceAll('_', ' ');
  }

  protected firstName(fullName: string): string {
    return fullName.trim().split(/\s+/)[0] || 'Innovator';
  }

  protected greeting(): string {
    return new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening';
  }
}
