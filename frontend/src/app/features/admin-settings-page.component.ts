import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminService } from '../core/api.service';
import { AuditLog } from '../core/models';

@Component({
  selector: 'jhub-admin-settings-page',
  standalone: true,
  imports: [DatePipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="settings-page">
      <header class="page-heading">
        <div>
          <p class="eyebrow">ADMINISTRATION / SETTINGS</p>
          <h1>Admin <em>settings.</em></h1>
          <p class="intro">System information, operational links, and the configuration currently exposed by the Vault.</p>
        </div>
      </header>

      <nav class="section-nav" aria-label="Settings sections">
        <a class="selected" href="#system-information"><i class="pi pi-cog"></i> General</a>
        <a routerLink="/admin/users"><i class="pi pi-users"></i> Users &amp; Roles</a>
        <a routerLink="/admin/inventory"><i class="pi pi-box"></i> Assets &amp; Inventory</a>
        <a href="#notifications"><i class="pi pi-bell"></i> Notifications</a>
        <a href="#security"><i class="pi pi-shield"></i> Security</a>
        <a routerLink="/admin/audit-log"><i class="pi pi-history"></i> Audit &amp; Logs</a>
      </nav>

      <div class="settings-grid">
        <section id="system-information" class="settings-card">
          <div class="card-heading">
            <span class="icon blue"><i class="pi pi-cog"></i></span>
            <div><h2>System Information</h2><p>Vault identity and connected service details</p></div>
          </div>
          <dl class="info-list">
            <div><dt>System name</dt><dd>JHUB Africa Vault</dd></div>
            <div><dt>API service</dt><dd>Reported by live health check</dd></div>
            <div><dt>Access</dt><dd>Administrator</dd></div>
            <div><dt>Audit trail</dt><dd>Available</dd></div>
          </dl>
        </section>

        <section class="settings-card">
          <div class="card-heading">
            <span class="icon violet"><i class="pi pi-sliders-h"></i></span>
            <div><h2>Platform Settings</h2><p>Current capabilities exposed by the API</p></div>
          </div>
          <div class="notice-box">
            <i class="pi pi-info-circle"></i>
            <p>Platform preferences are not currently exposed by a settings API. No client-side values are shown as saved settings.</p>
          </div>
          <a class="secondary-button" routerLink="/admin/inventory">Manage inventory <i class="pi pi-arrow-right"></i></a>
        </section>

        <section class="settings-card">
          <div class="card-heading">
            <span class="icon amber"><i class="pi pi-bolt"></i></span>
            <div><h2>Quick Actions</h2><p>Go to an available administration workspace</p></div>
          </div>
          <div class="quick-links">
            <a routerLink="/admin/inventory"><i class="pi pi-plus-circle"></i> Manage inventory <i class="pi pi-chevron-right"></i></a>
            <a routerLink="/admin/users"><i class="pi pi-users"></i> Manage users <i class="pi pi-chevron-right"></i></a>
            <a routerLink="/admin/requests"><i class="pi pi-inbox"></i> Review requests <i class="pi pi-chevron-right"></i></a>
            <a routerLink="/admin/audit-log"><i class="pi pi-history"></i> View audit log <i class="pi pi-chevron-right"></i></a>
          </div>
          <p class="support-note">Database backup actions are not available in the current API.</p>
        </section>

        <section class="settings-card" aria-labelledby="email-heading">
          <div class="card-heading">
            <span class="icon blue"><i class="pi pi-envelope"></i></span>
            <div><h2 id="email-heading">Email Configuration</h2><p>Mail delivery is managed by the server</p></div>
          </div>
          <div class="notice-box">
            <i class="pi pi-lock"></i>
            <p>SMTP credentials are not returned to the browser. The API has no email test or configuration endpoint, so credentials cannot be viewed or edited here.</p>
          </div>
          <p class="support-note">Approval email delivery is handled by the server's mail service when configured.</p>
        </section>

        <section id="notifications" class="settings-card">
          <div class="card-heading">
            <span class="icon violet"><i class="pi pi-bell"></i></span>
            <div><h2>Notification Preferences</h2><p>Available notifications depend on server workflows</p></div>
          </div>
          <div class="preference-row">
            <span class="status-dot green"></span>
            <span><strong>Request approval email</strong><small>Sent by the server after an approval</small></span>
            <span class="state-label">Server managed</span>
          </div>
          <div class="notice-box compact">
            <i class="pi pi-info-circle"></i>
            <p>Personal notification preferences and alert toggles are not supported by the current API.</p>
          </div>
        </section>

        <section class="settings-card status-card" aria-labelledby="status-heading">
          <div class="card-heading">
            <span class="icon green"><i class="pi pi-check-circle"></i></span>
            <div><h2 id="status-heading">System Status</h2><p>Live API and database connectivity check</p></div>
          </div>
          <div class="status-row">
            <span><i class="pi pi-server"></i> Vault API</span>
            @if (healthLoading()) {
              <span class="status-badge pending">Checking</span>
            } @else if (healthError()) {
              <span class="status-badge error">Unavailable</span>
            } @else if (health()) {
              <span class="status-badge"><i class="pi pi-circle-fill"></i> Online</span>
            } @else {
              <span class="status-badge pending">Not checked</span>
            }
          </div>
          <div class="status-row">
            <span><i class="pi pi-database"></i> Database connection</span>
            @if (healthLoading()) {
              <span class="status-badge pending">Checking</span>
            } @else if (healthError()) {
              <span class="status-badge error">Unavailable</span>
            } @else if (health()) {
              <span class="status-badge"><i class="pi pi-circle-fill"></i> Online</span>
            } @else {
              <span class="status-badge pending">Not checked</span>
            }
          </div>
          @if (healthError()) { <p class="inline-error" role="alert">{{ healthError() }}</p> }
          <div class="status-footer">
            <span>{{ checkedAt() ? ('Last checked ' + (checkedAt() | date:'medium')) : 'Status has not been checked yet' }}</span>
            <button type="button" class="text-action" [disabled]="healthLoading()" (click)="refreshStatus()">{{ healthLoading() ? 'Checking…' : 'Check again' }}</button>
          </div>
        </section>

        <section id="security" class="security-notice">
          <span class="icon blue"><i class="pi pi-shield"></i></span>
          <div><h2>Security Notice</h2><p>Admin routes and management endpoints require administrator authorization. Supported user and inventory changes are recorded in the audit log. Secrets are managed server-side and are never displayed here.</p></div>
        </section>

        <section class="settings-card audit-card">
          <div class="card-heading">
            <span class="icon amber"><i class="pi pi-history"></i></span>
            <div><h2>Recent Audit Activity</h2><p>Latest events from the connected audit service</p></div>
          </div>
          @if (auditLoading()) {
            <p class="muted-state" role="status">Loading audit activity…</p>
          } @else if (auditError()) {
            <p class="inline-error" role="alert">{{ auditError() }}</p>
          } @else if (recentAudit().length) {
            @for (entry of recentAudit(); track entry.id) {
              <div class="audit-row"><span><strong>{{ entry.action.replaceAll('_', ' ') }}</strong><small>{{ entry.actor?.fullName || 'System' }} · {{ entry.entityType }}</small></span><time>{{ entry.createdAt | date:'d MMM, h:mm a' }}</time></div>
            }
          } @else {
            <p class="muted-state">No audit activity has been recorded yet.</p>
          }
          <a class="text-action audit-link" routerLink="/admin/audit-log">View audit log <i class="pi pi-arrow-right"></i></a>
        </section>
      </div>
    </main>
  `,
  styles: [`
    :host{display:block;color:var(--ink,#172033)}
    .settings-page{width:min(1160px,calc(100% - 48px));margin:0 auto;padding:44px 0 72px}
    .page-heading{margin-bottom:20px}.eyebrow{color:var(--green,#3ea945);font-size:10px;font-weight:800;letter-spacing:2px;margin:0 0 10px}
    h1{font:400 clamp(34px,4vw,46px)/1.05 Georgia,serif;color:var(--navy,#262571);margin:0}h1 em{color:var(--green,#3ea945)}
    .intro{color:#7c8492;font-size:13px;margin:8px 0 0}
    .section-nav{display:flex;gap:5px;overflow-x:auto;padding:6px;margin-bottom:16px;background:#fff;border:1px solid #e6e8ee;border-radius:8px}
    .section-nav a{display:flex;align-items:center;gap:6px;flex:none;padding:9px 12px;border-radius:5px;color:#586174;text-decoration:none;font-size:10px;font-weight:700;white-space:nowrap}
    .section-nav a:hover,.section-nav a.selected{background:#edf3ff;color:var(--blue,#2a4695)}
    .settings-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));align-items:start;gap:14px}
    .settings-card{min-width:0;padding:17px;background:#fff;border:1px solid #e6e8ee;border-radius:8px}
    .card-heading{display:flex;align-items:center;gap:10px;margin-bottom:16px}
    .card-heading h2,.security-notice h2{margin:0;color:#172033;font-size:13px;font-weight:700}
    .card-heading p{margin:4px 0 0;color:#8993a1;font-size:9px}
    .icon{width:32px;height:32px;display:grid;place-items:center;flex:none;border-radius:8px}
    .icon.blue{background:#edf3ff;color:#2a4695}.icon.green{background:#eaf7ec;color:#3ea945}.icon.amber{background:#fff6e7;color:#c78620}.icon.violet{background:#f4effb;color:#8061b2}
    .info-list{margin:0}.info-list div{display:flex;justify-content:space-between;gap:10px;padding:8px 0;border-bottom:1px solid #edf0f4}
    .info-list div:last-child{border:0}.info-list dt{color:#7c8492;font-size:10px}.info-list dd{margin:0;color:#344054;font-size:10px;font-weight:600;text-align:right}
    .notice-box{display:flex;gap:9px;padding:11px;background:#f6f8fc;border:1px solid #edf0f4;border-radius:5px;color:#687284}
    .notice-box>i{color:var(--blue,#2a4695);font-size:12px;padding-top:2px}.notice-box p{margin:0;font-size:10px;line-height:1.5}
    .secondary-button{display:inline-flex;align-items:center;gap:7px;margin-top:12px;padding:8px 10px;border:1px solid #dce0e8;border-radius:5px;background:#fff;color:var(--blue,#2a4695);font-size:10px;font-weight:700;text-decoration:none}
    .quick-links{display:grid;gap:6px}.quick-links a{display:flex;align-items:center;gap:8px;padding:9px;border:1px solid #edf0f4;border-radius:5px;color:#586174;text-decoration:none;font-size:10px}
    .quick-links a>i:first-child{color:var(--blue,#2a4695)}.quick-links a>i:last-child{margin-left:auto;color:#8993a1;font-size:9px}.quick-links a:hover{border-color:#aab8df;background:#fafbff}
    .support-note{margin:11px 0 0;color:#8993a1;font-size:9px;line-height:1.5}
    .preference-row{display:flex;align-items:center;gap:9px;padding:10px 0;border-top:1px solid #edf0f4;border-bottom:1px solid #edf0f4}
    .preference-row>span:nth-child(2){min-width:0;display:grid;gap:4px}.preference-row strong{color:#344054;font-size:10px}.preference-row small{color:#8993a1;font-size:9px}
    .status-dot{width:8px;height:8px;border-radius:50%;flex:none}.status-dot.green{background:#3ea945}.state-label{margin-left:auto;padding:5px 7px;border-radius:10px;background:#eef2fa;color:#586174;font-size:8px;white-space:nowrap}
    .notice-box.compact{margin-top:11px}
    .status-row{display:flex;justify-content:space-between;align-items:center;gap:9px;padding:9px 0;border-bottom:1px solid #edf0f4;color:#586174;font-size:10px}
    .status-row>span:first-child{display:flex;align-items:center;gap:7px}.status-row>span:first-child i{color:#8993a1;font-size:11px}
    .status-badge{display:inline-flex;align-items:center;gap:5px;padding:5px 8px;border-radius:12px;background:#eaf7ec;color:#287c32;font-size:9px;font-weight:700;white-space:nowrap}
    .status-badge i{font-size:6px}.status-badge.pending{background:#fff6e7;color:#aa7015}.status-badge.error{background:#fff0f0;color:#c52c2d}
    .status-footer{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:12px;color:#8993a1;font-size:9px}
    .text-action{padding:0;border:0;background:transparent;color:var(--blue,#2a4695);font-size:10px;font-weight:700;text-decoration:none;white-space:nowrap;cursor:pointer}
    .text-action:disabled{opacity:.55;cursor:wait}.inline-error{margin:10px 0;color:#a51f20;font-size:10px}
    .security-notice{grid-column:1/3;display:flex;gap:11px;padding:15px;background:#f1f6ff;border:1px solid #dce8fb;border-radius:8px}
    .security-notice .icon{width:29px;height:29px}.security-notice h2{font-size:11px}.security-notice p{margin:5px 0 0;color:#687284;font-size:10px;line-height:1.5}
    .audit-card{grid-column:3}.audit-row{display:flex;justify-content:space-between;gap:8px;padding:9px 0;border-bottom:1px solid #edf0f4}
    .audit-row>span{min-width:0;display:grid;gap:4px}.audit-row strong{overflow:hidden;color:#344054;font-size:9px;text-overflow:ellipsis;text-transform:capitalize;white-space:nowrap}
    .audit-row small,.audit-row time{color:#8993a1;font-size:8px}.audit-row time{flex:none}
    .muted-state{color:#7c8492;font-size:10px}.audit-link{display:inline-flex;gap:6px;margin-top:11px}
    @media(max-width:900px){.settings-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.security-notice,.audit-card{grid-column:auto}}
    @media(max-width:620px){.settings-page{width:calc(100% - 28px);padding:30px 0 48px}.settings-grid{grid-template-columns:1fr;gap:10px}.section-nav{margin-right:-14px}.settings-card{padding:15px}.security-notice,.audit-card{grid-column:auto}}
  `]
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
