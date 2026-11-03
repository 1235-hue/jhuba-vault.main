import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminService } from '../core/api.service';
import { AuditLog } from '../core/models';
import { PageHeaderComponent } from '../shared/page-header.component';

@Component({
  selector: 'jhub-admin-settings-page',
  standalone: true,
  imports: [DatePipe, RouterLink, PageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-settings-page.component.html',
  styleUrl: './admin-settings-page.component.css'
})
export class AdminSettingsPageComponent {
  private readonly adminService = inject(AdminService);
  protected readonly health = signal<boolean | null>(null);
  protected readonly healthLoading = signal(false);
  protected readonly healthError = signal<string | null>(null);
  protected readonly checkedAt = signal<Date | null>(null);
  protected readonly recentAudit = signal<AuditLog[]>([]);
  protected readonly auditLoading = signal(true);
  protected readonly auditError = signal<string | null>(null);

  constructor() {
    this.refreshStatus();
    this.loadAudit();
  }

  protected refreshStatus(): void {
    this.healthLoading.set(true);
    this.healthError.set(null);
    this.adminService.health().subscribe({
      next: result => {
        this.health.set(result.status === 'ok');
        this.checkedAt.set(new Date());
        this.healthLoading.set(false);
      },
      error: () => {
        this.health.set(false);
        this.healthError.set('Unable to reach the API health endpoint.');
        this.checkedAt.set(new Date());
        this.healthLoading.set(false);
      }
    });
  }

  private loadAudit(): void {
    this.adminService.auditLog().subscribe({
      next: logs => {
        this.recentAudit.set(logs.slice(0, 4));
        this.auditLoading.set(false);
      },
      error: () => {
        this.auditError.set('Unable to load recent audit activity.');
        this.auditLoading.set(false);
      }
    });
  }
}
