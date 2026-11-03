import { ChangeDetectionStrategy, Component, ElementRef, HostListener, Input, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subject, catchError, debounceTime, distinctUntilChanged, of, switchMap } from 'rxjs';
import { AdminSearchResult, AdminService } from '../core/api.service';
import { AssetStore } from '../state/asset.store';

const TYPE_ICON: Record<AdminSearchResult['type'], string> = {
  asset: 'pi-box',
  request: 'pi-inbox',
  user: 'pi-user'
};

/**
 * Header search. Administrators search assets, requests and users through the API;
 * innovators search the asset catalogue.
 */
@Component({
  selector: 'jhub-global-search',
  standalone: true,
  imports: [FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="search" role="search" (submit)="$event.preventDefault(); submit()">
      <div class="input-icon">
        <i class="pi pi-search" aria-hidden="true"></i>
        <input
          class="input"
          type="search"
          autocomplete="off"
          [attr.aria-label]="mode === 'admin' ? 'Search assets, requests and users' : 'Search the asset catalogue'"
          [placeholder]="mode === 'admin' ? 'Search assets, requests and users' : 'Search the catalogue'"
          [ngModel]="term()"
          (ngModelChange)="onTerm($event)"
          (focus)="open.set(true)"
          name="q"
        />
      </div>

      @if (mode === 'admin' && open() && term().trim().length >= 2) {
        <div class="results card" role="region" aria-label="Search results" aria-live="polite">
          @if (searching()) {
            <p class="state"><span class="spinner"></span> Searching…</p>
          } @else if (error()) {
            <p class="state state-error">{{ error() }}</p>
          } @else if (results().length) {
            @for (result of results(); track result.type + result.id) {
              <a class="result" [routerLink]="result.href" (click)="clear()">
                <span class="result-icon"><i class="pi" [class]="'pi ' + icon(result.type)" aria-hidden="true"></i></span>
                <span class="result-copy">
                  <strong>{{ result.label }}</strong>
                  <small>{{ typeLabel(result.type) }} · {{ result.detail }}</small>
                </span>
              </a>
            }
          } @else {
            <p class="state">No assets, requests or users match “{{ term().trim() }}”.</p>
          }
        </div>
      }
    </form>
  `,
  styles: [`
    :host { display: block; width: min(440px, 100%); }
    .search { position: relative; }
    .results { position: absolute; top: calc(100% + 8px); right: 0; left: 0; z-index: 60; max-height: 380px; padding: 6px; overflow-y: auto; box-shadow: var(--shadow-lg); }
    .result { display: flex; align-items: center; gap: 12px; padding: 10px; border-radius: var(--r-md); }
    .result:hover, .result:focus-visible { background: var(--surface-2); }
    .result-icon { display: grid; flex: none; place-items: center; width: 32px; height: 32px; border-radius: var(--r-md); background: var(--navy-50); color: var(--navy); }
    .result-copy { min-width: 0; }
    .result-copy strong, .result-copy small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .result-copy strong { color: var(--ink); font-size: var(--fs-base); }
    .result-copy small { color: var(--text-3); font-size: var(--fs-xs); }
    .state { display: flex; align-items: center; gap: 10px; margin: 0; padding: 14px 12px; color: var(--text-3); font-size: var(--fs-sm); }
    .state-error { color: var(--red-700); }
  `]
})
export class GlobalSearchComponent {
  @Input() mode: 'admin' | 'catalogue' = 'catalogue';

  private readonly admin = inject(AdminService);
  private readonly assets = inject(AssetStore);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly input$ = new Subject<string>();

  protected readonly term = signal('');
  protected readonly open = signal(false);
  protected readonly searching = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly results = signal<AdminSearchResult[]>([]);

  constructor() {
    this.input$
      .pipe(
        debounceTime(220),
        distinctUntilChanged(),
        switchMap(query => {
          const value = query.trim();
          this.error.set(null);
          if (this.mode !== 'admin' || value.length < 2) {
            this.searching.set(false);
            return of<AdminSearchResult[]>([]);
          }
          this.searching.set(true);
          return this.admin.search(value).pipe(
            catchError(() => {
              this.error.set('Search is unavailable right now. Try again in a moment.');
              return of<AdminSearchResult[]>([]);
            })
          );
        })
      )
      .subscribe(results => {
        this.results.set(results);
        this.searching.set(false);
      });
  }

  protected onTerm(value: string): void {
    this.term.set(value);
    this.open.set(true);
    if (this.mode === 'admin') this.searching.set(value.trim().length >= 2);
    this.input$.next(value);
  }

  protected submit(): void {
    if (this.mode === 'catalogue') {
      this.assets.setCategory('ALL');
      this.assets.setAvailability('ALL');
      this.assets.setSearch(this.term().trim());
      void this.router.navigateByUrl('/catalogue');
      this.open.set(false);
    }
  }

  protected clear(): void {
    this.term.set('');
    this.results.set([]);
    this.open.set(false);
  }

  protected icon(type: AdminSearchResult['type']): string {
    return TYPE_ICON[type] ?? 'pi-search';
  }

  protected typeLabel(type: string): string {
    return type.charAt(0).toUpperCase() + type.slice(1);
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (!this.host.nativeElement.contains(event.target as Node)) this.open.set(false);
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.open.set(false);
  }
}
