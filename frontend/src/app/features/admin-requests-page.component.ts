import { DatePipe, UpperCasePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, finalize, forkJoin, Subject } from 'rxjs';
import { AdminDashboard, AdminService, RequestService } from '../core/api.service';
import { Asset, AssetCategory, AssetRequest, RequestStatus, Role } from '../core/models';
import { BrandLogoComponent } from '../shared/brand-logo.component';
import { AuthStore } from '../state/auth.store';

const PAGE_SIZE = 8;
const PREVIEW_ROWS = [
  { id: 'REQ-0012', projectName: 'Smart Greenhouse Monitoring', projectAbstract: 'Automated temperature monitoring for greenhouse farming.', innovatorName: 'John Mwangi', identificationId: 'STU12545', loanDays: 30, createdAt: '2025-04-24T10:30:00', status: RequestStatus.PENDING, assets: [['Raspberry Pi 4', 4], ['Sensor Kit', 3]] },
  { id: 'REQ-0011', projectName: 'AI-Powered Waste Sorting Machine', projectAbstract: 'Machine learning for waste separation.', innovatorName: 'Aisha Wangari', identificationId: 'STU17890', loanDays: 45, createdAt: '2025-04-20T14:15:00', status: RequestStatus.APPROVED, assets: [['Arduino Uno', 2], ['Camera Module', 2]] },
  { id: 'REQ-0010', projectName: 'Campus Network Upgrade', projectAbstract: 'Improving campus network connectivity.', innovatorName: 'Brian Otieno', identificationId: 'STU45678', loanDays: 60, createdAt: '2025-04-18T11:45:00', status: RequestStatus.CHECKED_OUT, assets: [['Network Switch', 1], ['Access Point', 4]] },
  { id: 'REQ-0009', projectName: 'Weather Station IoT', projectAbstract: 'Environmental monitoring system.', innovatorName: 'Sarah Kimani', identificationId: 'STU57685', loanDays: 30, createdAt: '2025-04-15T09:20:00', status: RequestStatus.RETURNED, assets: [['Sensor Kit', 2], ['Raspberry Pi', 1]] },
  { id: 'REQ-0008', projectName: 'Robotics Prototype', projectAbstract: 'Autonomous delivery robot.', innovatorName: 'David Ochieng', identificationId: 'STU54321', loanDays: 45, createdAt: '2025-04-10T13:30:00', status: RequestStatus.REJECTED, assets: [['Arduino Uno', 2], ['Motor Driver', 1]] },
  { id: 'REQ-0007', projectName: 'Smart Farm Irrigation', projectAbstract: 'Automated irrigation system.', innovatorName: 'Grace Njeri', identificationId: 'STU77223', loanDays: 30, createdAt: '2025-04-08T15:10:00', status: RequestStatus.PENDING, assets: [['Raspberry Pi', 2], ['Soil Moisture Sensor', 5]] },
  { id: 'REQ-0006', projectName: 'Drone Surveillance', projectAbstract: 'Campus security monitoring.', innovatorName: 'Peter Kamau', identificationId: 'STU67878', loanDays: 60, createdAt: '2025-04-05T10:00:00', status: RequestStatus.APPROVED, assets: [['Drone', 1], ['Extra Battery', 3]] },
  { id: 'REQ-0005', projectName: 'Smart Classroom System', projectAbstract: 'Interactive learning tools.', innovatorName: 'Mercy Achieng', identificationId: 'STU33445', loanDays: 30, createdAt: '2025-04-02T16:25:00', status: RequestStatus.CHECKED_OUT, assets: [['Laptop', 2], ['Projector', 1]] }
] satisfies Array<{
  id: string;
  projectName: string;
  projectAbstract: string;
  innovatorName: string;
  identificationId: string;
  loanDays: number;
  createdAt: string;
  status: RequestStatus;
  assets: Array<[string, number]>;
}>;

const PREVIEW_REQUESTS: AssetRequest[] = PREVIEW_ROWS.map((row, index) => {
  const innovatorId = `preview-innovator-${index + 1}`;
  const createdAt = new Date(row.createdAt).toISOString();
  return {
    id: row.id,
    projectName: row.projectName,
    projectAbstract: row.projectAbstract,
    loanDays: row.loanDays,
    status: row.status,
    startDate: createdAt,
    innovatorId,
    innovator: {
      id: innovatorId,
      fullName: row.innovatorName,
      email: '',
      phoneNumber: '',
      identificationId: row.identificationId,
      department: '',
      role: Role.INNOVATOR
    },
    teamMembers: [],
    requestItems: row.assets.map(([name, quantity], itemIndex) => {
      const assetId = `preview-asset-${index + 1}-${itemIndex + 1}`;
      const asset: Asset = {
        id: assetId,
        assetTag: assetId.toUpperCase(),
        name,
        category: AssetCategory.IOT_PROTOTYPING,
        description: name,
        price: 0,
        totalQuantity: quantity,
        availableQty: quantity,
        specifications: {},
        createdAt,
        updatedAt: createdAt
      };
      return { id: assetId, assetId, quantity, requestId: row.id, asset };
    }),
    createdAt,
    updatedAt: createdAt
  };
});

const PREVIEW_DASHBOARD: AdminDashboard = {
  totalAssets: 0,
  availableInventory: 0,
  pendingRequests: 16,
  approvedRequests: 18,
  checkedOutRequests: 0,
  returnedRequests: 0,
  overdueRequests: 3,
  users: 0
};

