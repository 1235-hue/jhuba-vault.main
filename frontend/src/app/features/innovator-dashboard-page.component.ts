import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RequestService } from '../core/api.service';
import { AssetRequest, RequestItem, RequestStatus } from '../core/models';
import { AuthStore } from '../state/auth.store';

interface LoanRow {
  request: AssetRequest;
  item: RequestItem;
}

@Component({
  selector: 'jhub-innovator-dashboard-page',
  standalone: true,
  styleUrls: ['./innovator-theme.component.css'],
  imports: [DatePipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="dashboard page-width">
      <section class="welcome" aria-labelledby="dashboard-title">
        <div class="welcome-copy">
          <p class="eyebrow">INNOVATOR WORKSPACE</p>
          @if (auth.user(); as user) {
            <p class="greeting">Good {{ greeting() }}, {{ firstName(user.fullName) }}.</p>
          }
          <h1 id="dashboard-title">Your ideas, <em>in motion.</em></h1>
          <p class="welcome-description">Manage your technology requests, projects, and active loans.</p>
        </div>
        <div class="welcome-actions">
          <a class="primary-button" routerLink="/app/requests/new">Request Components <span aria-hidden="true">→</span></a>
          <a class="secondary-button" routerLink="/catalogue">Browse Asset Catalogue</a>
        </div>
      </section>

      @if (loading()) {
        <div class="state" role="status">Loading your workspace…</div>
      } @else if (error()) {
        <div class="state error" role="alert">
          <span>{{ error() }}</span>
          <button class="retry-button" type="button" (click)="loadRequests()">Try again</button>
        </div>
      } @else {
        <section class="metrics" aria-label="Your request and loan summary">
          <a class="metric-card" routerLink="/app/requests">
            <span class="metric-icon pending-icon" aria-hidden="true">◷</span>
            <span class="metric-copy"><small>Pending Requests</small><strong>{{ count(RequestStatus.PENDING) }}</strong></span>
            <span class="metric-link">View all <span aria-hidden="true">→</span></span>
          </a>
          <a class="metric-card" routerLink="/app/requests">
            <span class="metric-icon approved-icon" aria-hidden="true">✓</span>
            <span class="metric-copy"><small>Approved Requests</small><strong>{{ count(RequestStatus.APPROVED) }}</strong></span>
            <span class="metric-link">View all <span aria-hidden="true">→</span></span>
          </a>
          <a class="metric-card" routerLink="/app/loans">
            <span class="metric-icon loans-icon" aria-hidden="true">▣</span>
            <span class="metric-copy"><small>Active Loans</small><strong>{{ activeLoanCount() }}</strong></span>
            <span class="metric-link">View all <span aria-hidden="true">→</span></span>
          </a>
          <a class="metric-card" routerLink="/app/loans">
            <span class="metric-icon overdue-icon" aria-hidden="true">!</span>
            <span class="metric-copy"><small>Overdue Loans</small><strong>{{ overdueLoanCount() }}</strong></span>
            <span class="metric-link">View all <span aria-hidden="true">→</span></span>
          </a>
          <a class="metric-card" routerLink="/app/requests">
            <span class="metric-icon returned-icon" aria-hidden="true">↩</span>
            <span class="metric-copy"><small>Returned Items</small><strong>{{ returnedItemCount() }}</strong></span>
            <span class="metric-link">View all <span aria-hidden="true">→</span></span>
          </a>
        </section>

        <div class="dashboard-columns">
          <section class="panel requests-panel" aria-labelledby="recent-requests-title">
            <div class="panel-heading">
              <div>
                <p class="eyebrow">RECENT ACTIVITY</p>
                <h2 id="recent-requests-title">Recent Requests</h2>
              </div>
              <a class="arrow-link" routerLink="/app/requests">View all requests <span aria-hidden="true">↗</span></a>
            </div>
            @if (!recentRequests().length) {
              <div class="empty-state">
                <strong>No requests yet.</strong>
                <span>Your submitted component requests will appear here.</span>
                <a class="secondary-button" routerLink="/catalogue">Browse asset catalogue</a>
              </div>
            } @else {
              <div class="table-scroll">
                <table>
                  <thead>
                    <tr><th>Request ID</th><th>Project</th><th>Requested Items</th><th>Submitted</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    @for (request of recentRequests(); track request.id) {
                      <tr>
                        <td><a class="request-link" [routerLink]="['/app/requests', request.id]">REQ-{{ request.id.slice(-6).toUpperCase() }}</a></td>
                        <td class="project-name">{{ request.projectName }}</td>
                        <td>{{ requestedItems(request) }}</td>
                        <td>{{ request.createdAt | date:'d MMM yyyy' }}</td>
                        <td><span class="status" [class]="'status ' + request.status.toLowerCase()">{{ statusLabel(request.status) }}</span></td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </section>

          <section class="panel loans-panel" aria-labelledby="active-loans-title">
            <div class="panel-heading">
              <div>
                <p class="eyebrow">EQUIPMENT ON LOAN</p>
                <h2 id="active-loans-title">Active Loans</h2>
              </div>
              <a class="arrow-link" routerLink="/app/loans">View all loans <span aria-hidden="true">↗</span></a>
            </div>
            @if (!loanRows().length) {
              <div class="empty-state">
                <strong>No active loans.</strong>
                <span>Approved equipment loans will appear here once checked out.</span>
                <a class="secondary-button" routerLink="/app/requests">View your requests</a>
              </div>
            } @else {
              <div class="table-scroll">
                <table>
                  <thead>
                    <tr><th>Asset</th><th>Tag</th><th>Qty</th><th>Requested Start</th><th>Expected Return</th></tr>
                  </thead>
                  <tbody>
                    @for (loan of loanRows(); track loan.request.id + loan.item.assetId) {
                      <tr [class.overdue-row]="isOverdue(loan.request)">
                        <td>
                          <a class="request-link asset-name" [routerLink]="['/app/requests', loan.request.id]">{{ loan.item.asset.name }}</a>
                          @if (isOverdue(loan.request)) { <small class="overdue-note">Overdue</small> }
                        </td>
                        <td>{{ loan.item.asset.assetTag || '—' }}</td>
                        <td>{{ loan.item.quantity }}</td>
                        <td>{{ loan.request.startDate | date:'d MMM yyyy' }}</td>
                        <td>{{ loan.request.expectedReturn | date:'d MMM yyyy' }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </section>
        </div>

        <section class="quick-actions" aria-labelledby="quick-actions-title">
          <div class="section-heading">
            <div><p class="eyebrow">GET STARTED</p><h2 id="quick-actions-title">Quick Actions</h2></div>
          </div>
          <div class="action-grid">
            <a class="action-card" routerLink="/catalogue">
              <span class="action-icon" aria-hidden="true">⌕</span>
              <span><strong>Browse Assets</strong><small>Explore available technology equipment and components.</small></span>
              <span class="action-arrow" aria-hidden="true">→</span>
            </a>
            <a class="action-card" routerLink="/app/requests/new">
              <span class="action-icon" aria-hidden="true">＋</span>
              <span><strong>New Request</strong><small>Request the components needed for your project.</small></span>
              <span class="action-arrow" aria-hidden="true">→</span>
            </a>
            <a class="action-card" routerLink="/app/requests">
              <span class="action-icon" aria-hidden="true">≡</span>
              <span><strong>View Requests</strong><small>Track request status and view your history.</small></span>
              <span class="action-arrow" aria-hidden="true">→</span>
            </a>
            <a class="action-card" routerLink="/app/profile">
              <span class="action-icon" aria-hidden="true">♙</span>
              <span><strong>Complete Profile</strong><small>Update your innovator details and project information.</small></span>
              <span class="action-arrow" aria-hidden="true">→</span>
            </a>
          </div>
        </section>
      }
    </main>
  `,
  styles: [`
    :host { display:block; }
    .page-width { width:min(1100px,calc(100% - 48px)); margin:0 auto; }
    .dashboard { padding:46px 0 80px; }
    .welcome { display:flex; align-items:flex-end; justify-content:space-between; gap:24px; margin-bottom:28px; }
    .eyebrow { margin:0 0 10px; color:#3ea945; font-size:9px; font-weight:800; letter-spacing:1.8px; }
    .greeting { margin:0 0 7px; color:#667083; font-size:13px; }
    .welcome h1 { margin:0; color:#262571; font:400 clamp(36px,5vw,54px)/1.05 Georgia,serif; }
    .welcome h1 em { color:#3ea945; }
    .welcome-description { margin:8px 0 0; color:#667083; font-size:12px; }
    .welcome-actions { display:flex; flex-wrap:wrap; align-items:center; gap:9px; }
    .primary-button,.secondary-button { min-height:38px; display:inline-flex; align-items:center; justify-content:center; gap:14px; padding:0 14px; border-radius:3px; font-size:10px; font-weight:700; text-decoration:none; white-space:nowrap; }
    .primary-button { background:#262571; color:#fff; }
    .secondary-button { border:1px solid #cfd4df; background:#fff; color:#262571; }
    .primary-button:hover { background:#2a4695; }
    .secondary-button:hover { border-color:#262571; }
    .metrics { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:10px; margin-bottom:18px; }
    .metric-card { min-width:0; display:grid; grid-template-columns:32px minmax(0,1fr); grid-template-rows:1fr auto; align-items:center; column-gap:10px; row-gap:8px; padding:14px 13px 11px; border:1px solid #e6e8ee; background:#fff; color:inherit; text-decoration:none; transition:border-color .15s,box-shadow .15s; }
    .metric-card:hover,.action-card:hover { border-color:#262571; box-shadow:0 3px 12px #17203310; }
    .metric-card:focus-visible,.action-card:focus-visible,.arrow-link:focus-visible,.request-link:focus-visible { outline:2px solid #3ea945; outline-offset:2px; }
    .metric-icon { width:30px; height:30px; display:grid; place-items:center; border-radius:5px; background:#eef3ff; color:#2a4695; font-size:16px; font-weight:700; }
    .pending-icon { background:#fff8e7; color:#b17b19; }
    .approved-icon,.returned-icon { background:#eafbf4; color:#238b55; }
    .overdue-icon { background:#fff0f0; color:#e6292a; }
    .metric-copy { min-width:0; }
    .metric-copy small,.metric-copy strong { display:block; }
    .metric-copy small { overflow:hidden; color:#7c8492; font-size:9px; text-overflow:ellipsis; white-space:nowrap; }
    .metric-copy strong { margin-top:4px; color:#262571; font:26px/1 Georgia,serif; }
    .metric-link { grid-column:1/-1; display:flex; justify-content:space-between; color:#2a4695; font-size:9px; }
    .dashboard-columns { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); align-items:start; gap:14px; }
    .panel { min-width:0; border:1px solid #e6e8ee; background:#fff; }
    .panel-heading,.section-heading { display:flex; align-items:flex-end; justify-content:space-between; gap:12px; padding:17px 17px 13px; }
    .panel-heading .eyebrow,.section-heading .eyebrow { margin-bottom:5px; font-size:8px; }
    .panel-heading h2,.section-heading h2 { margin:0; color:#262571; font:24px/1.1 Georgia,serif; }
    .arrow-link { color:#262571; font-size:9px; font-weight:700; text-decoration:none; white-space:nowrap; }
    .arrow-link:hover { color:#3ea945; }
    .table-scroll { width:100%; overflow-x:auto; }
    table { width:100%; border-collapse:collapse; text-align:left; }
    th { padding:9px 11px; border-top:1px solid #edf0f4; border-bottom:1px solid #e6e8ee; background:#f8fafc; color:#71819a; font-size:8px; font-weight:700; letter-spacing:.45px; text-transform:uppercase; white-space:nowrap; }
    td { padding:11px; border-bottom:1px solid #edf0f4; color:#54647b; font-size:9px; line-height:1.4; vertical-align:middle; }
    tbody tr:last-child td { border-bottom:0; }
    .request-link { color:#262571; font-weight:700; text-decoration:none; white-space:nowrap; }
    .request-link:hover { text-decoration:underline; }
    .project-name { min-width:90px; color:#263850; font-weight:600; }
    .status { display:inline-flex; padding:4px 6px; border-radius:3px; background:#fff8e7; color:#a46d0c; font-size:8px; font-weight:700; white-space:nowrap; }
    .status.approved,.status.returned { background:#eafbf4; color:#168354; }
    .status.rejected,.status.overdue { background:#fff0f0; color:#c92e39; }
    .status.checked_out { background:#eef3ff; color:#2a4695; }
    .asset-name { display:block; min-width:82px; white-space:normal; }
    .overdue-row td { background:#fffafa; }
    .overdue-note { display:block; margin-top:3px; color:#c92e39; font-size:8px; font-weight:700; }
    .empty-state { min-height:124px; display:flex; flex-direction:column; align-items:flex-start; justify-content:center; gap:8px; margin:0 13px 13px; padding:17px; border:1px solid #e6e8ee; color:#667083; font-size:10px; }
    .empty-state strong { color:#262571; font:18px Georgia,serif; }
    .empty-state .secondary-button { min-height:32px; margin-top:3px; font-size:9px; }
    .quick-actions { margin-top:23px; }
    .section-heading { padding:0 0 11px; }
    .action-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:10px; }
    .action-card { min-width:0; min-height:77px; display:grid; grid-template-columns:29px minmax(0,1fr) 12px; align-items:center; gap:9px; padding:12px; border:1px solid #e6e8ee; background:#fff; color:inherit; text-decoration:none; transition:border-color .15s,box-shadow .15s; }
    .action-icon { width:28px; height:28px; display:grid; place-items:center; border-radius:4px; background:#eef3ff; color:#2a4695; font-size:17px; }
    .action-card strong,.action-card small { display:block; }
    .action-card strong { color:#262571; font-size:10px; }
    .action-card small { margin-top:4px; color:#71819a; font-size:8px; line-height:1.4; }
    .action-arrow { color:#2a4695; font-size:13px; }
    .state { display:flex; align-items:center; gap:12px; padding:18px; border:1px solid #e6e8ee; background:#fff; color:#667083; font-size:11px; }
    .state.error { justify-content:space-between; border-color:#ffd1d4; background:#fff6f6; color:#a51f20; }
    .retry-button { border:1px solid #dce0e8; border-radius:3px; background:#fff; color:#262571; padding:7px 10px; font-size:10px; }
    @media(max-width:1000px) {
      .metrics { grid-template-columns:repeat(3,minmax(0,1fr)); }
      .action-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
    }
    @media(max-width:760px) {
      .dashboard { padding:32px 0 60px; }
      .welcome { align-items:flex-start; flex-direction:column; gap:16px; }
      .dashboard-columns { grid-template-columns:1fr; }
      .metrics { grid-template-columns:repeat(2,minmax(0,1fr)); }
      .panel-heading,.section-heading { align-items:flex-start; }
      .panel-heading h2,.section-heading h2 { font-size:22px; }
      table { min-width:580px; }
    }
    @media(max-width:480px) {
      .page-width { width:calc(100% - 28px); }
      .welcome h1 { font-size:38px; }
      .welcome-actions { width:100%; align-items:stretch; flex-direction:column; }
      .welcome-actions a { justify-content:space-between; }
      .metrics { gap:8px; }
      .metric-card { padding:11px 9px 9px; column-gap:7px; }
      .metric-copy small { font-size:8px; }
      .metric-copy strong { font-size:23px; }
      .panel-heading { padding:14px 12px 11px; }
      .panel-heading h2 { font-size:20px; }
      .arrow-link { font-size:8px; }
      .action-grid { grid-template-columns:1fr; }
      .state { align-items:flex-start; flex-direction:column; }
    }
  `]
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
