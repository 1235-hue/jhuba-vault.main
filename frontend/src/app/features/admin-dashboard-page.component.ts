import { DatePipe, PercentPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminDashboard, AdminService } from '../core/api.service';
import { AssetCategory, AuditLog, AssetRequest, RequestStatus } from '../core/models';
import { EmptyStateComponent } from '../shared/empty-state.component';
import { PageHeaderComponent } from '../shared/page-header.component';
import { ReqRefPipe } from '../shared/req-ref.pipe';
import { StatusBadgeComponent } from '../shared/status-badge.component';
import { categoryLabel, statusLabel } from '../shared/format';

const categoryColors = ['#262571', '#3ea945', '#2a4695', '#e0a02a', '#d92d3a', '#6445bd', '#2aa6a6'];
const requestStatuses = [RequestStatus.PENDING, RequestStatus.APPROVED, RequestStatus.REJECTED] as const;

@Component({
  selector: 'jhub-admin-dashboard-page',
  standalone: true,
  imports: [DatePipe, PercentPipe, RouterLink, EmptyStateComponent, PageHeaderComponent, ReqRefPipe, StatusBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-dashboard-page.component.html',
  styleUrl: './admin-dashboard-page.component.css'
})
export class AdminDashboardPageComponent {
  private readonly adminService = inject(AdminService);

  protected readonly today = new Date();
  protected readonly metrics = signal<AdminDashboard | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly systemStatus = signal<'checking' | 'online' | 'unavailable'>('checking');
  protected readonly requestStatuses = requestStatuses;
  protected readonly statusLabel = statusLabel;
  protected readonly categoryLabel = categoryLabel;

  protected readonly recentRequests = computed(() => this.metrics()?.recentRequests ?? []);
  protected readonly recentActivity = computed(() => this.metrics()?.recentActivity ?? []);

  protected readonly categoryDistribution = computed(() =>
    (this.metrics()?.categoryDistribution ?? [])
      .map((item, index) => ({ ...item, color: categoryColors[index % categoryColors.length] }))
      .filter(item => item.quantity > 0)
  );

  protected readonly categoryTotal = computed(() => this.categoryDistribution().reduce((total, item) => total + item.quantity, 0));

  protected readonly donutBackground = computed(() => {
    const total = this.categoryTotal();
    if (!total) return '#e9ecf2';
    let offset = 0;
    const slices = this.categoryDistribution().map(item => {
      const start = offset;
      offset += (item.quantity / total) * 100;
      return `${item.color} ${start}% ${offset}%`;
    });
    return `conic-gradient(${slices.join(', ')})`;
  });

  protected readonly categoryChartLabel = computed(() =>
    this.categoryDistribution().map(item => `${categoryLabel(item.category)}: ${item.quantity}`).join(', ')
  );

  protected readonly chartActivity = computed(() => {
    const activity = this.metrics()?.requestActivity ?? [];
    const byMonth = new Map(activity.map(item => [item.month, item]));
    const current = new Date();
    return Array.from({ length: 6 }, (_, index) => {
      const monthDate = new Date(current.getFullYear(), current.getMonth() - 5 + index, 1);
      const month = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
      const point = byMonth.get(month);
      return {
        month,
        label: monthDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
        shortLabel: monthDate.toLocaleDateString(undefined, { month: 'short' }),
        pending: point?.pending ?? 0,
        approved: point?.approved ?? 0,
        rejected: point?.rejected ?? 0
      };
    });
  });

  protected readonly hasRequestActivity = computed(() => this.chartActivity().some(point => point.pending + point.approved + point.rejected > 0));
  private readonly chartMaximum = computed(() => Math.max(4, ...this.chartActivity().flatMap(point => [point.pending, point.approved, point.rejected])));

  constructor() {
    this.loadDashboard();
  }

  protected reload(): void {
    this.loadDashboard();
  }

  protected chartX(index: number): number {
    return 58 + index * 106.8;
  }

  protected chartY(value: number): number {
    return 164 - (value / this.chartMaximum()) * 138;
  }

  protected chartTicks(): Array<{ value: number; y: number }> {
    const maximum = this.chartMaximum();
    return [0, Math.ceil(maximum / 2), maximum].map(value => ({ value, y: this.chartY(value) }));
  }

  protected seriesPath(status: (typeof requestStatuses)[number]): string {
    return this.chartActivity()
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${this.chartX(index)} ${this.chartY(this.requestStatusCount(point, status))}`)
      .join(' ');
  }

  protected statusColor(status: RequestStatus): string {
    if (status === RequestStatus.PENDING) return '#e0a02a';
    if (status === RequestStatus.APPROVED) return '#2a4695';
    return '#d92d3a';
  }

  protected requestStatusCount(point: { pending: number; approved: number; rejected: number }, status: (typeof requestStatuses)[number]): number {
    switch (status) {
      case RequestStatus.PENDING: return point.pending;
      case RequestStatus.APPROVED: return point.approved;
      case RequestStatus.REJECTED: return point.rejected;
    }
  }

  protected componentSummary(request: AssetRequest): string {
    return request.requestItems.map(item => `${item.asset.name} × ${item.quantity}`).join(', ');
  }

  protected activityLabel(activity: AuditLog): string {
    const action = activity.action.toLowerCase().replaceAll('_', ' ');
    return action ? action[0].toUpperCase() + action.slice(1) : 'System event';
  }

  protected activityIcon(action: string): string {
    if (action.includes('REQUEST')) return 'pi-inbox';
    if (action.includes('ASSET')) return 'pi-box';
    if (action.includes('USER')) return 'pi-user';
    return 'pi-circle-fill';
  }

  private loadDashboard(): void {
    this.loading.set(true);
    this.error.set(null);
    this.systemStatus.set('checking');
    this.adminService.dashboard().subscribe({
      next: metrics => {
        this.metrics.set(metrics);
        this.systemStatus.set('online');
        this.loading.set(false);
      },
      error: error => {
        this.systemStatus.set('unavailable');
        this.error.set(error?.error?.message || 'The dashboard data could not be loaded.');
        this.loading.set(false);
      }
    });
  }
}
