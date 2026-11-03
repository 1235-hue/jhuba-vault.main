import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnDestroy,
  Output,
  ViewChild
} from '@angular/core';

let nextModalId = 0;

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessible modal dialog: traps focus, closes on Escape / backdrop click,
 * locks page scroll and returns focus to the trigger when it closes.
 */
@Component({
  selector: 'jhub-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="modal-backdrop" (mousedown)="onBackdrop($event)">
      <section
        #dialog
        class="modal"
        [class.modal-lg]="size === 'lg'"
        role="dialog"
        aria-modal="true"
        tabindex="-1"
        [attr.aria-labelledby]="titleId"
        (keydown.tab)="trapFocus($event, false)"
        (keydown.shift.tab)="trapFocus($event, true)"
      >
        <header class="modal-head">
          <div>
            <h2 class="modal-title" [id]="titleId">{{ title }}</h2>
            @if (subtitle) { <p class="modal-sub">{{ subtitle }}</p> }
          </div>
          <button type="button" class="btn btn-ghost btn-icon" aria-label="Close dialog" [disabled]="busy" (click)="requestClose()">
            <i class="pi pi-times" aria-hidden="true"></i>
          </button>
        </header>
        <div class="modal-body"><ng-content></ng-content></div>
        <ng-content select="[modal-footer]"></ng-content>
      </section>
    </div>
  `,
  styles: [`:host { display: contents; }`]
})
export class ModalComponent implements AfterViewInit, OnDestroy {
  @Input({ required: true }) title = '';
  @Input() subtitle = '';
  @Input() size: 'md' | 'lg' = 'md';
  /** Prevents closing while a request is in flight. */
  @Input() busy = false;
  @Output() closed = new EventEmitter<void>();
  @ViewChild('dialog', { static: true }) private dialog!: ElementRef<HTMLElement>;

  protected readonly titleId = `jhub-modal-title-${nextModalId++}`;
  private opener: HTMLElement | null = null;
  private pressedOnBackdrop = false;

  ngAfterViewInit(): void {
    this.opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.classList.add('modal-open');
    const dialog = this.dialog.nativeElement;
    const first = dialog.querySelector<HTMLElement>('.modal-body input:not([type="hidden"]), .modal-body select, .modal-body textarea');
    (first ?? dialog).focus({ preventScroll: true });
  }

  ngOnDestroy(): void {
    document.body.classList.remove('modal-open');
    this.opener?.focus?.({ preventScroll: true });
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.requestClose();
  }

  protected onBackdrop(event: MouseEvent): void {
    this.pressedOnBackdrop = event.target === event.currentTarget;
    if (this.pressedOnBackdrop) this.requestClose();
  }

  protected requestClose(): void {
    if (!this.busy) this.closed.emit();
  }

  protected trapFocus(event: Event, backwards: boolean): void {
    const dialog = this.dialog.nativeElement;
    const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(element => element.offsetParent !== null);
    if (!focusable.length) {
      event.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (backwards && (active === first || active === dialog)) {
      event.preventDefault();
      last.focus();
    } else if (!backwards && active === last) {
      event.preventDefault();
      first.focus();
    }
  }
}
