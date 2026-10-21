import { DatePipe, PercentPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AdminService, AdminDashboard, AdminSearchResult } from '../core/api.service';
import { AssetCategory, AuditLog, AssetRequest, RequestStatus } from '../core/models';
import { AuthStore } from '../state/auth.store';
import { BrandLogoComponent } from '../shared/brand-logo.component';
import { Subject, catchError, debounceTime, distinctUntilChanged, of, switchMap } from 'rxjs';

const categoryLabels: Record<AssetCategory, string> = {
  [AssetCategory.COMPUTING_PERIPHERALS]: 'Computing & peripherals',
  [AssetCategory.NETWORKING_INFRASTRUCTURE]: 'Networking infrastructure',
  [AssetCategory.IOT_PROTOTYPING]: 'IoT & prototyping',
  [AssetCategory.AV_PRESENTATION]: 'AV & presentation',
  [AssetCategory.OFFICE_SUPPLIES]: 'Office supplies',
  [AssetCategory.FURNITURE]: 'Furniture'
};
const categoryColors = ['#262571', '#3ea945', '#2a4695', '#e6a52d', '#dd5361', '#8d6ac4'];
const requestStatuses = [RequestStatus.PENDING, RequestStatus.APPROVED, RequestStatus.REJECTED] as const;
const statusLabels: Record<RequestStatus, string> = {
  [RequestStatus.PENDING]: 'Pending',
  [RequestStatus.APPROVED]: 'Approved',
  [RequestStatus.REJECTED]: 'Rejected',
  [RequestStatus.CHECKED_OUT]: 'Checked out',
  [RequestStatus.RETURNED]: 'Returned',
  [RequestStatus.OVERDUE]: 'Overdue'
};

