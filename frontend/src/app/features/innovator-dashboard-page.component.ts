import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RequestService } from '../core/api.service';
import { AssetStore } from '../state/asset.store';
import { AssetRequest, RequestStatus } from '../core/models';

@Component({
  selector: 'jhub-innovator-dashboard-page',
  standalone: true,
  styleUrls: ['./innovator-theme.component.css'],
  imports: [DatePipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="dashboard page-width"><div class="heading"><div><p class="eyebrow">INNOVATOR WORKSPACE</p><h1>Your ideas, <em>in motion.</em></h1><p>Track requests and find the tools for your next project.</p></div><a class="primary-button" routerLink="/catalogue">Browse assets <span>→</span></a></div>@if (loading()) {<div class="state">Loading your workspace…</div>} @else if (error()) {<div class="state error" role="alert">{{ error() }}</div>} @else {<div class="metrics"><div><small>PENDING</small><strong>{{ count(RequestStatus.PENDING) }}</strong></div><div><small>APPROVED</small><strong>{{ count(RequestStatus.APPROVED) }}</strong></div><div><small>ACTIVE LOANS</small><strong>{{ count(RequestStatus.CHECKED_OUT) + count(RequestStatus.OVERDUE) }}</strong></div><div><small>RETURNED</small><strong>{{ count(RequestStatus.RETURNED) }}</strong></div></div><section class="recent"><div class="section-heading"><div><p class="eyebrow">RECENT ACTIVITY</p><h2>Your requests</h2></div><a class="arrow-link" routerLink="/app/requests">View all ↗</a></div>@if (!requests().length) {<div class="empty">No requests yet. Start by browsing the catalogue.</div>} @else {@for (request of requests().slice(0, 5); track request.id) {<a class="request-row" [routerLink]="['/app/requests', request.id]"><span><strong>{{ request.projectName }}</strong><small>{{ request.id }} · {{ request.createdAt | date:'d MMM yyyy' }}</small></span><span class="status" [class]="request.status.toLowerCase()">{{ request.status }}</span><span>→</span></a>}}</section>}
    </main>
  `,
  styles: [`:host{display:block}.page-width{width:min(1100px,calc(100% - 48px));margin:auto}.dashboard{padding:60px 0 110px}.heading,.section-heading{display:flex;align-items:end;justify-content:space-between;gap:20px}.heading{margin-bottom:35px}.eyebrow{color:#3ea945;font-size:10px;font-weight:800;letter-spacing:2px;margin:0 0 16px}.heading h1{font:400 clamp(42px,5vw,60px)/1.05 Georgia,serif;color:#262571;margin:0}.heading h1 em{color:#3ea945}.heading p:last-child{color:#667083;font-size:13px}.primary-button{display:inline-flex;align-items:center;gap:20px;background:#262571;color:#fff;text-decoration:none;padding:14px 18px;font-size:12px;font-weight:700}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:30px}.metrics div{background:#fff;border:1px solid #e6e8ee;padding:22px}.metrics small,.metrics strong{display:block}.metrics small{font-size:10px;color:#7c8492;letter-spacing:1px}.metrics strong{font:40px Georgia,serif;color:#262571;margin-top:12px}.section-heading{margin-bottom:16px}.section-heading h2{font:30px Georgia,serif;color:#262571;margin:0}.arrow-link{color:#262571;text-decoration:none;font-size:12px;font-weight:700}.recent{background:#fff;border:1px solid #e6e8ee;padding:25px}.request-row{display:grid;grid-template-columns:1fr auto 20px;gap:20px;align-items:center;padding:17px 0;border-bottom:1px solid #edf0f4;color:#262571;text-decoration:none}.request-row:last-child{border-bottom:0}.request-row strong,.request-row small{display:block}.request-row strong{font-size:14px}.request-row small{font-size:10px;color:#7c8492;margin-top:5px}.status{font-size:10px;font-weight:800;letter-spacing:1px}.pending{color:#b17b19}.approved{color:#3ea945}.rejected,.overdue{color:#e6292a}.checked_out{color:#2a4695}.returned{color:#667083}.empty,.state{background:#fff;border:1px solid #e6e8ee;padding:30px;color:#667083;font-size:12px}.state.error{color:#a51f20}@media(max-width:700px){.heading,.section-heading{display:block}.heading .primary-button,.section-heading .arrow-link{display:inline-flex;margin-top:18px}.metrics{grid-template-columns:1fr 1fr}.request-row{grid-template-columns:1fr auto}}`]
})
export class InnovatorDashboardPageComponent {
  private readonly requestService = inject(RequestService);
  protected readonly assetStore = inject(AssetStore);
  protected readonly requests = signal<AssetRequest[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly RequestStatus = RequestStatus;
  constructor() { this.requestService.listMine().subscribe({ next: requests => { this.requests.set(requests); this.loading.set(false); }, error: () => { this.error.set('Unable to load your workspace.'); this.loading.set(false); } }); }
  protected count(status: RequestStatus): number { return this.requests().filter(request => request.status === status).length; }
}
