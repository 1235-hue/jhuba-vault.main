import { computed, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { Observable, catchError, finalize, of, shareReplay, tap } from 'rxjs';
import { Role, User } from '../core/models';
import { AuthCredentials, AuthService, RegistrationData } from '../core/api.service';

interface AuthState { user: User | null; loading: boolean; error: string | null; hydrated: boolean; hydrating: boolean; }
export const AuthStore = signalStore(
  { providedIn: 'root' },
  withState<AuthState>({ user: null, loading: false, error: null, hydrated: false, hydrating: false }),
  withComputed(({ user, hydrated, hydrating }) => ({ isAuthenticated: computed(() => user() !== null), isAdmin: computed(() => user()?.role === Role.ADMIN), isHydrated: computed(() => hydrated()), isHydrating: computed(() => hydrating()) })),
  withMethods((store, authService = inject(AuthService), router = inject(Router)) => {
    let hydration$: Observable<User | null> | null = null;
    const hydrate = (): Observable<User | null> => {
      if (store.hydrated()) return of(store.user());
      if (hydration$) return hydration$;
      const token = localStorage.getItem('jhub_access_token');
      if (!token) {
        patchState(store, { hydrated: true, hydrating: false, user: null });
        return of(null);
      }
      patchState(store, { hydrating: true, loading: true, error: null });
      hydration$ = authService.me().pipe(
        tap(user => patchState(store, { user })),
        catchError(() => { localStorage.removeItem('jhub_access_token'); patchState(store, { user: null }); return of(null); }),
        finalize(() => { patchState(store, { hydrated: true, hydrating: false, loading: false }); hydration$ = null; }),
        shareReplay({ bufferSize: 1, refCount: false })
      );
      return hydration$;
    };
    return {
      hydrate,
      signIn(credentials: AuthCredentials | Role): void { if (typeof credentials === 'string') { patchState(store, { loading: false, error: 'Use the sign-in form to authenticate with your account.' }); return; } patchState(store, { loading: true, error: null }); authService.login(credentials).subscribe({ next: response => { localStorage.setItem('jhub_access_token', response.token); patchState(store, { user: response.user, hydrated: true, hydrating: false, loading: false, error: null }); void router.navigateByUrl(response.user.role === Role.ADMIN ? '/admin/dashboard' : '/app/dashboard'); }, error: error => patchState(store, { loading: false, error: this.errorMessage(error) }) }); },
      register(data: RegistrationData): void { patchState(store, { loading: true, error: null }); authService.register(data).subscribe({ next: response => { localStorage.setItem('jhub_access_token', response.token); patchState(store, { user: response.user, hydrated: true, hydrating: false, loading: false, error: null }); void router.navigateByUrl('/app/profile'); }, error: error => patchState(store, { loading: false, error: this.errorMessage(error) }) }); },
      signOut(): void { patchState(store, { user: null, hydrated: true, hydrating: false, loading: false, error: null }); localStorage.removeItem('jhub_access_token'); void router.navigateByUrl('/'); },
      expireSession(): void { localStorage.removeItem('jhub_access_token'); patchState(store, { user: null, hydrated: true, hydrating: false, loading: false, error: 'Your session has expired. Sign in again to continue.' }); void router.navigateByUrl('/auth/login'); },
      clearError(): void { patchState(store, { error: null }); },
      updateUser(user: User): void { patchState(store, { user }); },
      errorMessage(error: unknown): string { if (error instanceof HttpErrorResponse) return error.error?.message ?? 'Authentication request failed.'; return 'Authentication request failed.'; }
    };
  })
);
