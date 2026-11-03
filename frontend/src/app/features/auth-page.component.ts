import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal
} from '@angular/core';

import {
  FormBuilder,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';

import {
  Router,
  RouterLink
} from '@angular/router';

import { AuthStore } from '../state/auth.store';
import { Role } from '../core/models';
import { BrandLogoComponent } from '../shared/brand-logo.component';

@Component({
  selector: 'jhub-auth-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    BrandLogoComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './auth-page.component.html',
  styleUrl: './auth-page.component.css'
})
export class AuthPageComponent {

  protected readonly auth = inject(AuthStore);

  private readonly fb = inject(FormBuilder);

  private readonly router = inject(Router);

  protected readonly Role = Role;
  protected readonly showPassword = signal(false);

  protected readonly mode = computed(() => {
    const url = this.router.url;

    if (url.includes('register')) {
      return 'register';
    }

    if (url.includes('/admin/')) {
      return 'admin';
    }

    return 'login';
  });

  protected readonly form = this.fb.nonNullable.group({

    fullName: [
      '',
      [
        Validators.required,
        Validators.minLength(2)
      ]
    ],

    email: [
      '',
      [
        Validators.required,
        Validators.email
      ]
    ],

    phoneNumber: [
      '',
      [
        Validators.required,
        Validators.pattern(/^[17]\d{8}$/)
      ]
    ],

    identificationId: [
      '',
      Validators.required
    ],

    password: [
      '',
      [
        Validators.required,
        Validators.minLength(8)
      ]
    ]

  });

  protected invalid(field: string): boolean {

    const control =
      this.form.controls[
        field as keyof typeof this.form.controls
      ];

    return control.invalid &&
      (control.dirty || control.touched);
  }

  protected submit(): void {

    this.form.markAllAsTouched();

    const values = this.form.getRawValue();

    /*
     * Login only needs email + password.
     *
     * This is important because registration-only
     * validators must never block login.
     */
    const loginInvalid =
      this.form.controls.email.invalid ||
      this.form.controls.password.invalid;

    if (
      this.mode() === 'register'
        ? this.form.invalid
        : loginInvalid
    ) {
      return;
    }

    if (this.mode() === 'register') {

      this.auth.register({
        fullName: values.fullName,
        email: values.email,
        password: values.password,
        phoneNumber: this.toInternationalPhone(values.phoneNumber),
        identificationId: values.identificationId
      });

    } else {

      this.auth.signIn({
        email: values.email,
        password: values.password
      });

    }
  }

  private toInternationalPhone(phone: string): string {
    return `+254${phone}`;
  }
}