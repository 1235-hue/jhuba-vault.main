import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RequestStore } from '../state/request.store';
import { RequestStatus } from '../core/models';

@Component({
  selector: 'jhub-request-submitted-page',
  standalone: true,
  styleUrls: ['./innovator-theme.component.css'],
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="submitted page-width"><div class="submitted-mark" aria-hidden="true">✓</div><p class="eyebrow">REQUEST RECEIVED</p><h1>Your request is <em>in review.</em></h1><p class="lead">The request has been prepared for submission to the JHUB Africa Vault. It is currently marked <strong>{{ RequestStatus.PENDING }}</strong>; an administrator must review it before collection.</p><section class="confirmation"><span>Request reference<strong>{{ request.submission().requestId || 'Pending reference' }}</strong></span><span>Project<strong>{{ request.draft().projectName || 'Project request' }}</strong></span><span>Status<strong class="pending">{{ RequestStatus.PENDING }}</strong></span></section><div class="actions"><a class="primary-button" routerLink="/app/requests">View my requests <span>→</span></a><a class="secondary-button" routerLink="/catalogue">Browse more assets</a></div></main>
  `,
  styles: [`:host{display:block}.submitted{padding:90px 0 140px;max-width:850px}.submitted-mark{width:62px;height:62px;display:grid;place-items:center;background:#e5f2e6;color:#3ea945;font-size:34px;margin-bottom:25px}.eyebrow{color:#3ea945;font-size:10px;font-weight:800;letter-spacing:2px;margin:0 0 18px}.submitted h1{font:400 clamp(42px,6vw,66px)/1.02 Georgia,serif;color:#262571;margin:0}.submitted h1 em{color:#3ea945}.lead{color:#667083;font-size:15px;line-height:1.7;max-width:650px}.lead strong{color:#b17b19}.confirmation{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:#e6e8ee;margin:35px 0}.confirmation span{background:#fff;padding:20px;color:#7c8492;font-size:10px;text-transform:uppercase;letter-spacing:1px}.confirmation strong{display:block;color:#262571;font:18px Georgia,serif;letter-spacing:0;text-transform:none;margin-top:10px}.confirmation .pending{color:#b17b19;font:700 12px 'Segoe UI',sans-serif}.actions{display:flex;gap:10px;flex-wrap:wrap}.primary-button,.secondary-button{display:inline-flex;align-items:center;gap:22px;padding:15px 20px;text-decoration:none;font-weight:700;font-size:13px}.primary-button{background:#262571;color:#fff}.secondary-button{border:1px solid #cfd4df;color:#262571}@media(max-width:760px){.submitted{padding-top:55px}.confirmation{grid-template-columns:1fr}.actions a{width:100%;justify-content:space-between}}`]
})
export class RequestSubmittedPageComponent {
  protected readonly request = inject(RequestStore);
  protected readonly RequestStatus = RequestStatus;
}
