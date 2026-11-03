import { Injectable, signal } from '@angular/core';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'primary' | 'danger' | 'success';
  /** When set, the dialog asks the user to type a reason before confirming. */
  reason?: { label: string; placeholder?: string; required?: boolean };
}

export interface ConfirmResult {
  confirmed: boolean;
  reason: string;
}

interface PendingConfirm {
  options: ConfirmOptions;
  resolve: (result: ConfirmResult) => void;
}

/** Replaces window.confirm / window.prompt with an accessible, on-brand dialog. */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  readonly pending = signal<PendingConfirm | null>(null);

  ask(options: ConfirmOptions): Promise<ConfirmResult> {
    this.pending()?.resolve({ confirmed: false, reason: '' });
    return new Promise(resolve => this.pending.set({ options, resolve }));
  }

  settle(result: ConfirmResult): void {
    const current = this.pending();
    this.pending.set(null);
    current?.resolve(result);
  }
}
