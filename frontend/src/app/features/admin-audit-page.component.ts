import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../core/api.service';
import { AuditLog } from '../core/models';
import { EmptyStateComponent } from '../shared/empty-state.component';
import { ModalComponent } from '../shared/modal.component';
import { PageHeaderComponent } from '../shared/page-header.component';

@Component({
  selector: 'jhub-admin-audit-page',
  standalone: true,
  imports: [DatePipe, FormsModule, EmptyStateComponent, ModalComponent, PageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-audit-page.component.html',
  styleUrl: './admin-audit-page.component.css'
})
export class AdminAuditPageComponent {
  private readonly admin = inject(AdminService);

  protected readonly logs = signal<AuditLog[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly search = signal('');
  protected readonly entity = signal('ALL');
  protected readonly dateFrom = signal('');
  protected readonly dateTo = signal('');
  protected readonly page = signal(1);
  protected readonly pageSize = signal(10);
  protected readonly selected = signal<AuditLog | null>(null);

  protected readonly entities = computed(() => [...new Set(this.logs().map(log => log.entityType))].sort());
  protected readonly userActions = computed(() => this.logs().filter(log => !!log.actor).length);
  protected readonly systemActions = computed(() => this.logs().filter(log => !log.actor).length);

  protected readonly filtered = computed(() => {
    const query = this.search().trim().toLowerCase();
    const entity = this.entity();
    const from = this.dateFrom() ? new Date(this.dateFrom() + 'T00:00:00').getTime() : null;
    const to = this.dateTo() ? new Date(this.dateTo() + 'T23:59:59').getTime() : null;
    return this.logs().filter(log => {
      const time = new Date(log.createdAt).getTime();
      const haystack = `${log.action} ${log.entityType} ${log.entityId} ${log.actor?.fullName ?? ''} ${log.actor?.email ?? ''}`.toLowerCase();
      return (!query || haystack.includes(query)) && (entity === 'ALL' || log.entityType === entity) && (from === null || time >= from) && (to === null || time <= to);
    });
  });

  protected readonly pageCount = computed(() => Math.max(1, Math.ceil(this.filtered().length / this.pageSize())));
  protected readonly rows = computed(() => this.filtered().slice((this.page() - 1) * this.pageSize(), this.page() * this.pageSize()));
  protected readonly start = computed(() => (this.filtered().length ? (this.page() - 1) * this.pageSize() + 1 : 0));
  protected readonly end = computed(() => Math.min(this.page() * this.pageSize(), this.filtered().length));
  protected readonly hasFilters = computed(() => !!(this.search() || this.dateFrom() || this.dateTo() || this.entity() !== 'ALL'));

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.admin.auditLog().subscribe({
      next: logs => {
        this.logs.set(logs);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Check your connection and try again.');
        this.loading.set(false);
      }
    });
  }

  protected update<T>(target: { set(value: T): void }, value: T): void {
    target.set(value);
    this.page.set(1);
  }

  protected setPageSize(size: number): void {
    this.pageSize.set(Number(size));
    this.page.set(1);
  }

  protected goTo(page: number): void {
    this.page.set(Math.min(Math.max(1, page), this.pageCount()));
  }

  protected clear(): void {
    this.search.set('');
    this.entity.set('ALL');
    this.dateFrom.set('');
    this.dateTo.set('');
    this.page.set(1);
  }

  protected label(action: string): string {
    const text = action.replaceAll('_', ' ').toLowerCase();
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  protected metadata(log: AuditLog): string {
    return log.metadata && Object.keys(log.metadata).length ? JSON.stringify(log.metadata, null, 2) : '';
  }
}
