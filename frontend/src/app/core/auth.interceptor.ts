import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const router = inject(Router);
  const token = localStorage.getItem('jhub_access_token');

  if (!token) {
    return next(request);
  }

  const authenticatedRequest = request.clone({
    setHeaders: { Authorization: 'Bearer ' + token }
  });

  return next(authenticatedRequest).pipe(
    catchError(error => {
      if (error.status === 401 && !request.url.includes('/auth/')) {
        localStorage.removeItem('jhub_access_token');
        void router.navigateByUrl('/auth/login');
      }
      return throwError(() => error);
    })
  );
};
