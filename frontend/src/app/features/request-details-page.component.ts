import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RequestService } from '../core/api.service';
import { AssetRequest, RequestStatus } from '../core/models';
import { AuthStore } from '../state/auth.store';
import { EmptyStateComponent } from '../shared/empty-state.component';
import { PageHeaderComponent } from '../shared/page-header.component';
import { StatusBadgeComponent } from '../shared/status-badge.component';
import { initials, requestRef } from '../shared/format';

interface Step {
  label: string;
  detail: string;
  state: 'done' | 'current' | 'upcoming' | 'bad';
}

@Component({
  selector: 'jhub-request-details-page',
  standalone: true,
  imports: [DatePipe, RouterLink, EmptyStateComponent, PageHeaderComponent, StatusBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './request-details-page.component.html',
  styleUrl: './request-details-page.component.css'
})
export class RequestDetailsPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(RequestService);
  protected readonly auth = inject(AuthStore);

  protected readonly request = signal<AssetRequest | null>(null);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly initials = initials;
  protected readonly requestRef = requestRef;
  protected readonly RequestStatus = RequestStatus;
  protected readonly backLink = computed(() => (this.auth.isAdmin() ? '/admin/requests' : '/app/requests'));

  protected readonly steps = computed<Step[]>(() => {
    const request = this.request();
    if (!request) return [];
    const status = request.status;
    const reached = (...list: RequestStatus[]) => list.includes(status);
    const rejected = status === RequestStatus.REJECTED;
    const steps: Step[] = [{ label: 'Submitted', detail: 'Request received by the Vault', state: 'done' }];

    if (rejected) {
      steps.push({ label: 'Rejected', detail: request.rejectionReason || 'The request was not approved', state: 'bad' });
      return steps;
    }
    const approved = reached(RequestStatus.APPROVED, RequestStatus.CHECKED_OUT, RequestStatus.OVERDUE, RequestStatus.RETURNED);
    steps.push({ label: 'Approved', detail: approved ? 'Cleared for collection' : 'Waiting for an administrator', state: approved ? 'done' : 'current' });
    const out = reached(RequestStatus.CHECKED_OUT, RequestStatus.OVERDUE, RequestStatus.RETURNED);
    steps.push({
      label: 'Checked out',
      detail: out ? 'Assigned to the project team' : 'Collect once approved',
      state: out ? 'done' : approved ? 'current' : 'upcoming'
    });
    const returned = status === RequestStatus.RETURNED;
    steps.push({
      label: returned ? 'Returned' : status === RequestStatus.OVERDUE ? 'Return overdue' : 'Return',
      detail: returned ? 'Back in the Vault' : 'Return by the expected date',
      state: returned ? 'done' : status === RequestStatus.OVERDUE ? 'bad' : out ? 'current' : 'upcoming'
    });
    return steps;
  });

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe(params => this.load(params.get('id') ?? ''));
  }

  protected load(id: string): void {
    this.loading.set(true);
    this.failed.set(false);
    this.service.getById(id).subscribe({
      next: request => {
        this.request.set(request);
        this.loading.set(false);
      },
      error: () => {
        this.request.set(null);
        this.failed.set(true);
        this.loading.set(false);
      }
    });
  }

  protected banner(status: RequestStatus): { tone: string; icon: string; title: string; text: string } {
    switch (status) {
      case RequestStatus.PENDING: return { tone: 'warning', icon: 'pi-clock', title: 'Awaiting review', text: 'An administrator will review this request shortly.' };
      case RequestStatus.APPROVED: return { tone: 'info', icon: 'pi-check-circle', title: 'Approved for collection', text: 'Collect the equipment from the Vault to start the loan.' };
      case RequestStatus.REJECTED: return { tone: 'danger', icon: 'pi-times-circle', title: 'Request rejected', text: 'See the reason below. You can submit a new request if needed.' };
      case RequestStatus.CHECKED_OUT: return { tone: 'info', icon: 'pi-box', title: 'Equipment checked out', text: 'Return it by the expected date shown below.' };
      case RequestStatus.RETURNED: return { tone: 'success', icon: 'pi-replay', title: 'Equipment returned', text: 'Thank you — this loan is complete.' };
      default: return { tone: 'danger', icon: 'pi-exclamation-triangle', title: 'Return overdue', text: 'Please return the equipment to the Vault as soon as possible.' };
    }
  }
}
