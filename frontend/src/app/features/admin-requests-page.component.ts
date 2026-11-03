import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, finalize, forkJoin, Subject } from 'rxjs';
import { AdminRequestCounts, RequestService } from '../core/api.service';
import { AssetRequest, RequestStatus } from '../core/models';
import { ConfirmService } from '../core/confirm.service';
import { ToastService } from '../core/toast.service';
import { EmptyStateComponent } from '../shared/empty-state.component';
import { PageHeaderComponent } from '../shared/page-header.component';
import { ReqRefPipe } from '../shared/req-ref.pipe';
import { StatusBadgeComponent } from '../shared/status-badge.component';
import { initials as makeInitials, statusLabel as makeStatusLabel } from '../shared/format';

const DEFAULT_PAGE_SIZE = 8;
const PAGE_SIZES = [8, 16, 32] as const;

@Component({
  selector: 'jhub-admin-requests-page',
  standalone: true,
  imports: [DatePipe, FormsModule, RouterLink, EmptyStateComponent, PageHeaderComponent, ReqRefPipe, StatusBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-requests-page.component.html',
  styleUrl: './admin-requests-page.component.css'
})
export class AdminRequestsPageComponent {
  private readonly service = inject(RequestService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly searchChanges = new Subject<string>();
  protected readonly statuses = Object.values(RequestStatus);
  protected readonly pageSizes = PAGE_SIZES;
  protected readonly RequestStatus = RequestStatus;
  protected readonly today = new Date();
  protected readonly requests = signal<AssetRequest[]>([]);
  protected readonly loading = signal(true);
  protected readonly pageError = signal<string | null>(null);
  protected readonly statusCounts = signal<AdminRequestCounts | null>(null);
  protected readonly search = signal('');
  protected readonly status = signal<RequestStatus | ''>('');
  protected readonly dateFrom = signal('');
  protected readonly dateTo = signal('');
  protected readonly page = signal(1);
  protected readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  protected readonly filteredTotal = signal(0);
  protected readonly totalPages = signal(1);
  protected readonly busyId = signal<string | null>(null);
  protected readonly filterMenuOpen = signal(false);
  protected readonly totalRequests = computed(() => this.statusCounts()?.total ?? null);
  protected readonly pageStart = computed(() => this.filteredTotal() === 0 ? 0 : (this.page() - 1) * this.pageSize() + 1);
  protected readonly pageEnd = computed(() => Math.min(this.page() * this.pageSize(), this.filteredTotal()));
  protected readonly pageNumbers = computed(() => {
    const count = Math.min(5, this.totalPages());
    const start = Math.max(1, Math.min(this.page() - 2, this.totalPages() - count + 1));
    return Array.from({ length: count }, (_, index) => start + index);
  });

  constructor() {
    this.searchChanges.pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed()).subscribe(() => {
      this.page.set(1);
      this.loadPage();
    });
    this.loadPage();
  }

  protected onSearch(value: string): void {
    this.search.set(value);
    this.searchChanges.next(value);
  }

  protected setStatus(value: RequestStatus | '', closeMenu = true): void {
    this.status.set(value);
    this.page.set(1);
    if (closeMenu) this.filterMenuOpen.set(false);
    this.loadPage();
  }

  protected applyDateFilters(): void {
    this.page.set(1);
    this.filterMenuOpen.set(false);
    this.loadPage();
  }

  protected clearFilters(): void {
    this.status.set('');
    this.dateFrom.set('');
    this.dateTo.set('');
    this.page.set(1);
    this.filterMenuOpen.set(false);
    this.loadPage();
  }

  protected toggleFilterMenu(): void {
    this.filterMenuOpen.update(open => !open);
  }

  protected setPageSize(size: number): void {
    if (!this.pageSizes.some(option => option === size)) return;
    this.pageSize.set(size);
    this.page.set(1);
    this.loadPage();
  }





  protected goToPage(page: number): void {
    if (page < 1 || page > this.totalPages() || page === this.page()) return;
    this.page.set(page);
    this.loadPage();
  }

  protected loadPage(): void {
    this.loading.set(true);
    this.pageError.set(null);
    this.service.listAdminPage({
      search: this.search().trim() || undefined,
      status: this.status() || undefined,
      dateFrom: this.dateFrom() || undefined,
      dateTo: this.dateTo() || undefined,
      page: this.page(),
      limit: this.pageSize()
    }).subscribe({
      next: result => {
        if (result.statusCounts) {
          this.statusCounts.set(result.statusCounts);
        } else if (!this.statusCounts()) {
          this.loadStatusCounts();
        }
        const pageCount = Math.max(1, result.totalPages);
        if (this.page() > pageCount) {
          this.page.set(pageCount);
          this.loadPage();
          return;
        }
        this.requests.set(result.items);
        this.filteredTotal.set(result.total);
        this.totalPages.set(pageCount);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.pageError.set(this.requestErrorMessage(error));
        this.loading.set(false);
      }
    });
  }

  private loadStatusCounts(): void {
    const queries = this.statuses.map(status => this.service.listAdminPage({ status, page: 1, limit: 1 }));
    forkJoin([this.service.listAdminPage({ page: 1, limit: 1 }), ...queries]).subscribe({
      next: ([all, ...counts]) => {
        const statusCounts = Object.fromEntries(this.statuses.map((status, index) => [status, counts[index].total])) as Record<RequestStatus, number>;
        this.statusCounts.set({ ...statusCounts, total: all.total });
      },
      error: (error: unknown) => this.pageError.set(this.requestErrorMessage(error))
    });
  }

  private requestErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse && error.status === 401) {
      return 'Sign in with an administrator account to view requests.';
    }
    if (error instanceof HttpErrorResponse && error.status === 403) return 'Your account is not allowed to manage requests.';
    return 'Live request data is unavailable. Check the backend connection and try again.';
  }

  private async act(request: AssetRequest, operation: (id: string) => ReturnType<RequestService['approve']>, success: string): Promise<void> {
    this.busyId.set(request.id);
    operation(request.id).pipe(finalize(() => this.busyId.set(null))).subscribe({
      next: () => {
        this.toast.success(`${request.projectName} — ${success.toLowerCase()}.`, success);
        this.loadPage();
      },
      error: () => this.toast.error('The request could not be updated. Try again.', 'Update failed')
    });
  }

  protected async approve(request: AssetRequest): Promise<void> {
    const { confirmed } = await this.confirm.ask({
      title: 'Approve this request?',
      message: `“${request.projectName}” will be approved and the innovator can collect the equipment.`,
      confirmLabel: 'Approve request'
    });
    if (confirmed) await this.act(request, id => this.service.approve(id), 'Request approved');
  }

  protected async reject(request: AssetRequest): Promise<void> {
    const { confirmed, reason } = await this.confirm.ask({
      title: 'Reject this request?',
      message: `The innovator will see your reason for rejecting “${request.projectName}”.`,
      confirmLabel: 'Reject request',
      tone: 'danger',
      reason: { label: 'Reason for rejection', placeholder: 'e.g. The requested quantity isn’t available for these dates.' }
    });
    if (confirmed) await this.act(request, id => this.service.reject(id, reason), 'Request rejected');
  }

  protected async checkout(request: AssetRequest): Promise<void> {
    const { confirmed } = await this.confirm.ask({
      title: 'Check out this equipment?',
      message: `Confirm that the equipment for “${request.projectName}” has been handed over. Stock will be reduced.`,
      confirmLabel: 'Check out'
    });
    if (confirmed) await this.act(request, id => this.service.checkout(id), 'Equipment checked out');
  }

  protected async returnRequest(request: AssetRequest): Promise<void> {
    const { confirmed } = await this.confirm.ask({
      title: 'Mark as returned?',
      message: `Confirm that all equipment for “${request.projectName}” is back in the Vault. Stock will be restored.`,
      confirmLabel: 'Mark returned',
      tone: 'success'
    });
    if (confirmed) await this.act(request, id => this.service.returnAsset(id), 'Equipment returned');
  }

  protected resetAll(): void {
    this.search.set('');
    this.clearFilters();
  }

  protected readonly initials = (name?: string | null) => makeInitials(name, 'AD');
  protected readonly statusLabel = makeStatusLabel;

  protected countFor(status: RequestStatus): number | '—' {
    return this.statusCounts()?.[status] ?? '—';
  }
}
