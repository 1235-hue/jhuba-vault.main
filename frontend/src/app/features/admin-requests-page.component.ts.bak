import { DatePipe, UpperCasePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, finalize, forkJoin, Subject } from 'rxjs';
import { AdminRequestCounts, RequestService } from '../core/api.service';
import { AssetRequest, RequestStatus } from '../core/models';

const DEFAULT_PAGE_SIZE = 8;
const PAGE_SIZES = [8, 16, 32] as const;

@Component({
  selector: 'jhub-admin-requests-page',
  standalone: true,
  imports: [DatePipe, FormsModule, RouterLink, UpperCasePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
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
              <span class="online-chip" [class.offline]="pageError()" [class.checking]="!statusCounts() && !pageError()"><i></i>{{ pageError() ? 'System Offline' : statusCounts() ? 'System Online' : 'Connecting…' }}</span>
            </div>
          </div>

          <section class="page-heading">
            <p class="eyebrow">ADMINISTRATION / REQUESTS</p>
            <h1>Request <em>management.</em></h1>
            <p>Review and manage asset requests from innovators. Approve, reject or view detailed information.</p>
          </section>

          <section class="metric-grid" aria-label="Request statistics">
            <button type="button" class="metric-card total-card" [class.selected]="status() === ''" [attr.aria-pressed]="status() === ''" (click)="setStatus('')">
              <span class="metric-icon"><i class="pi pi-file"></i></span>
              <span class="metric-copy"><small>Total Requests</small><strong>{{ totalRequests() ?? '—' }}</strong></span>
              <small class="metric-note">All request statuses</small>
            </button>
            <button type="button" class="metric-card pending-card" [class.selected]="status() === RequestStatus.PENDING" [attr.aria-pressed]="status() === RequestStatus.PENDING" (click)="setStatus(RequestStatus.PENDING)">
              <span class="metric-icon"><i class="pi pi-clock"></i></span>
              <span class="metric-copy"><small>Pending</small><strong>{{ countFor(RequestStatus.PENDING) }}</strong></span>
              <small class="metric-note">Awaiting review</small>
            </button>
            <button type="button" class="metric-card approved-card" [class.selected]="status() === RequestStatus.APPROVED" [attr.aria-pressed]="status() === RequestStatus.APPROVED" (click)="setStatus(RequestStatus.APPROVED)">
              <span class="metric-icon"><i class="pi pi-check-circle"></i></span>
              <span class="metric-copy"><small>Approved</small><strong>{{ countFor(RequestStatus.APPROVED) }}</strong></span>
              <small class="metric-note">Approved requests</small>
            </button>
            <button type="button" class="metric-card rejected-card" [class.selected]="status() === RequestStatus.REJECTED" [attr.aria-pressed]="status() === RequestStatus.REJECTED" (click)="setStatus(RequestStatus.REJECTED)">
              <span class="metric-icon"><i class="pi pi-times-circle"></i></span>
              <span class="metric-copy"><small>Rejected</small><strong>{{ countFor(RequestStatus.REJECTED) }}</strong></span>
              <small class="metric-note">Rejected requests</small>
            </button>
            <button type="button" class="metric-card overdue-card" [class.selected]="status() === RequestStatus.OVERDUE" [attr.aria-pressed]="status() === RequestStatus.OVERDUE" (click)="setStatus(RequestStatus.OVERDUE)">
              <span class="metric-icon"><i class="pi pi-calendar-plus"></i></span>
              <span class="metric-copy"><small>Overdue</small><strong>{{ countFor(RequestStatus.OVERDUE) }}</strong></span>
              <small class="metric-note">Past expected return</small>
            </button>
          </section>
          <section class="requests-panel" aria-labelledby="requests-title">
            <div class="panel-heading"><h2 id="requests-title">Requests</h2></div>
            <div class="filter-toolbar">
              <div class="status-filters" role="group" aria-label="Filter requests by status">
                <button type="button" [class.selected]="status() === ''" [attr.aria-pressed]="status() === ''" (click)="setStatus('')">All <span>({{ totalRequests() ?? '—' }})</span></button>
                @for (value of statuses; track value) {
                  <button type="button" [class.selected]="status() === value" [attr.aria-pressed]="status() === value" (click)="setStatus(value)"><i [class]="statusDotClass(value)"></i>{{ statusLabel(value) }} <span>({{ countFor(value) }})</span></button>
                }
              </div>
              <label class="table-search"><i class="pi pi-search"></i><input aria-label="Search by project, innovator, or request ID" maxlength="100" placeholder="Search by project, innovator, or request ID" [ngModel]="search()" (ngModelChange)="onSearch($event)"></label>
              <button class="filter-button" type="button" (click)="toggleFilterMenu()" [attr.aria-expanded]="filterMenuOpen()"><i class="pi pi-filter"></i> Filter</button>
              @if (filterMenuOpen()) {
                <div class="filter-popover">
                  <label for="status-select">Request status</label>
                  <select id="status-select" [ngModel]="status()" (ngModelChange)="setStatus($event, false)">
                    <option value="">All statuses</option>
                    @for (value of statuses; track value) { <option [value]="value">{{ statusLabel(value) }}</option> }
                  </select>
                  <label for="date-from">Requested from</label>
                  <input id="date-from" type="date" [ngModel]="dateFrom()" (ngModelChange)="dateFrom.set($event)" [max]="dateTo() || null">
                  <label for="date-to">Requested to</label>
                  <input id="date-to" type="date" [ngModel]="dateTo()" (ngModelChange)="dateTo.set($event)" [min]="dateFrom() || null">
                  <div class="filter-actions">
                    <button type="button" class="clear-filter" (click)="clearFilters()">Clear</button>
                    <button type="button" (click)="applyDateFilters()">Apply</button>
                  </div>
                </div>
              }
            </div>

            <div class="table-scroll">
              <div class="table-head request-grid">
                <label class="selection-checkbox"><input type="checkbox" aria-label="Select all requests on this page" [checked]="allOnPageSelected()" [indeterminate]="someOnPageSelected() && !allOnPageSelected()" (change)="togglePageSelection($event)"></label><span>Request<br>ID</span><span>Project</span><span>Innovator</span><span>Assets</span><span>Loan<br>period</span><span>Requested<br>on</span><span>Status</span><span>Actions</span><span></span>
              </div>
              @if (loading()) {
                <div class="table-state">Loading requests…</div>
              } @else if (pageError()) {
                <div class="table-state error" role="alert">{{ pageError() }} <button type="button" (click)="loadPage()">Try again</button></div>
              } @else if (!requests().length) {
                <div class="table-state">{{ totalRequests() === 0 ? 'There are no requests yet.' : 'No requests match the current filters.' }}</div>
              } @else {
                @for (request of requests(); track request.id) {
                  <article class="request-row request-grid">
                    <label class="selection-checkbox"><input type="checkbox" [attr.aria-label]="'Select request ' + request.id" [checked]="isSelected(request.id)" (change)="toggleSelection(request.id, $event)"></label>
                    <a class="request-id" [routerLink]="['/app/requests', request.id]">REQ-{{ request.id.slice(-4) | uppercase }}</a>
                    <a class="project-cell" [routerLink]="['/app/requests', request.id]"><strong>{{ request.projectName }}</strong><small>{{ request.projectAbstract }}</small></a>
                    <span class="innovator-cell">
                      <span class="avatar initials-avatar">{{ initials(request.innovator?.fullName) }}</span>
                      <span><strong>{{ request.innovator?.fullName || 'Unknown innovator' }}</strong><small>{{ request.innovator?.identificationId || '—' }}</small></span>
                    </span>
                    <span class="assets-cell">
                      @for (item of request.requestItems; track item.id || item.assetId) {
                        <span>{{ item.asset.name }} <small>× {{ item.quantity }}</small></span>
                      }
                    </span>
                    <span class="loan-cell">{{ request.loanDays }}<small>days</small></span>
                    <span class="date-cell">{{ request.createdAt | date:'MMM d, y' }}<small>{{ request.createdAt | date:'h:mm a' }}</small></span>
                    <span class="status-cell"><span class="status-pill" [class]="'status-pill ' + request.status.toLowerCase()"><i class="pi" [class]="statusIcon(request.status)"></i>{{ statusLabel(request.status) }}</span></span>
                    <div class="row-actions">
                      <a class="action-button view-button" [routerLink]="['/app/requests', request.id]"><i class="pi pi-eye"></i><span>View</span></a>
                      @if (request.status === RequestStatus.PENDING) {
                        <button class="action-button approve-button" type="button" [disabled]="busyId() === request.id" (click)="approve(request)"><i class="pi pi-check-circle"></i><span>Approve</span></button>
                        <button class="action-button reject-button" type="button" [disabled]="busyId() === request.id" (click)="reject(request)"><i class="pi pi-times"></i><span>Reject</span></button>
                      } @else if (request.status === RequestStatus.APPROVED) {
                        <button class="action-button approve-button" type="button" [disabled]="busyId() === request.id" (click)="checkout(request)"><i class="pi pi-sign-out"></i><span>Check Out</span></button>
                      } @else if (request.status === RequestStatus.CHECKED_OUT) {
                        <button class="action-button return-button" type="button" [disabled]="busyId() === request.id" (click)="returnRequest(request)"><i class="pi pi-replay"></i><span>Mark Returned</span></button>
                      }
                    </div>
                  </article>
                }
              }
            </div>
            @if (!loading() && !pageError()) {
              <footer class="table-footer">
                <span>Showing <strong>{{ pageStart() }}–{{ pageEnd() }}</strong> of <strong>{{ filteredTotal() }}</strong> requests</span>
                <div class="table-footer-controls">
                  <label class="page-size-control">Rows
                    <select aria-label="Requests per page" [ngModel]="pageSize()" (ngModelChange)="setPageSize($event)">
                      @for (size of pageSizes; track size) { <option [ngValue]="size">{{ size }}</option> }
                    </select>
                    per page
                  </label>
                  <nav class="pagination" aria-label="Request pages">
                    <button type="button" aria-label="Previous page" [disabled]="page() <= 1" (click)="goToPage(page() - 1)"><i class="pi pi-angle-left"></i></button>
                    @for (pageNumber of pageNumbers(); track pageNumber) {
                      <button type="button" [class.current]="page() === pageNumber" [attr.aria-current]="page() === pageNumber ? 'page' : null" [attr.aria-label]="'Page ' + pageNumber" (click)="goToPage(pageNumber)">{{ pageNumber }}</button>
                    }
                    <button type="button" aria-label="Next page" [disabled]="page() >= totalPages()" (click)="goToPage(page() + 1)"><i class="pi pi-angle-right"></i></button>
                  </nav>
                </div>
              </footer>
            }
            @if (message()) { <p class="feedback" [class.error]="messageType() === 'error'" role="status">{{ message() }}</p> }
          </section>
        </main>
  `,
  styles: [`
    :host { display:block; color:#172033; }
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
    .content { width:min(1160px,calc(100% - 48px)); margin:0 auto; padding:44px 0 72px; }
    .page-meta { min-height:32px; display:flex; justify-content:space-between; align-items:center; gap:16px; }
    .breadcrumbs { display:flex; align-items:center; gap:9px; color:#4c5b71; font-size:12px; }
    .breadcrumbs a { color:#1760f5; text-decoration:none; }
    .breadcrumbs .pi { font-size:11px; }
    .breadcrumbs>i { color:#9aa8bb; font-size:7px; }
    .system-meta { display:flex; align-items:center; gap:9px; }
    .date-chip,.online-chip { min-height:30px; display:inline-flex; align-items:center; gap:7px; padding:0 12px; border:1px solid #e0e7f0; border-radius:7px; background:#fff; color:#52647d; white-space:nowrap; font-size:11px; }
    .date-chip i { color:#3978ef; font-size:12px; }
    .online-chip { border-color:#c9f1dd; border-radius:12px; background:#edfff6; color:#07834e; font-weight:600; }
    .online-chip i { width:7px; height:7px; border-radius:50%; background:#08b879; }
    .online-chip.offline { color:#b4232c; border-color:#ffd1d4; background:#fff4f4; }
    .online-chip.offline i { background:#e33e4c; }
    .online-chip.checking { color:#7b8797; border-color:#e0e7f0; background:#f8fafc; }
    .online-chip.checking i { background:#93a0b0; }
    .page-heading { margin:16px 0 25px; }
    .eyebrow { margin:0 0 10px; color:#3ea945; font-size:10px; font-weight:800; letter-spacing:2px; }
    .page-heading h1 { margin:0; color:#262571; font:400 clamp(34px,4vw,46px)/1.05 Georgia,serif; letter-spacing:-.5px; }
    .page-heading h1 em { color:#3ea945; }
    .page-heading p { margin:9px 0 0; color:#667083; font-size:14px; line-height:1.5; }
    .metric-grid { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:14px; margin-bottom:24px; }
    .metric-card { min-width:0; width:100%; min-height:112px; display:grid; grid-template-columns:44px 1fr; grid-template-rows:1fr auto; align-items:center; column-gap:12px; padding:16px; border:1px solid #e6e8ee; border-radius:8px; background:#fff; color:inherit; text-align:left; cursor:pointer; transition:border-color .15s,box-shadow .15s; }
    .metric-card:hover,.metric-card.selected { border-color:#262571; box-shadow:0 0 0 1px #2625711a; }
    .metric-card:focus-visible { outline:3px solid #89be32; outline-offset:2px; }
    .metric-icon { grid-row:1; width:42px; height:42px; display:grid; place-items:center; border-radius:8px; background:#eef5ff; color:#2a4695; }
    .metric-icon i { font-size:18px; }
    .metric-copy { display:grid; gap:4px; }
    .metric-copy small { color:#667083; font-size:12px; }
    .metric-copy strong { color:#262571; font:30px/1 Georgia,serif; }
    .metric-note { grid-column:1 / -1; align-self:end; padding-top:8px; color:#8795a9; font-size:11px; white-space:nowrap; }
    .metric-note i { margin-right:4px; font-size:10px; }
    .metric-note.growth { color:#13a875; }
    .metric-note.decline { color:#eb4652; }
    .metric-note.overdue-growth { color:#a43bdd; }
    .metrics-error { margin:-5px 0 12px; color:#b4232c; font-size:9px; }
    .metrics-error button { margin-left:5px; padding:3px 7px; border:1px solid #e2c6c8; border-radius:5px; background:#fff; color:#a51f20; font-size:8px; }
    .pending-card .metric-icon { background:#fff8e7; color:#ed9900; }
    .approved-card .metric-icon { background:#eafbf4; color:#0c9a64; }
    .rejected-card .metric-icon { background:#fff0f0; color:#e6292a; }
    .overdue-card .metric-icon { background:#f8efff; color:#8b42b5; }
    .requests-panel { position:relative; overflow:visible; border:1px solid #e6e8ee; border-radius:8px; background:#fff; box-shadow:0 1px 2px #20324c08; }
    .panel-heading { min-height:58px; display:flex; align-items:center; padding:0 20px; }
    .panel-heading h2 { margin:0; color:#262571; font:24px Georgia,serif; }
    .filter-toolbar { position:relative; display:flex; align-items:center; flex-wrap:wrap; gap:10px; padding:0 18px 16px; }
    .status-filters { flex:1 1 100%; min-height:42px; display:flex; align-content:flex-start; align-items:center; flex-wrap:wrap; gap:5px 8px; padding:5px; border:1px solid #e6e8ee; border-radius:6px; background:#f8fafc; }
    .status-filters button { min-height:30px; display:inline-flex; align-items:center; gap:6px; padding:0 11px; border:0; border-radius:5px; background:transparent; color:#394b63; white-space:nowrap; font-size:12px; }
    .status-filters button.selected { background:#262571; color:#fff; }
    .status-filters button span { opacity:.82; }
    .status-dot { width:7px; height:7px; display:inline-block; border-radius:50%; background:#f2a900; }
    .approved-dot,.returned-dot { background:#3ea945; }
    .rejected-dot { background:#e6292a; }
    .overdue-dot { background:#8b42b5; }
    .checked-out-dot { background:#2a4695; }
    .table-search { flex:1 1 280px; height:40px; margin-top:0; border-radius:5px; }
    .table-search input { font-size:12px; }
    .filter-button { height:40px; display:flex; align-items:center; gap:7px; padding:0 14px; border:1px solid #dce0e8; border-radius:5px; background:#fff; color:#262571; white-space:nowrap; font-size:12px; }
    .filter-button .pi { color:#262571; font-size:13px; }
    .filter-popover { position:absolute; z-index:8; top:48px; right:18px; width:260px; display:grid; gap:9px; padding:16px; border:1px solid #dce0e8; border-radius:6px; background:#fff; box-shadow:0 8px 24px #162a441f; }
    .filter-popover label { color:#52647d; font-size:12px; }
    .filter-popover select,.filter-popover input { width:100%; min-height:36px; padding:7px 9px; border:1px solid #dce0e8; border-radius:4px; color:#263850; background:#fff; font-size:12px; }
    .filter-popover button { justify-self:end; padding:8px 13px; border:0; border-radius:4px; background:#262571; color:#fff; font-size:12px; }
    .filter-actions { display:flex; justify-content:flex-end; gap:6px; }
    .filter-popover .clear-filter { border:1px solid #dce0e8; background:#fff; color:#52647d; }
    .table-scroll { overflow-x:auto; }
    .request-grid { display:grid; grid-template-columns:30px 70px minmax(130px,1.1fr) minmax(130px,1fr) minmax(120px,1fr) 65px 95px 110px minmax(235px,1.7fr) 18px; column-gap:8px; align-items:center; }
    .table-head { min-height:52px; padding:0 18px; border-top:1px solid #edf0f4; border-bottom:1px solid #e6e8ee; background:#f8fafc; color:#586174; font-size:11px; line-height:1.35; font-weight:700; letter-spacing:.35px; text-transform:uppercase; }
    .request-row { position:relative; min-height:94px; padding:12px 18px; border-bottom:1px solid #edf0f4; }
    .request-row:last-child { border-bottom:0; }
    .selection-checkbox { display:grid; place-items:center; width:20px; height:24px; cursor:pointer; }
    .selection-checkbox input { width:15px; height:15px; margin:0; accent-color:#262571; cursor:pointer; }
    .selection-checkbox input:focus-visible { outline:2px solid #3ea945; outline-offset:2px; }
    .request-id { color:#262571; text-decoration:none; font-size:12px; line-height:1.35; overflow-wrap:anywhere; }
    .project-cell,.innovator-cell,.assets-cell,.date-cell,.loan-cell { min-width:0; color:#2b394d; }
    .project-cell,.project-cell strong,.project-cell small,.innovator-cell strong,.innovator-cell small,.assets-cell>span,.assets-cell>small,.loan-cell small,.date-cell small { display:block; }
    .project-cell { text-decoration:none; }
    .project-cell strong { display:-webkit-box; overflow:hidden; -webkit-box-orient:vertical; -webkit-line-clamp:3; color:#262571; font-size:13px; line-height:1.35; font-weight:650; }
    .project-cell small { display:-webkit-box; overflow:hidden; -webkit-box-orient:vertical; -webkit-line-clamp:3; margin-top:4px; color:#667083; font-size:11px; line-height:1.4; }
    .innovator-cell { display:flex; align-items:center; gap:8px; }
    .initials-avatar { width:30px; height:30px; flex-basis:30px; border-color:#edf0f4; font-size:10px; }
    .innovator-cell strong { display:-webkit-box; overflow:hidden; -webkit-box-orient:vertical; -webkit-line-clamp:2; color:#2d3a4e; font-size:12px; line-height:1.3; font-weight:600; }
    .innovator-cell small { overflow:hidden; text-overflow:ellipsis; margin-top:4px; color:#7c8492; font-size:10px; }
    .assets-cell { color:#35455b; font-size:11px; line-height:1.5; }
    .assets-cell>span { display:-webkit-box; overflow:hidden; -webkit-box-orient:vertical; -webkit-line-clamp:2; line-height:1.3; }
    .assets-cell small { color:#7c8492; font-size:10px; }
    .loan-cell { font-size:12px; }
    .loan-cell small { color:#71819a; font-size:10px; }
    .date-cell { white-space:nowrap; font-size:11px; }
    .date-cell small { padding-top:4px; color:#7c8492; font-size:10px; }
    .status-pill { width:max-content; max-width:100%; min-width:76px; min-height:27px; display:inline-flex; align-items:center; justify-content:center; gap:5px; padding:4px 9px; border:1px solid #ffe09b; border-radius:14px; background:#fffaf0; color:#b87300; font-size:10px; line-height:1.2; }
    .status-pill .pi { font-size:6px; }
    .status-pill.approved { border-color:#b6f0d5; background:#effdf6; color:#078a58; }
    .status-pill.returned { border-color:#ddc8f7; background:#f7f1ff; color:#7844a5; }
    .status-pill.rejected { border-color:#ffc8ce; background:#fff2f3; color:#de3448; }
    .status-pill.checked_out { max-width:100%; min-height:27px; flex-wrap:wrap; border-color:#c8d9ff; background:#f1f6ff; color:#2360e8; }
    .status-pill.overdue { border-color:#e3c8ff; background:#faf3ff; color:#9b3bd0; }
    .row-actions { display:flex; align-items:center; justify-content:flex-start; gap:6px; min-width:0; }
    .action-button { min-width:0; height:30px; display:inline-flex; align-items:center; justify-content:center; gap:5px; padding:0 9px; border:1px solid #d2e3ff; border-radius:4px; background:#f7faff; color:#2a4695; white-space:nowrap; text-decoration:none; font-size:11px; }
    .action-button i { font-size:12px; }
    .approve-button { border-color:#a8e9ce; background:#f2fff9; color:#0c7b51; }
    .reject-button { border-color:#ffc3c8; background:#fff7f7; color:#c92832; }
    .action-button:disabled { cursor:not-allowed; border-color:#e2e7ed; background:#f8fafc; color:#a9b5c5; }
    .more-cell { position:relative; }
    .more-button { width:22px; height:30px; padding:0; border:0; background:transparent; color:#8392a7; }
    .more-button i { font-size:13px; }
    .more-button:disabled { cursor:not-allowed; opacity:.45; }
    .action-menu { position:absolute; z-index:5; top:30px; right:0; width:160px; display:grid; padding:5px; border:1px solid #e1e7ef; border-radius:5px; background:#fff; box-shadow:0 5px 16px #1b2a3d20; }
    .action-menu button,.action-menu span { padding:8px; border:0; background:#fff; color:#34465c; text-align:left; font-size:11px; }
    .action-menu button:hover { background:#f4f7fb; }
    .action-menu button:disabled { color:#99a5b5; }
    .table-state { min-height:180px; display:flex; justify-content:center; align-items:center; gap:10px; padding:24px; color:#667083; font-size:14px; }
    .table-state.error { color:#b4232c; }
    .table-state button { padding:8px 12px; border:1px solid #dce0e8; border-radius:4px; background:#fff; color:#262571; font-size:12px; }
    .table-footer { min-height:54px; display:flex; align-items:center; justify-content:space-between; gap:12px; padding:10px 18px; border-top:1px solid #edf0f4; color:#667083; font-size:11px; }
    .table-footer strong { color:#3b4d65; font-weight:600; }
    .table-footer-controls { display:flex; align-items:center; gap:14px; }
    .page-size-control { display:flex; align-items:center; gap:4px; white-space:nowrap; }
    .page-size-control select { min-height:30px; padding:3px 7px; border:1px solid #dce0e8; border-radius:4px; background:#fff; color:#50617a; font-size:11px; }
    .pagination { display:flex; align-items:center; gap:4px; }
    .pagination button { min-width:30px; height:30px; padding:0 8px; border:1px solid #dce0e8; border-radius:4px; background:#fff; color:#50617a; font-size:11px; }
    .pagination button.current { border-color:#262571; background:#262571; color:#fff; }
    .pagination button:disabled { cursor:not-allowed; color:#b2bdcc; }
    .feedback { margin:10px 18px; color:#078a58; font-size:12px; }
    .feedback.error { color:#b4232c; }
    .menu-toggle,.nav-scrim { display:none; }
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
      .content { width:100%; padding:18px 14px 28px; }
      .metric-grid { grid-template-columns:repeat(2,minmax(0,1fr)); gap:7px; }
      .metric-card:last-child { grid-column:span 2; }
      .page-meta { align-items:flex-start; flex-direction:column; padding:3px 0 6px; }
      .system-meta { align-self:flex-end; }
      .filter-toolbar { align-items:flex-start; }
      .status-filters { min-width:100%; }
      .table-search { flex:1 1 180px; }
      .table-scroll { padding-bottom:3px; }
      .request-grid { min-width:1080px; }
      .table-footer { align-items:flex-start; flex-direction:column; padding:9px 10px; }
      .table-footer-controls { width:100%; justify-content:space-between; gap:5px; }
      .pagination { align-self:flex-end; }
      .create-dialog { padding:18px; }
    }
    @media (max-width:390px) {
      .global-search { gap:5px; padding:0 7px; }
      .global-search input { font-size:7px; }
      .notification-indicator { display:none; }
      .date-chip { font-size:7px; }
      .page-heading p { max-width:290px; line-height:1.5; }
      .metric-card { padding:12px; }
      .metric-copy small { font-size:11px; }
      .metric-note { white-space:normal; }
    }
  `]
})
export class AdminRequestsPageComponent {
  private readonly service = inject(RequestService);
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
  protected readonly selectedIds = signal<Set<string>>(new Set());
  protected readonly busyId = signal<string | null>(null);
  protected readonly filterMenuOpen = signal(false);
  protected readonly message = signal('');
  protected readonly messageType = signal<'success' | 'error'>('success');
  protected readonly totalRequests = computed(() => this.statusCounts()?.total ?? null);
  protected readonly pageStart = computed(() => this.filteredTotal() === 0 ? 0 : (this.page() - 1) * this.pageSize() + 1);
  protected readonly pageEnd = computed(() => Math.min(this.page() * this.pageSize(), this.filteredTotal()));
  protected readonly allOnPageSelected = computed(() => this.requests().length > 0 && this.requests().every(request => this.selectedIds().has(request.id)));
  protected readonly someOnPageSelected = computed(() => this.requests().some(request => this.selectedIds().has(request.id)));
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

  protected isSelected(requestId: string): boolean {
    return this.selectedIds().has(requestId);
  }

  protected toggleSelection(requestId: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.selectedIds.update(selected => {
      const next = new Set(selected);
      if (checked) next.add(requestId);
      else next.delete(requestId);
      return next;
    });
  }

  protected togglePageSelection(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.selectedIds.update(selected => {
      const next = new Set(selected);
      for (const request of this.requests()) {
        if (checked) next.add(request.id);
        else next.delete(request.id);
      }
      return next;
    });
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

  private action(request: AssetRequest, operation: (id: string) => ReturnType<RequestService['approve']>, success: string): void {
    if (!confirm(`${success}?`)) return;
    this.busyId.set(request.id);
    this.message.set('');
    operation(request.id).pipe(finalize(() => this.busyId.set(null))).subscribe({
      next: () => {
        this.message.set(`${success}.`);
        this.messageType.set('success');
        this.loadPage();
      },
      error: () => {
        this.message.set('The request could not be updated.');
        this.messageType.set('error');
      }
    });
  }

  protected approve(request: AssetRequest): void { this.action(request, id => this.service.approve(id), 'Request approved'); }
  protected reject(request: AssetRequest): void {
    const reason = window.prompt('Enter a reason for rejecting this request.')?.trim();
    if (!reason) return;
    this.action(request, id => this.service.reject(id, reason), 'Request rejected');
  }
  protected checkout(request: AssetRequest): void { this.action(request, id => this.service.checkout(id), 'Request checked out'); }
  protected returnRequest(request: AssetRequest): void { this.action(request, id => this.service.returnAsset(id), 'Request marked returned'); }

  protected initials(name?: string | null): string {
    return name?.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0].toUpperCase()).join('') || 'AD';
  }

  protected statusLabel(status: string): string {
    return status.toLowerCase().split('_').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
  }

  protected countFor(status: RequestStatus): number | '—' {
    return this.statusCounts()?.[status] ?? '—';
  }

  protected statusDotClass(status: RequestStatus): string {
    return `status-dot ${status.toLowerCase().replace('_', '-')}-dot`;
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
