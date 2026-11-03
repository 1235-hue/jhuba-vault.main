import { Injectable, signal } from '@angular/core';

export type ToastTone = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  tone: ToastTone;
  title?: string;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private nextId = 1;

  success(message: string, title?: string): void {
    this.push('success', message, title, 4500);
  }

  error(message: string, title?: string): void {
    this.push('error', message, title, 8000);
  }

  info(message: string, title?: string): void {
    this.push('info', message, title, 4500);
  }

  dismiss(id: number): void {
    this.toasts.update(items => items.filter(toast => toast.id !== id));
  }

  private push(tone: ToastTone, message: string, title: string | undefined, duration: number): void {
    const id = this.nextId++;
    this.toasts.update(items => [...items.slice(-3), { id, tone, title, message }]);
    setTimeout(() => this.dismiss(id), duration);
  }
}