@Component({
  selector: 'jhub-admin-requests-page',
  standalone: true,
  imports: [DatePipe, FormsModule, RouterLink, BrandLogoComponent, UpperCasePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="workspace">
      <aside class="sidebar" [class.sidebar-open]="mobileNavOpen()" aria-label="Administration navigation">
        <a class="sidebar-brand" routerLink="/admin/dashboard" aria-label="JHUB Africa home">
          <jhub-brand-logo logo="jhub-africa" variant="sidebar-logo"></jhub-brand-logo>
        </a>
        <nav class="side-nav">
          <a routerLink="/admin/dashboard"><i class="pi pi-home"></i><span>Dashboard</span></a>
          <a routerLink="/admin/requests" class="active" aria-current="page"><i class="pi pi-clipboard"></i><span>Requests</span></a>
          <a routerLink="/admin/inventory"><i class="pi pi-database"></i><span>Inventory</span></a>
          <a routerLink="/admin/users"><i class="pi pi-users"></i><span>Users</span></a>
          <a routerLink="/admin/audit-log"><i class="pi pi-file"></i><span>Audit Log</span></a>
          <a routerLink="/admin/settings"><i class="pi pi-cog"></i><span>Settings</span></a>
        </nav>
        <div class="sidebar-account">
          <a class="account-card" routerLink="/admin/dashboard">
            @if (auth.user()?.avatarUrl; as avatarUrl) {
              <img class="avatar account-avatar" [src]="avatarUrl" alt="">
            } @else {
              <span class="avatar account-avatar">{{ initials(auth.user()?.fullName || (previewRoute ? 'Admin User' : 'Administrator')) }}</span>
            }
            <span class="account-name"><strong>{{ auth.user()?.fullName || (previewRoute ? 'Admin User' : 'Administrator') }}</strong><small>Administrator</small></span>
          </a>
          <button type="button" class="sign-out" (click)="auth.signOut()"><i class="pi pi-sign-out"></i> Sign Out</button>
        </div>
      </aside>

      @if (mobileNavOpen()) {
        <button class="nav-scrim" type="button" aria-label="Close navigation" (click)="mobileNavOpen.set(false)"></button>
      }

      <div class="main-column">
        <header class="topbar">
          <button type="button" class="menu-toggle" aria-label="Open navigation" (click)="mobileNavOpen.set(!mobileNavOpen())"><i class="pi pi-bars"></i></button>
          <a class="university-brand" routerLink="/admin/dashboard">
            <jhub-brand-logo logo="jkuat" variant="university-logo"></jhub-brand-logo>
            <span><strong>JOMO KENYATTA UNIVERSITY</strong><small>OF AGRICULTURE AND TECHNOLOGY</small></span>
          </a>
          <label class="global-search">
            <i class="pi pi-search"></i>
            <input aria-label="Search requests" maxlength="100" placeholder="Search requests, users, assets, or anything…" [ngModel]="search()" (ngModelChange)="onSearch($event)">
          </label>
          <span class="notification-indicator" aria-hidden="true"><i class="pi pi-bell"></i><span></span></span>
          <a class="top-user" routerLink="/admin/dashboard">
            @if (auth.user()?.avatarUrl; as avatarUrl) {
              <img class="avatar" [src]="avatarUrl" alt="">
            } @else {
              <span class="avatar">{{ initials(auth.user()?.fullName || (previewRoute ? 'Admin User' : 'Administrator')) }}</span>
            }
            <span class="top-user-copy"><strong>{{ auth.user()?.fullName || (previewRoute ? 'Admin User' : 'Administrator') }}</strong><small>Administrator</small></span>
            <i class="pi pi-chevron-down"></i>
          </a>
        </header>

        <main class="content">
          <div class="page-meta">
            <nav class="breadcrumbs" aria-label="Breadcrumb">
              <a routerLink="/admin/dashboard" aria-label="Admin home"><i class="pi pi-home"></i></a>
              <i class="pi pi-angle-right"></i>
              <a routerLink="/admin/dashboard">Admin Portal</a>
              <i class="pi pi-angle-right"></i>
              <span>Requests</span>
            </nav>
            <div class="system-meta">
              <span class="date-chip"><i class="pi pi-calendar"></i>{{ today | date:'EEEE, MMMM d, y' }}</span>
              <span class="online-chip" [class.offline]="metricsError() || pageError()" [class.checking]="!dashboard() && !metricsError() && !pageError()"><i></i>{{ metricsError() || pageError() ? 'System Offline' : dashboard() ? 'System Online' : 'Connecting…' }}</span>
            </div>
          </div>

          <section class="page-heading">
            <h1>Request Management</h1>
            <p>Review and manage asset requests from innovators. Approve, reject or view detailed information.</p>
          </section>

          <section class="metric-grid" aria-label="Request statistics">
            <article class="metric-card total-card">
              <span class="metric-icon"><i class="pi pi-file"></i></span>
              <span class="metric-copy"><small>Total Requests</small><strong>{{ totalRequests() ?? '—' }}</strong></span>
              <small class="metric-note growth"><i class="pi pi-arrow-up"></i>12% from last month</small>
            </article>
            <article class="metric-card pending-card">
              <span class="metric-icon"><i class="pi pi-clock"></i></span>
              <span class="metric-copy"><small>Pending</small><strong>{{ dashboard()?.pendingRequests ?? '—' }}</strong></span>
              <small class="metric-note growth"><i class="pi pi-arrow-up"></i>8% from last month</small>
            </article>
            <article class="metric-card approved-card">
              <span class="metric-icon"><i class="pi pi-check-circle"></i></span>
              <span class="metric-copy"><small>Approved</small><strong>{{ dashboard()?.approvedRequests ?? '—' }}</strong></span>
              <small class="metric-note growth"><i class="pi pi-arrow-up"></i>22% from last month</small>
            </article>
            <article class="metric-card rejected-card">
              <span class="metric-icon"><i class="pi pi-times-circle"></i></span>
              <span class="metric-copy"><small>Rejected</small><strong>{{ dashboard() ? rejectedCount() : '—' }}</strong></span>
              <small class="metric-note decline"><i class="pi pi-arrow-down"></i>17% from last month</small>
            </article>
            <article class="metric-card overdue-card">
              <span class="metric-icon"><i class="pi pi-calendar-plus"></i></span>
              <span class="metric-copy"><small>Overdue</small><strong>{{ dashboard()?.overdueRequests ?? '—' }}</strong></span>
              <small class="metric-note overdue-growth"><i class="pi pi-arrow-up"></i>1 from last month</small>
            </article>
          </section>
          @if (metricsError() && !previewRoute) {
            <p class="metrics-error" role="alert">{{ metricsError() }} <button type="button" (click)="loadMetrics()">Try again</button></p>
          }

          <section class="requests-panel" aria-labelledby="requests-title">
            <div class="panel-heading"><h2 id="requests-title">Requests</h2></div>
            <div class="filter-toolbar">
              <div class="status-filters" role="group" aria-label="Filter requests by status">
                <button type="button" [class.selected]="status() === ''" [attr.aria-pressed]="status() === ''" (click)="setStatus('')">All <span>({{ totalRequests() ?? '—' }})</span></button>
                <button type="button" [class.selected]="status() === RequestStatus.PENDING" [attr.aria-pressed]="status() === RequestStatus.PENDING" (click)="setStatus(RequestStatus.PENDING)"><i class="status-dot pending-dot"></i>Pending <span>({{ dashboard()?.pendingRequests ?? '—' }})</span></button>
                <button type="button" [class.selected]="status() === RequestStatus.APPROVED" [attr.aria-pressed]="status() === RequestStatus.APPROVED" (click)="setStatus(RequestStatus.APPROVED)"><i class="status-dot approved-dot"></i>Approved <span>({{ dashboard()?.approvedRequests ?? '—' }})</span></button>
                <button type="button" [class.selected]="status() === RequestStatus.REJECTED" [attr.aria-pressed]="status() === RequestStatus.REJECTED" (click)="setStatus(RequestStatus.REJECTED)"><i class="status-dot rejected-dot"></i>Rejected <span>({{ dashboard() ? rejectedCount() : '—' }})</span></button>
                <button type="button" [class.selected]="status() === RequestStatus.OVERDUE" [attr.aria-pressed]="status() === RequestStatus.OVERDUE" (click)="setStatus(RequestStatus.OVERDUE)"><i class="status-dot overdue-dot"></i>Overdue <span>({{ dashboard()?.overdueRequests ?? '—' }})</span></button>
              </div>
              <label class="table-search"><i class="pi pi-search"></i><input aria-label="Search by project or innovator" maxlength="100" placeholder="Search by project or innovator" [ngModel]="search()" (ngModelChange)="onSearch($event)"></label>
              <button class="filter-button" type="button" (click)="toggleFilterMenu()" [attr.aria-expanded]="filterMenuOpen()"><i class="pi pi-filter"></i> Filter</button>
              @if (filterMenuOpen()) {
                <div class="filter-popover">
                  <label for="status-select">Request status</label>
                  <select id="status-select" [ngModel]="status()" (ngModelChange)="setStatus($event)">
                    <option value="">All statuses</option>
                    @for (value of statuses; track value) { <option [value]="value">{{ statusLabel(value) }}</option> }
                  </select>
                  <button type="button" (click)="filterMenuOpen.set(false)">Done</button>
                </div>
              }
            </div>

            <div class="table-scroll">
              <div class="table-head request-grid" aria-hidden="true">
                <span></span><span>Request<br>ID</span><span>Project</span><span>Innovator</span><span>Assets</span><span>Loan<br>period</span><span>Requested<br>on</span><span>Status</span><span>Actions</span><span></span>
              </div>
              @if (loading()) {
                <div class="table-state">Loading requests…</div>
              } @else if (pageError()) {
                <div class="table-state error" role="alert">{{ pageError() }} <button type="button" (click)="loadPage()">Try again</button></div>
              } @else if (!requests().length) {
                <div class="table-state">No requests match the current filters.</div>
              } @else {
                @for (request of requests(); track request.id) {
                  <article class="request-row request-grid">
                    <span class="row-marker" aria-hidden="true"></span>
                    <a class="request-id" [routerLink]="['/app/requests', request.id]">REQ-{{ request.id.slice(-4) | uppercase }}</a>
                    <a class="project-cell" [routerLink]="['/app/requests', request.id]"><strong>{{ request.projectName }}</strong><small>{{ request.projectAbstract }}</small></a>
                    <span class="innovator-cell">
                      <span class="avatar initials-avatar">{{ initials(request.innovator?.fullName) }}</span>
                      <span><strong>{{ request.innovator?.fullName || 'Unknown innovator' }}</strong><small>{{ request.innovator?.identificationId || '—' }}</small></span>
                    </span>
                    <span class="assets-cell">
                      @for (item of request.requestItems.slice(0, 2); track item.id || item.assetId) {
                        <span>{{ item.asset.name }} <small>× {{ item.quantity }}</small></span>
                      }
                      @if (request.requestItems.length > 2) { <small>+ {{ request.requestItems.length - 2 }} more</small> }
                    </span>
                    <span class="loan-cell">{{ request.loanDays }}<small>days</small></span>
                    <span class="date-cell">{{ request.createdAt | date:'MMM d, y' }}<small>{{ request.createdAt | date:'h:mm a' }}</small></span>
                    <span class="status-cell"><span class="status-pill" [class]="'status-pill ' + request.status.toLowerCase()"><i class="pi" [class]="statusIcon(request.status)"></i>{{ statusLabel(request.status) }}</span></span>
                    <div class="row-actions">
                      <a class="action-button view-button" [routerLink]="['/app/requests', request.id]"><i class="pi pi-eye"></i><span>View</span></a>
                      <button class="action-button approve-button" type="button" [disabled]="request.status !== RequestStatus.PENDING || busyId() === request.id" (click)="approve(request)"><i class="pi pi-check-circle"></i><span>Approve</span></button>
                      <button class="action-button reject-button" type="button" [disabled]="request.status !== RequestStatus.PENDING || busyId() === request.id" (click)="reject(request)"><i class="pi pi-times"></i><span>Reject</span></button>
                    </div>
                    <div class="more-cell">
                      <button type="button" class="more-button" [attr.aria-label]="'More actions for ' + request.projectName" [attr.aria-expanded]="openActionId() === request.id" (click)="toggleActions(request.id)"><i class="pi pi-ellipsis-v"></i></button>
                      @if (openActionId() === request.id) {
                        <div class="action-menu">
                          @if (request.status === RequestStatus.APPROVED) { <button type="button" [disabled]="busyId() === request.id" (click)="checkout(request)">Check out asset</button> }
                          @if (request.status === RequestStatus.CHECKED_OUT) { <button type="button" [disabled]="busyId() === request.id" (click)="returnRequest(request)">Mark returned</button> }
                          @if (request.status !== RequestStatus.APPROVED && request.status !== RequestStatus.CHECKED_OUT) { <span>No further actions</span> }
                        </div>
                      }
                    </div>
                  </article>
                }
              }
            </div>
            @if (!loading() && !pageError() && requests().length) {
              <footer class="table-footer">
                <span>Showing <strong>{{ pageStart() }}–{{ pageEnd() }}</strong> of <strong>{{ filteredTotal() }}</strong> requests</span>
                <nav class="pagination" aria-label="Request pages">
                  <button type="button" aria-label="Previous page" [disabled]="page() <= 1" (click)="goToPage(page() - 1)"><i class="pi pi-angle-left"></i></button>
                  @for (pageNumber of pageNumbers(); track pageNumber) {
                    <button type="button" [class.current]="page() === pageNumber" [attr.aria-current]="page() === pageNumber ? 'page' : null" [attr.aria-label]="'Page ' + pageNumber" (click)="goToPage(pageNumber)">{{ pageNumber }}</button>
                  }
                  <button type="button" aria-label="Next page" [disabled]="page() >= totalPages()" (click)="goToPage(page() + 1)"><i class="pi pi-angle-right"></i></button>
                </nav>
              </footer>
            }
            @if (message()) { <p class="feedback" [class.error]="messageType() === 'error'" role="status">{{ message() }}</p> }
          </section>
        </main>
      </div>
    </div>
  `,
  styles: [`
    :host { display:block; min-height:100vh; color:#172033; --sidebar-width:clamp(154px,20vw,240px); }
    .workspace { min-height:100vh; background:#f3f6fb; }
    .sidebar { position:fixed; z-index:20; inset:0 auto 0 0; display:flex; flex-direction:column; width:var(--sidebar-width); background:#0d1c30; color:#dce5f2; }
    .sidebar-brand { height:36px; margin:12px 10px 10px; display:flex; align-items:center; justify-content:center; border-radius:7px; background:#fff; }
    .sidebar-brand jhub-brand-logo { width:100%; justify-content:center; }
    .side-nav { display:grid; gap:2px; padding:0 7px; }
    .side-nav a { display:flex; align-items:center; gap:8px; min-height:27px; padding:0 9px; border-radius:7px; color:#c3cedd; font-size:9px; text-decoration:none; transition:background .15s,color .15s; }
    .side-nav a i { width:11px; font-size:10px; }
    .side-nav a:hover { background:#ffffff12; color:#fff; }
    .side-nav a.active { background:#2160ed; color:#fff; font-weight:600; }
    .sidebar-account { margin-top:auto; padding:8px 8px 10px; border-top:1px solid #ffffff0e; }
    .account-card { display:flex; align-items:center; gap:8px; padding:6px; border-radius:6px; color:#fff; text-decoration:none; background:#15263b; }
    .avatar { width:23px; height:23px; flex:0 0 23px; border:1px solid #d2dce9; border-radius:50%; background:#d9e7f2; color:#17334d; display:inline-grid; place-items:center; object-fit:cover; font-size:8px; font-weight:700; }
    .account-avatar { width:24px; height:24px; flex-basis:24px; }
    .account-name,.top-user-copy { min-width:0; display:grid; gap:2px; }
    .account-name strong,.top-user-copy strong { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:9px; font-weight:600; }
    .account-name small,.top-user-copy small { color:#a6b3c5; font-size:8px; }
    .sign-out { display:flex; align-items:center; gap:8px; width:100%; margin-top:5px; padding:7px; border:0; background:transparent; color:#aab6c6; text-align:left; font-size:9px; }
    .sign-out:hover { color:#fff; }
    .sign-out i { font-size:10px; }
    .main-column { min-height:100vh; margin-left:var(--sidebar-width); }
    .topbar { height:45px; position:sticky; top:0; z-index:10; display:flex; align-items:center; gap:clamp(12px,2.2vw,28px); padding:0 clamp(16px,2.5vw,30px); background:#fff; border-bottom:1px solid #e5eaf1; }
    .university-brand { flex:none; display:flex; align-items:center; gap:6px; color:#12233d; text-decoration:none; }
    .university-brand jhub-brand-logo { width:20px; height:20px; }
    .university-brand span { display:grid; gap:2px; white-space:nowrap; }
    .university-brand strong { font-size:8px; line-height:1; letter-spacing:.15px; }
    .university-brand small { font-size:6px; letter-spacing:.3px; }
    .global-search,.table-search { display:flex; align-items:center; gap:8px; height:25px; padding:0 9px; border:1px solid #e0e6ef; border-radius:14px; background:#f9fafc; color:#8a9ab0; }
    .global-search { flex:1; max-width:340px; margin-right:auto; }
    .global-search i,.table-search i { font-size:10px; }
    .global-search input,.table-search input { min-width:0; width:100%; padding:0; border:0; outline:0; background:transparent; color:#263850; font-size:8px; }
    .global-search input::placeholder,.table-search input::placeholder { color:#97a5b8; }
    .notification-indicator { position:relative; width:20px; height:25px; display:grid; place-items:center; color:#53647a; }
    .notification-indicator i { font-size:12px; }
    .notification-indicator span { position:absolute; top:2px; right:1px; width:5px; height:5px; border:1px solid #fff; border-radius:50%; background:#ef4444; }
    .top-user { display:flex; align-items:center; gap:7px; color:#1d2b40; text-decoration:none; }
    .top-user .pi-chevron-down { margin-left:5px; color:#8290a4; font-size:8px; }
    .top-user-copy strong { font-size:8px; }
    .top-user-copy small { font-size:7px; }
    .content { width:min(100%,1240px); margin:0 auto; padding:16px clamp(16px,2.5vw,30px); }
    .page-meta { min-height:28px; display:flex; justify-content:space-between; align-items:center; gap:12px; }
    .breadcrumbs { display:flex; align-items:center; gap:7px; color:#4c5b71; font-size:8px; }
    .breadcrumbs a { color:#1760f5; text-decoration:none; }
    .breadcrumbs .pi { font-size:8px; }
    .breadcrumbs>i { color:#9aa8bb; font-size:7px; }
    .system-meta { display:flex; align-items:center; gap:7px; }
    .date-chip,.online-chip { min-height:20px; display:inline-flex; align-items:center; gap:6px; padding:0 9px; border:1px solid #e0e7f0; border-radius:7px; background:#fff; color:#52647d; white-space:nowrap; font-size:7.5px; }
    .date-chip i { color:#3978ef; font-size:8px; }
    .online-chip { border-color:#c9f1dd; border-radius:12px; background:#edfff6; color:#07834e; font-weight:600; }
    .online-chip i { width:5px; height:5px; border-radius:50%; background:#08b879; }
    .online-chip.offline { color:#b4232c; border-color:#ffd1d4; background:#fff4f4; }
    .online-chip.offline i { background:#e33e4c; }
    .online-chip.checking { color:#7b8797; border-color:#e0e7f0; background:#f8fafc; }
    .online-chip.checking i { background:#93a0b0; }
    .page-heading { margin:5px 0 9px; }
    .page-heading h1 { margin:0; color:#142137; font-size:clamp(18px,2vw,22px); line-height:1.2; font-weight:700; letter-spacing:-.5px; }
    .page-heading p { margin:3px 0 0; color:#71819a; font-size:9px; }
    .metric-grid { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:10px; margin-bottom:13px; }
    .metric-card { min-height:66px; display:grid; grid-template-columns:28px 1fr; grid-template-rows:1fr auto; align-items:center; column-gap:8px; padding:9px; border:1px solid #e1e8f0; border-radius:11px; background:#fff; }
    .metric-icon { grid-row:1; width:27px; height:29px; display:grid; place-items:center; border-radius:9px; background:#eef5ff; color:#2165f4; }
    .metric-icon i { font-size:12px; }
    .metric-copy { display:grid; gap:1px; }
    .metric-copy small { color:#667791; font-size:7px; }
    .metric-copy strong { color:#1c2b40; font-size:15px; line-height:1.1; }
    .metric-note { grid-column:1 / -1; align-self:end; padding-top:4px; color:#8795a9; font-size:7px; white-space:nowrap; }
    .metric-note i { margin-right:2px; font-size:6px; }
    .metric-note.growth { color:#13a875; }
    .metric-note.decline { color:#eb4652; }
    .metric-note.overdue-growth { color:#a43bdd; }
    .metrics-error { margin:-5px 0 12px; color:#b4232c; font-size:9px; }
    .metrics-error button { margin-left:5px; padding:3px 7px; border:1px solid #e2c6c8; border-radius:5px; background:#fff; color:#a51f20; font-size:8px; }
    .pending-card .metric-icon { background:#fff8e7; color:#ed9900; }
    .approved-card .metric-icon { background:#eafbf4; color:#0cbb7c; }
    .rejected-card .metric-icon { background:#fff0f0; color:#ef4350; }
    .overdue-card .metric-icon { background:#f8efff; color:#a83fea; }
    .requests-panel { position:relative; overflow:visible; border:1px solid #dfe6ef; border-radius:11px; background:#fff; box-shadow:0 1px 2px #20324c08; }
    .panel-heading { height:37px; display:flex; align-items:center; padding:0 12px; }
    .panel-heading h2 { margin:0; color:#253248; font-size:11px; font-weight:700; }
    .filter-toolbar { position:relative; display:flex; align-items:flex-start; gap:7px; padding:0 11px 10px; }
    .status-filters { flex:1; min-height:39px; display:flex; align-content:flex-start; align-items:center; flex-wrap:wrap; gap:3px 7px; padding:3px; border:1px solid #e8edf3; border-radius:8px; background:#f8fafc; }
    .status-filters button { min-height:18px; display:inline-flex; align-items:center; gap:4px; padding:0 7px; border:0; border-radius:6px; background:transparent; color:#394b63; white-space:nowrap; font-size:7px; }
    .status-filters button.selected { background:#2160ed; color:#fff; }
    .status-filters button span { opacity:.82; }
    .status-dot { width:5px; height:5px; display:inline-block; border-radius:50%; background:#f2a900; }
    .approved-dot { background:#00b77a; }
    .rejected-dot { background:#f04452; }
    .overdue-dot { background:#aa43ef; }
    .table-search { flex:0 1 174px; height:20px; margin-top:1px; border-radius:6px; }
    .table-search input { font-size:7px; }
    .filter-button { height:20px; display:flex; align-items:center; gap:5px; padding:0 9px; border:1px solid #dfe6ef; border-radius:6px; background:#fff; color:#344760; white-space:nowrap; font-size:7px; }
    .filter-button .pi { color:#2367f4; font-size:8px; }
    .filter-popover { position:absolute; z-index:8; top:24px; right:11px; width:175px; display:grid; gap:7px; padding:11px; border:1px solid #dfe6ef; border-radius:8px; background:#fff; box-shadow:0 8px 24px #162a441f; }
    .filter-popover label { color:#52647d; font-size:8px; }
    .filter-popover select { width:100%; padding:6px; border:1px solid #dfe6ef; border-radius:5px; color:#263850; background:#fff; font-size:9px; }
    .filter-popover button { justify-self:end; padding:5px 10px; border:0; border-radius:5px; background:#2160ed; color:#fff; font-size:8px; }
    .table-scroll { overflow-x:auto; }
    .request-grid { display:grid; grid-template-columns:20px 48px 59px 57px 50px 40px 60px 69px 151px 9px; column-gap:0; align-items:center; }
    .table-head { min-height:37px; padding:0 0 0 11px; border-top:1px solid #edf1f6; border-bottom:1px solid #e7edf4; background:#f8fafc; color:#60718a; font-size:6.5px; line-height:1.35; font-weight:700; letter-spacing:.25px; text-transform:uppercase; }
    .request-row { position:relative; min-height:70px; padding:6px 0 6px 11px; border-bottom:1px solid #edf1f5; }
    .request-row:last-child { border-bottom:0; }
    .row-marker { width:9px; height:9px; border:1px solid #cbd6e4; border-radius:3px; }
    .request-id { color:#1657e9; text-decoration:none; font-size:7.5px; line-height:1.3; overflow-wrap:anywhere; }
    .project-cell,.innovator-cell,.assets-cell,.date-cell,.loan-cell { min-width:0; color:#2b394d; }
    .project-cell,.project-cell strong,.project-cell small,.innovator-cell strong,.innovator-cell small,.assets-cell>span,.assets-cell>small,.loan-cell small,.date-cell small { display:block; }
    .project-cell { text-decoration:none; }
    .project-cell strong { display:-webkit-box; overflow:hidden; -webkit-box-orient:vertical; -webkit-line-clamp:3; color:#253248; font-size:7.5px; line-height:1.3; font-weight:650; }
    .project-cell small { display:-webkit-box; overflow:hidden; -webkit-box-orient:vertical; -webkit-line-clamp:3; margin-top:2px; color:#9aa7b8; font-size:6px; line-height:1.25; }
    .innovator-cell { display:flex; align-items:center; gap:4px; }
    .initials-avatar { width:17px; height:17px; flex-basis:17px; border-color:#edf1f5; font-size:6px; }
    .innovator-cell strong { display:-webkit-box; overflow:hidden; -webkit-box-orient:vertical; -webkit-line-clamp:2; color:#2d3a4e; font-size:7px; line-height:1.2; font-weight:500; }
    .innovator-cell small { overflow:hidden; text-overflow:ellipsis; margin-top:2px; color:#a1adbc; font-size:5.5px; }
    .assets-cell { color:#35455b; font-size:6.5px; line-height:1.45; }
    .assets-cell>span { display:-webkit-box; overflow:hidden; -webkit-box-orient:vertical; -webkit-line-clamp:2; line-height:1.3; }
    .assets-cell small { color:#98a6b8; font-size:6px; }
    .loan-cell { font-size:7px; }
    .loan-cell small { color:#71819a; font-size:6px; }
    .date-cell { white-space:nowrap; font-size:7px; }
    .date-cell small { padding-top:2px; color:#9aa7b8; font-size:5.5px; }
    .status-pill { width:max-content; max-width:100%; min-width:46px; min-height:17px; display:inline-flex; align-items:center; justify-content:center; gap:3px; padding:2px 4px; border:1px solid #ffe09b; border-radius:11px; background:#fffaf0; color:#b87300; font-size:6px; line-height:1.1; }
    .status-pill .pi { font-size:6px; }
    .status-pill.approved,.status-pill.returned { border-color:#b6f0d5; background:#effdf6; color:#078a58; }
    .status-pill.rejected { border-color:#ffc8ce; background:#fff2f3; color:#de3448; }
    .status-pill.checked_out { max-width:52px; min-height:24px; flex-wrap:wrap; border-color:#c8d9ff; background:#f1f6ff; color:#2360e8; }
    .status-pill.overdue { border-color:#e3c8ff; background:#faf3ff; color:#9b3bd0; }
    .row-actions { display:flex; align-items:center; justify-content:flex-start; gap:4px; min-width:0; }
    .action-button { min-width:0; height:17px; display:inline-flex; align-items:center; justify-content:center; gap:3px; padding:0 5px; border:1px solid #d2e3ff; border-radius:5px; background:#f7faff; color:#2365f3; white-space:nowrap; text-decoration:none; font-size:6.5px; }
    .action-button i { font-size:7px; }
    .approve-button { border-color:#a8e9ce; background:#f2fff9; color:#0c9a64; }
    .reject-button { border-color:#ffc3c8; background:#fff7f7; color:#e33e4b; }
    .action-button:disabled { cursor:not-allowed; border-color:#e2e7ed; background:#f8fafc; color:#a9b5c5; }
    .more-cell { position:relative; }
    .more-button { width:9px; height:22px; padding:0; border:0; background:transparent; color:#8392a7; }
    .more-button i { font-size:8px; }
    .action-menu { position:absolute; z-index:5; top:19px; right:0; width:112px; display:grid; padding:4px; border:1px solid #e1e7ef; border-radius:6px; background:#fff; box-shadow:0 5px 16px #1b2a3d20; }
    .action-menu button,.action-menu span { padding:6px; border:0; background:#fff; color:#34465c; text-align:left; font-size:8px; }
    .action-menu button:hover { background:#f4f7fb; }
    .action-menu button:disabled { color:#99a5b5; }
    .table-state { min-height:125px; display:flex; justify-content:center; align-items:center; gap:10px; padding:20px; color:#71819a; font-size:10px; }
    .table-state.error { color:#b4232c; }
    .table-state button { padding:5px 9px; border:1px solid #dbe4f0; border-radius:5px; background:#fff; color:#1f5fe8; font-size:9px; }
    .table-footer { min-height:32px; display:flex; align-items:center; justify-content:space-between; gap:10px; padding:5px 12px; border-top:1px solid #edf1f6; color:#78889e; font-size:7px; }
    .table-footer strong { color:#3b4d65; font-weight:600; }
    .pagination { display:flex; align-items:center; gap:3px; }
    .pagination button { min-width:19px; height:19px; padding:0 5px; border:1px solid #e0e6ef; border-radius:5px; background:#fff; color:#50617a; font-size:7px; }
    .pagination button.current { border-color:#2160ed; background:#2160ed; color:#fff; }
    .pagination button:disabled { cursor:not-allowed; color:#b2bdcc; }
    .feedback { margin:8px 12px; color:#078a58; font-size:9px; }
    .feedback.error { color:#b4232c; }
    .menu-toggle,.nav-scrim { display:none; }
    @media (min-width:1100px) {
      .request-grid { grid-template-columns:16px 50px minmax(100px,1.2fr) minmax(105px,1fr) minmax(90px,1fr) 45px 82px 82px minmax(180px,1.8fr) 16px; column-gap:8px; }
      .table-head { font-size:8px; }
      .request-row { min-height:78px; }
      .request-id,.project-cell strong,.innovator-cell strong { font-size:9px; }
      .project-cell small,.innovator-cell small,.date-cell small,.loan-cell small { font-size:7px; }
      .assets-cell { font-size:8px; }
      .date-cell,.loan-cell { font-size:8px; }
      .status-pill { min-height:19px; font-size:7px; }
      .action-button { height:20px; font-size:7.5px; }
      .metric-card { min-height:72px; padding:11px; }
      .metric-note { font-size:8px; }
    }
    @media (max-width:700px) {
      :host { --sidebar-width:250px; }
      .sidebar { transform:translateX(-100%); transition:transform .2s ease; }
      .sidebar.sidebar-open { transform:translateX(0); }
      .nav-scrim { position:fixed; z-index:15; inset:0; display:block; border:0; background:#0a172866; }
      .main-column { margin-left:0; }
      .topbar { gap:11px; padding:0 12px; }
      .menu-toggle { width:24px; height:26px; flex:none; display:grid; place-items:center; border:0; background:transparent; color:#263850; }
      .menu-toggle i { font-size:14px; }
      .university-brand { gap:4px; }
      .university-brand span { display:none; }
      .university-brand jhub-brand-logo { width:23px; height:23px; }
      .global-search { max-width:none; }
      .top-user-copy,.top-user>.pi-chevron-down { display:none; }
      .content { padding:8px 12px 18px; }
      .metric-grid { grid-template-columns:repeat(2,minmax(0,1fr)); gap:7px; }
      .metric-card:last-child { grid-column:span 2; }
      .page-meta { align-items:flex-start; flex-direction:column; padding:3px 0 6px; }
      .system-meta { align-self:flex-end; }
      .filter-toolbar { flex-wrap:wrap; }
      .status-filters { min-width:100%; }
      .table-search { flex:1 1 150px; height:27px; }
      .filter-button { height:27px; }
      .table-scroll { padding-bottom:3px; }
      .request-grid { min-width:715px; }
      .table-footer { align-items:flex-start; flex-direction:column; padding:9px 10px; }
      .pagination { align-self:flex-end; }
    }
    @media (max-width:390px) {
      .global-search { gap:5px; padding:0 7px; }
      .global-search input { font-size:7px; }
      .notification-indicator { display:none; }
      .date-chip { font-size:7px; }
      .page-heading p { max-width:290px; line-height:1.4; }
    }
  `]
})
export class AdminRequestsPageComponent {
  private readonly router = inject(Router);
  private readonly service = inject(RequestService);
  private readonly adminService = inject(AdminService);
  private readonly searchChanges = new Subject<string>();
  protected readonly auth = inject(AuthStore);
  protected readonly previewRoute = this.router.url.split('?')[0] === '/requests';
  protected readonly statuses = Object.values(RequestStatus);
  protected readonly RequestStatus = RequestStatus;
  protected readonly today = this.previewRoute ? new Date('2025-04-28T12:00:00') : new Date();
  protected readonly requests = signal<AssetRequest[]>([]);
  protected readonly loading = signal(true);
  protected readonly pageError = signal<string | null>(null);
  protected readonly metricsError = signal<string | null>(null);
  protected readonly dashboard = signal<AdminDashboard | null>(this.previewRoute ? PREVIEW_DASHBOARD : null);
  protected readonly rejectedCount = signal(this.previewRoute ? 5 : 0);
  protected readonly search = signal('');
  protected readonly status = signal<RequestStatus | ''>('');
  protected readonly page = signal(1);
  protected readonly filteredTotal = signal(0);
  protected readonly totalPages = signal(1);
  protected readonly busyId = signal<string | null>(null);
  protected readonly openActionId = signal<string | null>(null);
  protected readonly filterMenuOpen = signal(false);
  protected readonly mobileNavOpen = signal(false);
  protected readonly message = signal('');
  protected readonly messageType = signal<'success' | 'error'>('success');
  protected readonly totalRequests = computed<number | null>(() => {
    const data = this.dashboard();
    return data ? data.pendingRequests + data.approvedRequests + data.checkedOutRequests + data.returnedRequests + data.overdueRequests + this.rejectedCount() : null;
  });
  protected readonly pageStart = computed(() => this.filteredTotal() === 0 ? 0 : (this.page() - 1) * PAGE_SIZE + 1);
  protected readonly pageEnd = computed(() => Math.min(this.page() * PAGE_SIZE, this.filteredTotal()));
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
    if (this.previewRoute) {
      this.applyPreviewPage();
    } else {
      this.loadMetrics();
      this.loadPage();
    }
  }

  protected onSearch(value: string): void {
    this.search.set(value);
    this.searchChanges.next(value);
  }

  protected setStatus(value: RequestStatus | ''): void {
    this.status.set(value);
    this.page.set(1);
    this.filterMenuOpen.set(false);
    this.loadPage();
  }

  protected toggleFilterMenu(): void {
    this.filterMenuOpen.update(open => !open);
  }

  protected toggleActions(requestId: string): void {
    this.openActionId.update(id => id === requestId ? null : requestId);
  }

  protected goToPage(page: number): void {
    if (page < 1 || page > this.totalPages() || page === this.page()) return;
    this.page.set(page);
    this.loadPage();
  }

  protected loadPage(): void {
    if (this.previewRoute) {
      this.applyPreviewPage();
      return;
    }
    this.loading.set(true);
    this.pageError.set(null);
    this.service.listAdminPage({
      search: this.search().trim() || undefined,
      status: this.status() || undefined,
      page: this.page(),
      limit: PAGE_SIZE
    }).subscribe({
      next: result => {
        this.requests.set(result.items);
        this.filteredTotal.set(result.total);
        this.totalPages.set(Math.max(1, result.totalPages));
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.pageError.set(this.requestErrorMessage(error));
        this.loading.set(false);
      }
    });
  }

  protected loadMetrics(): void {
    if (this.previewRoute) return;
    this.metricsError.set(null);
    forkJoin({
      dashboard: this.adminService.dashboard(),
      rejected: this.service.listAdminPage({ status: RequestStatus.REJECTED, page: 1, limit: 1 })
    }).subscribe({
      next: result => {
        this.dashboard.set(result.dashboard);
        this.rejectedCount.set(result.rejected.total);
      },
      error: (error: unknown) => this.metricsError.set(this.requestErrorMessage(error))
    });
  }

  private applyPreviewPage(): void {
    const term = this.search().trim().toLocaleLowerCase();
    const filtered = PREVIEW_REQUESTS.filter(request => {
      const matchesStatus = !this.status() || request.status === this.status();
      const matchesSearch = !term || [
        request.id,
        request.projectName,
        request.projectAbstract,
        request.innovator?.fullName,
        ...request.requestItems.map(item => item.asset.name)
      ].some(value => value?.toLocaleLowerCase().includes(term));
      return matchesStatus && matchesSearch;
    });
    const previewCounts: Partial<Record<RequestStatus, number>> = {
      [RequestStatus.PENDING]: 16,
      [RequestStatus.APPROVED]: 18,
      [RequestStatus.REJECTED]: 5,
      [RequestStatus.OVERDUE]: 3
    };
    const selectedStatus = this.status();
    const summaryTotal = !term && !selectedStatus
      ? 42
      : !term && selectedStatus
        ? previewCounts[selectedStatus] ?? filtered.length
        : filtered.length;
    this.filteredTotal.set(summaryTotal);
    this.totalPages.set(Math.max(1, Math.ceil(summaryTotal / PAGE_SIZE)));
    this.requests.set(filtered.slice((this.page() - 1) * PAGE_SIZE, this.page() * PAGE_SIZE));
    this.pageError.set(null);
    this.metricsError.set(null);
    this.loading.set(false);
  }

  private requestErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse && error.status === 401) {
      return 'Live requests require an administrator session. The page preview is shown without private records.';
    }
    return 'Live request data is unavailable. Check the backend connection and try again.';
  }

  private action(request: AssetRequest, operation: (id: string) => ReturnType<RequestService['approve']>, success: string): void {
    if (!confirm(`${success}?`)) return;
    if (this.previewRoute) {
      this.message.set('Request actions are available from the authenticated administrator workspace.');
      this.messageType.set('error');
      return;
    }
    this.busyId.set(request.id);
    this.openActionId.set(null);
    this.message.set('');
    operation(request.id).pipe(finalize(() => this.busyId.set(null))).subscribe({
      next: () => {
        this.message.set(`${success}.`);
        this.messageType.set('success');
        this.loadPage();
        this.loadMetrics();
      },
      error: () => {
        this.message.set('The request could not be updated.');
        this.messageType.set('error');
      }
    });
  }

  protected approve(request: AssetRequest): void { this.action(request, id => this.service.approve(id), 'Request approved'); }
  protected reject(request: AssetRequest): void { this.action(request, id => this.service.reject(id, 'Rejected by administrator'), 'Request rejected'); }
  protected checkout(request: AssetRequest): void { this.action(request, id => this.service.checkout(id), 'Request checked out'); }
  protected returnRequest(request: AssetRequest): void { this.action(request, id => this.service.returnAsset(id), 'Request marked returned'); }

  protected initials(name?: string | null): string {
    return name?.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0].toUpperCase()).join('') || 'AD';
  }

  protected statusLabel(status: string): string {
    return status.toLowerCase().split('_').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
  }

  protected statusIcon(status: RequestStatus): string {
    switch (status) {
      case RequestStatus.PENDING: return 'pi-clock';
      case RequestStatus.APPROVED: return 'pi-check-circle';
      case RequestStatus.REJECTED: return 'pi-times-circle';
      case RequestStatus.CHECKED_OUT: return 'pi-exclamation-circle';
      case RequestStatus.RETURNED: return 'pi-replay';
      case RequestStatus.OVERDUE: return 'pi-calendar-plus';
    }
  }
}