@Component({
  selector: 'jhub-admin-dashboard-page',
  standalone: true,
  imports: [DatePipe, PercentPipe, FormsModule, RouterLink, BrandLogoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="dashboard page-width">
      <div class="institution-bar">
        <jhub-brand-logo logo="jkuat" variant="header"></jhub-brand-logo>
        <span>Jomo Kenyatta University<br>of Agriculture and Technology</span>
        <span class="institution-divider" aria-hidden="true"></span>
        <span class="institution-caption">JHUB AFRICA VAULT / ADMINISTRATION</span>
        <div class="administrator">
          <span class="avatar" aria-hidden="true">{{ initials() }}</span>
          <span><strong>{{ auth.user()?.fullName || 'Administrator' }}</strong><small>Administrator</small></span>
        </div>
      </div>

      <header class="heading">
        <div>
          <p class="eyebrow">ADMINISTRATION / OVERVIEW</p>
          <h1>Vault <em>overview.</em></h1>
          <p>Monitor inventory, requests, and active loans.</p>
        </div>
        <div class="header-actions">
          <a class="notification" routerLink="/admin/requests" aria-label="Review pending requests">
            <span aria-hidden="true">♧</span>
            @if (metrics()?.pendingRequests; as pending) { <b>{{ pending }}</b> }
          </a>
          <a class="primary-button" routerLink="/admin/requests">Review requests <span aria-hidden="true">→</span></a>
        </div>
      </header>

      <div class="dashboard-toolbar">
        <div class="search-wrap">
          <label class="dashboard-search">
            <span aria-hidden="true">⌕</span>
            <input
              type="search"
              aria-label="Search assets, requests, and users"
              aria-controls="admin-search-results"
              [attr.aria-expanded]="searchTerm().trim().length >= 2"
              placeholder="Search assets, requests, and users"
              [ngModel]="searchTerm()"
              (ngModelChange)="search($event)">
          </label>
          @if (searchTerm().trim().length >= 2) {
            <div id="admin-search-results" class="search-results" role="region" aria-label="Search results">
              @if (searching()) {
                <p class="search-message" role="status">Searching…</p>
              } @else if (searchError()) {
                <p class="search-message error" role="alert">{{ searchError() }}</p>
              } @else if (searchResults().length) {
                @for (result of searchResults(); track result.type + result.id) {
                  <a [routerLink]="result.href" (click)="clearSearch()">
                    <span class="result-type">{{ result.type }}</span>
                    <span class="result-copy"><strong>{{ result.label }}</strong><small>{{ result.detail }}</small></span>
                    <span aria-hidden="true">↗</span>
                  </a>
                }
              } @else {
                <p class="search-message">No matching assets, requests, or users.</p>
              }
            </div>
          }
        </div>
        <span class="live-status" [class.unavailable]="systemStatus() === 'unavailable'">
          <i aria-hidden="true"></i>
          {{ systemStatus() === 'checking' ? 'Checking system' : systemStatus() === 'online' ? 'System online' : 'System unavailable' }}
        </span>
      </div>

      @if (loading()) {
        <div class="state" role="status">Loading administration dashboard…</div>
      } @else if (error()) {
        <div class="state error" role="alert">
          <span>{{ error() }}</span>
          <button type="button" class="retry-button" (click)="reload()">Try again</button>
        </div>
      } @else if (metrics(); as data) {
        <section class="metrics" aria-label="Inventory and request summary">
          <a class="metric-card" routerLink="/admin/assets">
            <span class="metric-icon navy" aria-hidden="true">▦</span>
            <span class="metric-copy"><small>Total assets</small><strong>{{ data.totalAssets }}</strong><span>Tracked asset records</span></span>
            <span class="metric-arrow" aria-hidden="true">↗</span>
          </a>
          <a class="metric-card" routerLink="/admin/inventory">
            <span class="metric-icon green" aria-hidden="true">✓</span>
            <span class="metric-copy"><small>Available assets</small><strong>{{ data.availableInventory }}</strong><span>Units available</span></span>
            <span class="metric-arrow" aria-hidden="true">↗</span>
          </a>
          <a class="metric-card" routerLink="/admin/inventory">
            <span class="metric-icon amber" aria-hidden="true">◷</span>
            <span class="metric-copy"><small>Checked out</small><strong>{{ data.checkedOutInventory }}</strong><span>Units on loan</span></span>
            <span class="metric-arrow" aria-hidden="true">↗</span>
          </a>
          <a class="metric-card" routerLink="/admin/requests">
            <span class="metric-icon coral" aria-hidden="true">▤</span>
            <span class="metric-copy"><small>Pending requests</small><strong>{{ data.pendingRequests }}</strong><span>Awaiting review</span></span>
            <span class="metric-arrow" aria-hidden="true">↗</span>
          </a>
          <a class="metric-card" routerLink="/admin/requests">
            <span class="metric-icon violet" aria-hidden="true">△</span>
            <span class="metric-copy"><small>Overdue loans</small><strong>{{ data.overdueRequests }}</strong><span>Need attention</span></span>
            <span class="metric-arrow" aria-hidden="true">↗</span>
          </a>
        </section>

        <section class="analytics-grid" aria-label="Dashboard analytics">
          <article class="panel requests-panel">
            <div class="panel-heading">
              <div><p class="eyebrow">REQUEST ACTIVITY</p><h2>Requests overview</h2></div>
              <a class="arrow-link" routerLink="/admin/requests">View requests ↗</a>
            </div>
            <div class="chart-legend" aria-label="Request statuses">
              @for (status of requestStatuses; track status) {
                <span><i [style.background]="statusColor(status)" aria-hidden="true"></i>{{ statusLabels[status] }}</span>
              }
            </div>
            <svg class="request-chart" viewBox="0 0 600 205" role="img" aria-labelledby="request-chart-title request-chart-description" preserveAspectRatio="none">
              <title id="request-chart-title">Request activity by month</title>
              <desc id="request-chart-description">Pending, approved, and rejected requests for the last six months. The vertical axis shows request counts.</desc>
              @for (tick of chartTicks(); track tick.value) {
                <line x1="48" x2="584" [attr.y1]="tick.y" [attr.y2]="tick.y" class="chart-gridline"></line>
                <text x="38" [attr.y]="tick.y + 3" text-anchor="end" class="chart-axis-label">{{ tick.value }}</text>
              }
              @for (status of requestStatuses; track status) {
                <path [attr.d]="seriesPath(status)" fill="none" [attr.stroke]="statusColor(status)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></path>
                @for (point of chartActivity(); track point.month; let index = $index) {
                  <circle [attr.cx]="chartX(index)" [attr.cy]="chartY(requestStatusCount(point, status))" r="3.5" [attr.fill]="statusColor(status)">
                    <title>{{ point.label }} · {{ statusLabels[status] }}: {{ requestStatusCount(point, status) }}</title>
                  </circle>
                }
              }
              @for (point of chartActivity(); track point.month; let index = $index) {
                <text [attr.x]="chartX(index)" y="190" text-anchor="middle" class="chart-axis-label">{{ point.shortLabel }}</text>
              }
            </svg>
            @if (!hasRequestActivity()) {
              <p class="chart-note">No request activity has been recorded in the last six months. The graph shows the zero baseline.</p>
            }
          </article>

          <article class="panel category-panel">
            <div class="panel-heading">
              <div><p class="eyebrow">INVENTORY MIX</p><h2>Asset categories</h2></div>
              <a class="arrow-link" routerLink="/admin/inventory">View inventory ↗</a>
            </div>
            @if (categoryDistribution().length) {
              <div class="category-content">
                <div class="donut" [style.background]="donutBackground()" role="img" [attr.aria-label]="categoryChartLabel()">
                  <span><strong>{{ categoryTotal() }}</strong><small>total units</small></span>
                </div>
                <ul class="category-legend">
                  @for (category of categoryDistribution(); track category.category) {
                    <li>
                      <i [style.background]="category.color" aria-hidden="true"></i>
                      <span>{{ categoryLabels[category.category] }}</span>
                      <strong>{{ category.quantity }}</strong>
                      <small>{{ category.quantity / (categoryTotal() || 1) | percent:'1.0-0' }}</small>
                    </li>
                  }
                </ul>
              </div>
            } @else {
              <div class="chart-empty">Asset category distribution will appear when inventory is available.</div>
            }
          </article>
        </section>

        <section class="activity-grid">
          <article class="panel recent-panel">
            <div class="panel-heading">
              <div><p class="eyebrow">LATEST SUBMISSIONS</p><h2>Recent requests</h2></div>
              <a class="arrow-link" routerLink="/admin/requests">View all ↗</a>
            </div>
            @if (filteredRequests().length) {
              <div class="table-scroll">
                <table>
                  <thead><tr><th>Request</th><th>Innovator</th><th>Components</th><th>Submitted</th><th>Status</th><th><span class="visually-hidden">Open details</span></th></tr></thead>
                  <tbody>
                    @for (request of filteredRequests(); track request.id) {
                      <tr>
                        <td><a class="request-id" [routerLink]="['/app/requests', request.id]">{{ request.id.slice(0, 8) }}</a><small>{{ request.projectName }}</small></td>
                        <td>{{ request.innovator?.fullName || 'Unknown requester' }}</td>
                        <td class="components">{{ componentSummary(request) }}</td>
                        <td>{{ request.createdAt | date:'d MMM, y' }}</td>
                        <td><span class="status-badge" [class]="request.status.toLowerCase()">{{ statusLabels[request.status] }}</span></td>
                        <td><a class="row-link" [routerLink]="['/app/requests', request.id]" [attr.aria-label]="'View request for ' + request.projectName">↗</a></td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            } @else {
              <div class="empty">
                {{ searchTerm() ? 'No recent requests match your search.' : 'No requests have been submitted yet.' }}
              </div>
            }
          </article>

          <article class="panel timeline-panel">
            <div class="panel-heading">
              <div><p class="eyebrow">AUDIT TRAIL</p><h2>System activity</h2></div>
              <a class="arrow-link" routerLink="/admin/audit-log">View all ↗</a>
            </div>
            @if (filteredActivity().length) {
              <ol class="timeline">
                @for (activity of filteredActivity(); track activity.id) {
                  <li>
                    <span class="timeline-icon" aria-hidden="true">{{ activityIcon(activity.action) }}</span>
                    <div><strong>{{ activityLabel(activity) }}</strong><small>{{ activity.actor?.fullName || 'System' }} · {{ activity.createdAt | date:'d MMM, h:mm a' }}</small></div>
                  </li>
                }
              </ol>
            } @else {
              <div class="empty">
                {{ searchTerm() ? 'No activity matches your search.' : 'No audit activity has been recorded yet.' }}
              </div>
            }
          </article>
        </section>

        <section class="quick-actions">
          <div class="section-heading"><div><p class="eyebrow">ADMINISTRATION</p><h2>Quick actions</h2></div></div>
          <div class="quick-grid">
            <a routerLink="/admin/assets" class="quick-card"><span class="quick-icon" aria-hidden="true">▦</span><span><strong>Manage assets</strong><small>Add, edit, and maintain asset records.</small></span><b aria-hidden="true">↗</b></a>
            <a routerLink="/admin/requests" class="quick-card"><span class="quick-icon" aria-hidden="true">▤</span><span><strong>View requests</strong><small>Review and manage innovator requests.</small></span><b aria-hidden="true">↗</b></a>
            <a routerLink="/admin/users" class="quick-card"><span class="quick-icon" aria-hidden="true">◎</span><span><strong>Manage users</strong><small>View the innovator and administrator directory.</small></span><b aria-hidden="true">↗</b></a>
            <a routerLink="/admin/inventory" class="quick-card"><span class="quick-icon" aria-hidden="true">◫</span><span><strong>View inventory</strong><small>Monitor stock levels and availability.</small></span><b aria-hidden="true">↗</b></a>
          </div>
        </section>
      }
    </main>
  `,
  styles: [`
    :host{display:block;color:#172033}.page-width{width:min(1200px,calc(100% - 48px));margin:auto}.dashboard{padding:24px 0 88px}
    .institution-bar{display:flex;align-items:center;gap:12px;min-height:54px;padding-bottom:16px;border-bottom:1px solid #e6e8ee;color:#303b53;font-size:10px;font-weight:700;line-height:1.4}
    .institution-bar jhub-brand-logo{max-width:205px}.institution-divider{height:30px;width:1px;background:#dfe3eb;margin:0 6px}.institution-caption{font-size:9px;letter-spacing:1.2px;color:#777f91}
    .administrator{margin-left:auto;display:flex;align-items:center;gap:9px}.administrator strong,.administrator small{display:block}.administrator strong{font-size:11px}.administrator small{font-size:9px;color:#7c8492;font-weight:400}.avatar{display:grid;place-items:center;width:31px;height:31px;border-radius:50%;background:#e9edf7;color:#262571;font-weight:800}
    .heading{display:flex;align-items:end;justify-content:space-between;gap:20px;margin:30px 0 22px}.eyebrow{color:#3ea945;font-size:9px;font-weight:800;letter-spacing:1.7px;margin:0 0 9px}.heading h1{font:400 clamp(38px,5vw,54px)/1.05 Georgia,serif;color:#262571;margin:0}.heading h1 em{color:#3ea945}.heading p:last-child{color:#667083;font-size:12px;margin:9px 0 0}.header-actions{display:flex;align-items:center;gap:12px}.primary-button{display:inline-flex;align-items:center;gap:18px;background:#262571;color:#fff;text-decoration:none;padding:12px 16px;font-size:11px;font-weight:700}.primary-button:hover{background:#1e1e5c}.notification{position:relative;display:grid;place-items:center;width:39px;height:39px;border:1px solid #e3e6ed;border-radius:50%;text-decoration:none;color:#262571;font-size:18px}.notification b{position:absolute;right:-3px;top:-4px;display:grid;place-items:center;min-width:16px;height:16px;padding:0 4px;border-radius:10px;background:#e6292a;color:white;font:700 9px sans-serif}
    .dashboard-toolbar{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:16px}.dashboard-search{display:flex;align-items:center;gap:9px;width:min(400px,100%);border:1px solid #e1e5ec;background:#fff;padding:0 12px;color:#8991a0}.dashboard-search input{width:100%;height:38px;border:0;outline:0;background:transparent;color:#172033;font-size:11px}.dashboard-search:focus-within{border-color:#3ea945;box-shadow:0 0 0 2px #3ea94520}.live-status{display:flex;align-items:center;gap:7px;color:#596477;font-size:10px}.live-status i{width:7px;height:7px;border-radius:50%;background:#3ea945}
    .metrics{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin-bottom:16px}.metric-card{min-width:0;display:flex;align-items:flex-start;gap:10px;position:relative;padding:16px 12px;background:#fff;border:1px solid #e6e8ee;border-radius:7px;color:inherit;text-decoration:none;transition:border-color .15s,transform .15s}.metric-card:hover{border-color:#b6c1d5;transform:translateY(-1px)}.metric-icon{flex:0 0 32px;height:32px;display:grid;place-items:center;border-radius:7px;font-size:15px;font-weight:800}.metric-icon.navy{background:#eeedf8;color:#262571}.metric-icon.green{background:#eaf6ed;color:#2b9b45}.metric-icon.amber{background:#fff5e2;color:#db9b22}.metric-icon.coral{background:#fff0ef;color:#dc5a4e}.metric-icon.violet{background:#f5effc;color:#8d6ac4}.metric-copy{display:flex;flex-direction:column;min-width:0}.metric-copy small{text-transform:uppercase;color:#727b8c;font-size:8px;font-weight:700;letter-spacing:.7px;white-space:nowrap}.metric-copy strong{margin:7px 0 4px;color:#262571;font:400 30px/1 Georgia,serif}.metric-copy>span{color:#788193;font-size:9px}.metric-arrow{position:absolute;right:10px;top:12px;color:#98a0ae;font-size:11px}
    .analytics-grid{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,.9fr);gap:14px;margin-bottom:14px}.panel{min-width:0;background:#fff;border:1px solid #e6e8ee;border-radius:7px;padding:17px}.panel-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}.panel-heading h2,.section-heading h2{margin:0;color:#262571;font:400 23px/1.1 Georgia,serif}.arrow-link{flex:none;color:#262571;text-decoration:none;font-size:10px;font-weight:700}.arrow-link:hover{color:#3ea945}.chart-legend{display:flex;gap:15px;flex-wrap:wrap;margin:14px 0 5px}.chart-legend>span{display:flex;align-items:center;gap:5px;color:#677183;font-size:9px}.chart-legend i,.category-legend i{display:inline-block;width:7px;height:7px;border-radius:50%}
    .request-chart{display:block;width:100%;height:190px;overflow:visible}.chart-gridline{stroke:#e9edf3;stroke-width:1}.chart-axis-label{fill:#818a99;font-size:10px;font-family:'Segoe UI',sans-serif}.chart-note{margin:4px 0 0;text-align:center;color:#7c8492;font-size:9px}.category-content{display:grid;grid-template-columns:minmax(125px,.8fr) minmax(0,1.2fr);align-items:center;gap:18px;min-height:170px}.donut{width:min(160px,100%);aspect-ratio:1;border-radius:50%;position:relative;margin:auto;display:grid;place-items:center}.donut:after{content:"";position:absolute;inset:24%;border-radius:50%;background:#fff}.donut>span{position:relative;z-index:1;text-align:center}.donut strong,.donut small{display:block}.donut strong{color:#262571;font:400 24px Georgia,serif}.donut small{margin-top:4px;color:#7b8493;font-size:8px}.category-legend{list-style:none;margin:0;padding:0;display:grid;gap:8px}.category-legend li{display:grid;grid-template-columns:8px minmax(0,1fr) auto auto;align-items:center;gap:6px;min-width:0}.category-legend li>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#566174;font-size:9px}.category-legend strong{font-size:9px;color:#242d42}.category-legend small{width:29px;text-align:right;color:#8a92a0;font-size:8px}
    .activity-grid{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(250px,.9fr);gap:14px}.recent-panel{padding-bottom:10px}.table-scroll{width:100%;overflow-x:auto}table{width:100%;border-collapse:collapse;text-align:left;font-size:9px}th{padding:9px 8px;color:#858e9d;font-size:8px;font-weight:600;text-transform:uppercase;letter-spacing:.35px;border-bottom:1px solid #e9ecf1;white-space:nowrap}td{padding:10px 8px;border-bottom:1px solid #eff1f5;color:#4e596d;vertical-align:middle}tbody tr:last-child td{border-bottom:0}td:first-child{min-width:104px}.request-id{color:#2a4695;text-decoration:none;font-size:9px;font-weight:700}td small{display:block;margin-top:4px;color:#778193;font-size:8px;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.components{max-width:130px;line-height:1.4}.status-badge{display:inline-block;padding:4px 7px;border-radius:12px;font-size:8px;font-weight:700;white-space:nowrap}.status-badge.pending{background:#fff5df;color:#a87815}.status-badge.approved{background:#eaf7ee;color:#278b3e}.status-badge.rejected,.status-badge.overdue{background:#fff0ef;color:#c64d47}.status-badge.checked_out{background:#edf2ff;color:#3157a0}.status-badge.returned{background:#f1f2f5;color:#667083}.row-link{color:#2a4695;text-decoration:none;font-weight:800}.timeline{list-style:none;margin:4px 0 0;padding:0}.timeline li{position:relative;display:grid;grid-template-columns:25px minmax(0,1fr);gap:9px;padding:9px 0}.timeline li:not(:last-child):after{position:absolute;content:"";left:12px;top:34px;bottom:-5px;width:1px;background:#e5e9f0}.timeline-icon{z-index:1;display:grid;place-items:center;width:24px;height:24px;border-radius:50%;background:#edf1fa;color:#2a4695;font-size:10px}.timeline li div{min-width:0}.timeline strong,.timeline small{display:block}.timeline strong{color:#333e53;font-size:9px;line-height:1.4}.timeline small{margin-top:4px;color:#818a98;font-size:8px}.quick-actions{margin-top:22px}.section-heading{margin-bottom:12px}.quick-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.quick-card{min-width:0;display:flex;align-items:center;gap:11px;padding:15px;background:#fff;border:1px solid #e6e8ee;border-radius:7px;text-decoration:none;color:#262571;transition:background .15s,border-color .15s}.quick-card:hover{background:#fafaff;border-color:#b6c1d5}.quick-icon{flex:0 0 31px;height:31px;display:grid;place-items:center;background:#efeff8;border-radius:6px;color:#262571;font-size:14px}.quick-card>span:nth-child(2){min-width:0}.quick-card strong,.quick-card small{display:block}.quick-card strong{font-size:10px}.quick-card small{margin-top:5px;color:#7b8493;font-size:8px;line-height:1.4}.quick-card b{margin-left:auto;color:#3ea945;font-size:12px}.state{background:#fff;border:1px solid #e6e8ee;border-radius:7px;padding:28px;color:#667083;font-size:12px}.state.error{display:flex;align-items:center;justify-content:space-between;gap:20px;color:#a51f20}.retry-button{border:0;background:#262571;color:#fff;padding:10px 16px;font-size:11px;font-weight:700}.visually-hidden{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
    @media(max-width:1000px){.metrics{grid-template-columns:repeat(3,minmax(0,1fr))}.category-content{grid-template-columns:1fr}.donut{width:135px}.category-legend{gap:6px}.quick-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
    @media(max-width:760px){.page-width{width:calc(100% - 32px)}.institution-bar{gap:8px}.institution-bar jhub-brand-logo{max-width:160px}.institution-caption,.institution-divider{display:none}.heading{align-items:flex-start}.heading h1{font-size:42px}.analytics-grid,.activity-grid{grid-template-columns:1fr}.category-content{grid-template-columns:minmax(125px,.65fr) minmax(0,1.35fr)}.donut{width:min(155px,100%)}}
    @media(max-width:520px){.dashboard{padding-top:16px}.institution-bar jhub-brand-logo{max-width:125px}.institution-bar{font-size:8px}.administrator>span:last-child{display:none}.heading{display:block;margin-top:23px}.heading h1{font-size:38px}.header-actions{justify-content:flex-end;margin-top:14px}.dashboard-toolbar{align-items:flex-start}.dashboard-search{width:100%}.live-status{display:none}.metrics{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.metric-card{padding:12px 9px;gap:7px}.metric-icon{flex-basis:27px;height:27px}.metric-copy small{font-size:7px}.metric-copy strong{font-size:26px}.metric-copy>span{font-size:8px}.panel{padding:13px}.panel-heading h2,.section-heading h2{font-size:21px}.panel-heading{align-items:flex-start}.panel-heading .arrow-link{font-size:8px}.category-content{grid-template-columns:1fr;gap:14px}.category-legend{grid-template-columns:1fr 1fr;column-gap:10px}.quick-grid{grid-template-columns:1fr}.quick-card{padding:12px}.table-scroll{margin-right:-3px}table{min-width:600px}}
    @media(prefers-reduced-motion:reduce){.metric-card,.bar,.quick-card{transition:none}}
  `]
})
export class AdminDashboardPageComponent {
  protected readonly auth = inject(AuthStore);
  private readonly adminService = inject(AdminService);
  protected readonly metrics = signal<AdminDashboard | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly systemStatus = signal<'checking' | 'online' | 'unavailable'>('checking');
  protected readonly searchTerm = signal('');
  protected readonly searchResults = signal<AdminSearchResult[]>([]);
  protected readonly searching = signal(false);
  protected readonly searchError = signal<string | null>(null);
  protected readonly requestStatuses = requestStatuses;
  protected readonly statusLabels = statusLabels;
  protected readonly categoryLabels = categoryLabels;

  protected readonly initials = computed(() => (this.auth.user()?.fullName || 'Administrator')
    .split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase());
  protected readonly recentRequests = computed(() => this.metrics()?.recentRequests ?? []);
  protected readonly recentActivity = computed(() => this.metrics()?.recentActivity ?? []);
  protected readonly filteredRequests = computed(() => {
    const query = this.searchTerm().trim().toLocaleLowerCase();
    return this.recentRequests().filter(request => !query
      || `${request.id} ${request.projectName} ${request.innovator?.fullName ?? ''} ${this.componentSummary(request)}`
        .toLocaleLowerCase().includes(query));
  });
  protected readonly filteredActivity = computed(() => {
    const query = this.searchTerm().trim().toLocaleLowerCase();
    return this.recentActivity().filter(activity => !query
      || `${activity.action} ${activity.entityType} ${activity.actor?.fullName ?? ''}`
        .toLocaleLowerCase().includes(query));
  });
  protected readonly categoryDistribution = computed(() => (this.metrics()?.categoryDistribution ?? [])
    .map((item, index) => ({ ...item, color: categoryColors[index % categoryColors.length] })
    ).filter(item => item.quantity > 0));
  protected readonly categoryTotal = computed(() => this.categoryDistribution()
    .reduce((total, item) => total + item.quantity, 0));
  protected readonly donutBackground = computed(() => {
    const total = this.categoryTotal();
    if (!total) return '#e9ecf2';
    let offset = 0;
    const slices = this.categoryDistribution().map(item => {
      const start = offset;
      offset += item.quantity / total * 100;
      return `${item.color} ${start}% ${offset}%`;
    });
    return `conic-gradient(${slices.join(', ')})`;
  });
  protected readonly categoryChartLabel = computed(() => this.categoryDistribution()
    .map(item => `${categoryLabels[item.category]}: ${item.quantity}`).join(', '));
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
  protected readonly hasRequestActivity = computed(() => this.chartActivity()
    .some(point => point.pending + point.approved + point.rejected > 0));
  private readonly chartMaximum = computed(() => Math.max(
    4,
    ...this.chartActivity().flatMap(point => [point.pending, point.approved, point.rejected])
  ));
  private readonly searchInput = new Subject<string>();

  constructor() {
    this.loadDashboard();
    this.searchInput.pipe(
      debounceTime(220),
      distinctUntilChanged(),
      switchMap(query => {
        const normalized = query.trim();
        this.searchError.set(null);
        if (normalized.length < 2) {
          this.searching.set(false);
          this.searchResults.set([]);
          return of([]);
        }
        this.searching.set(true);
        return this.adminService.search(normalized).pipe(catchError(error => {
          console.error('Admin search error:', error);
          this.searchError.set('Unable to search the Vault right now.');
          return of([]);
        }));
      })
    ).subscribe(results => {
      this.searchResults.set(results);
      this.searching.set(false);
    });
  }

  protected reload(): void {
    this.loadDashboard();
  }

  protected search(query: string): void {
    this.searchTerm.set(query);
    this.searchInput.next(query);
  }

  protected clearSearch(): void {
    this.search('');
  }

  protected chartX(index: number): number {
    return 58 + index * 106.8;
  }

  protected chartY(value: number): number {
    return 164 - value / this.chartMaximum() * 138;
  }

  protected chartTicks(): Array<{ value: number; y: number }> {
    const maximum = this.chartMaximum();
    return [0, Math.ceil(maximum / 2), maximum].map(value => ({
      value,
      y: this.chartY(value)
    }));
  }

  protected seriesPath(status: typeof requestStatuses[number]): string {
    return this.chartActivity().map((point, index) => {
      const command = index === 0 ? 'M' : 'L';
      return `${command} ${this.chartX(index)} ${this.chartY(this.requestStatusCount(point, status))}`;
    }).join(' ');
  }

  protected statusColor(status: RequestStatus): string {
    if (status === RequestStatus.PENDING) return '#e6a52d';
    if (status === RequestStatus.APPROVED) return '#3ea945';
    return '#dd5361';
  }

  protected requestStatusCount(
    point: { pending: number; approved: number; rejected: number },
    status: typeof requestStatuses[number]
  ): number {
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
    if (action.includes('REQUEST')) return '↗';
    if (action.includes('ASSET')) return '▦';
    if (action.includes('USER')) return '◎';
    return '•';
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
        console.error('Admin dashboard error:', error);
        this.systemStatus.set('unavailable');
        this.error.set(error?.error?.message || 'Unable to load the administration dashboard.');
        this.loading.set(false);
      }
    });
  }
}
