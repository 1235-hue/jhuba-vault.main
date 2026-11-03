import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfirmService } from '../core/confirm.service';
import { ToastService } from '../core/toast.service';
import { ModalComponent } from './modal.component';

/** Renders the app-wide confirm dialog and toast notifications. Mounted once in the shell. */
@Component({
  selector: 'jhub-overlay-host',
  standalone: true,
  imports: [FormsModule, ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (confirm.pending(); as pending) {
      <jhub-modal [title]="pending.options.title" (closed)="cancel()">
        <form id="confirm-form" (ngSubmit)="accept()" novalidate>
          <p class="message">{{ pending.options.message }}</p>
          @if (pending.options.reason; as reasonOptions) {
            <div class="field reason">
              <label for="confirm-reason">{{ reasonOptions.label }}</label>
              <textarea
                id="confirm-reason"
                class="textarea"
                rows="3"
                maxlength="1000"
                [placeholder]="reasonOptions.placeholder ?? ''"
                [ngModel]="reason()"
                (ngModelChange)="reason.set($event); showError.set(false)"
                name="reason"
                [attr.aria-invalid]="showError() ? 'true' : null"
              ></textarea>
              @if (showError()) { <span class="field-error">Enter a reason to continue.</span> }
            </div>
          }
        </form>
        <footer class="modal-foot" modal-footer>
          <button type="button" class="btn btn-secondary" (click)="cancel()">{{ pending.options.cancelLabel ?? 'Cancel' }}</button>
          <button
            type="submit"
            form="confirm-form"
            class="btn"
            [class.btn-primary]="(pending.options.tone ?? 'primary') === 'primary'"
            [class.btn-danger]="pending.options.tone === 'danger'"
            [class.btn-success]="pending.options.tone === 'success'"
          >{{ pending.options.confirmLabel ?? 'Confirm' }}</button>
        </footer>
      </jhub-modal>
    }

    <div class="toast-region" aria-live="polite" aria-atomic="false">
      @for (toast of toasts.toasts(); track toast.id) {
        <div class="toast" [class]="'toast toast-' + toast.tone" [attr.role]="toast.tone === 'error' ? 'alert' : 'status'">
          <i class="pi" [class]="'pi ' + icon(toast.tone)" aria-hidden="true"></i>
          <div class="toast-body">
            @if (toast.title) { <div class="toast-title">{{ toast.title }}</div> }
            <div>{{ toast.message }}</div>
          </div>
          <button type="button" class="toast-close" aria-label="Dismiss notification" (click)="toasts.dismiss(toast.id)">
            <i class="pi pi-times" aria-hidden="true"></i>
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: contents; }
    .message { color: var(--text-2); font-size: var(--fs-md); line-height: 1.6; }
    .reason { margin-top: 16px; }
  `]
})
export class OverlayHostComponent {
  protected readonly confirm = inject(ConfirmService);
  protected readonly toasts = inject(ToastService);
  protected readonly reason = signal('');
  protected readonly showError = signal(false);
  private readonly requiresReason = computed(() => this.confirm.pending()?.options.reason?.required !== false && !!this.confirm.pending()?.options.reason);

  protected icon(tone: string): string {
    return tone === 'success' ? 'pi-check-circle' : tone === 'error' ? 'pi-exclamation-circle' : 'pi-info-circle';
  }

  protected accept(): void {
    if (this.requiresReason() && !this.reason().trim()) {
      this.showError.set(true);
      return;
    }
    const reason = this.reason().trim();
    this.reset();
    this.confirm.settle({ confirmed: true, reason });
  }

  protected cancel(): void {
    this.reset();
    this.confirm.settle({ confirmed: false, reason: '' });
  }

  private reset(): void {
    this.reason.set('');
    this.showError.set(false);
  }
}
