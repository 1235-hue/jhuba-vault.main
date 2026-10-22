import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RequestService } from '../core/api.service';
import { AssetRequest, RequestStatus } from '../core/models';

@Component({
  selector: 'jhub-request-history-page',
  standalone: true,
  styleUrls: ['./innovator-theme.component.css'],
  imports: [DatePipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="history-page page-width"><div class="heading"><div><p class="eyebrow">INNOVATOR WORKSPACE</p><h1>My <em>requests.</em></h1><p>Track every request from review through return.</p></div><a class="primary-button" routerLink="/catalogue">Find assets <span>→</span></a></div>@if (loading()) {<div class="state">Loading your requests…</div>} @else if (error()) {<div class="state error" role="alert">{{ error() }}</div>} @else if (!requests().length) {<div class="state"><strong>No requests yet.</strong><span>Your submitted requests will appear here.</span><a class="secondary-button" routerLink="/catalogue">Browse catalogue</a></div>} @else {<section class="request-list">@for (request of requests(); track request.id) {<a class="request-row" [routerLink]="['/app/requests', request.id]"><span><strong>{{ request.projectName }}</strong><small>{{ request.id }} · {{ request.requestItems.length }} asset{{ request.requestItems.length === 1 ? '' : 's' }}</small></span><span><small>Submitted</small><strong>{{ request.createdAt | date:'d MMM yyyy' }}</strong></span><span class="status" [class]="request.status.toLowerCase()">{{ request.status }}</span><span aria-hidden="true">→</span></a>}</section>}
    </main>
  `,
  styles: [`:host{display:block}.page-width{width:min(1100px,calc(100% - 48px));margin:auto}.history-page{padding:60px 0 110px}.heading{display:flex;align-items:end;justify-content:space-between;gap:20px;margin-bottom:35px}.eyebrow{color:#3ea945;font-size:10px;font-weight:800;letter-spacing:2px;margin:0 0 16px}.heading h1{font:400 clamp(42px,5vw,60px)/1.05 Georgia,serif;color:#262571;margin:0}.heading h1 em{color:#3ea945}.heading p:last-child{color:#667083;font-size:13px}.primary-button,.secondary-button{display:inline-flex;align-items:center;gap:20px;padding:14px 18px;text-decoration:none;font-size:12px;font-weight:700}.primary-button{background:#262571;color:#fff}.secondary-button{border:1px solid #cfd4df;color:#262571}.request-list{background:#fff;border:1px solid #e6e8ee}.request-row{display:grid;grid-template-columns:2fr 1fr auto 20px;align-items:center;gap:22px;padding:20px 24px;border-bottom:1px solid #edf0f4;text-decoration:none;color:#262571}.request-row:last-child{border-bottom:0}.request-row strong,.request-row small{display:block}.request-row strong{font-size:14px}.request-row small{font-size:10px;color:#7c8492;margin-top:5px}.status{font-size:10px;font-weight:800;letter-spacing:1px}.pending{color:#b17b19}.approved{color:#3ea945}.rejected,.overdue{color:#e6292a}.checked_out{color:#2a4695}.returned{color:#667083}.state{display:flex;flex-direction:column;align-items:flex-start;gap:12px;background:#fff;border:1px solid #e6e8ee;padding:35px;color:#667083;font-size:12px}.state strong{font:25px Georgia,serif;color:#262571}.state.error{color:#a51f20}@media(max-width:700px){.heading{display:block}.heading .primary-button{margin-top:20px}.request-row{grid-template-columns:1fr auto;gap:12px}.request-row>span:nth-child(2){display:none}}`]
})
export class RequestHistoryPageComponent {
  private readonly service = inject(RequestService);
  protected readonly requests = signal<AssetRequest[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly RequestStatus = RequestStatus;
  constructor() { this.service.listMine().subscribe({ next: requests => { this.requests.set(requests); this.loading.set(false); }, error: () => { this.error.set('Unable to load your requests.'); this.loading.set(false); } }); }
}
