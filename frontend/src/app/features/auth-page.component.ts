import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject
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

  template: `
    <main class="auth-page">

      <section class="auth-panel">

        <p class="eyebrow">JHUB AFRICA VAULT</p>

        <h1>
          {{
            mode() === 'register'
              ? 'Make room for your next idea.'
              : mode() === 'admin'
                ? 'The Vault, under control.'
                : 'Welcome back, innovator.'
          }}
        </h1>

        <p>
          {{
            mode() === 'register'
              ? 'Create your innovator account to request and track JHUB assets.'
              : 'Sign in to manage requests, loans, and your profile.'
          }}
        </p>

        @if (auth.error()) {
          <div class="form-alert error" role="alert">
            {{ auth.error() }}
          </div>
        }

        <form
          [formGroup]="form"
          (ngSubmit)="submit()"
          novalidate
        >

          @if (mode() === 'register') {

            <label>
              Full name

              <input
                type="text"
                formControlName="fullName"
                placeholder="Your full name"
                autocomplete="name"
              />

              @if (invalid('fullName')) {
                <small>
                  Full name is required.
                </small>
              }
            </label>

          }

          <label>
            Official email

            <input
              type="email"
              formControlName="email"
              placeholder="you@example.com"
              autocomplete="email"
            />

            @if (invalid('email')) {
              <small>
                Enter a valid email address.
              </small>
            }
          </label>

          @if (mode() === 'register') {

            <label>
              Phone number

              <div class="phone-input">

                <span class="country-code">
                  +254
                </span>

                <input
                  type="tel"
                  formControlName="phoneNumber"
                  placeholder="712345678"
                  maxlength="9"
                  inputmode="numeric"
                  autocomplete="tel-national"
                />

              </div>

              <span class="phone-help">
                Enter the 9 digits after +254, starting with 7 or 1.
              </span>

              @if (invalid('phoneNumber')) {
                <small>
                  Enter a valid Kenyan phone number (e.g. 712345678). Do not include the leading 0.
                </small>
              }

            </label>

            <label>
              Identification / student number

              <input
                type="text"
                formControlName="identificationId"
                placeholder="Your ID or student number"
              />

              @if (invalid('identificationId')) {
                <small>
                  This field is required.
                </small>
              }
            </label>

          }

          <label>
            Password

            <input
              type="password"
              formControlName="password"
              placeholder="At least 8 characters"
              autocomplete="current-password"
            />

            @if (invalid('password')) {
              <small>
                Password must be at least 8 characters.
              </small>
            }
          </label>

          <button
            class="primary-button submit-button"
            type="submit"
            [disabled]="auth.loading()"
          >
            {{
              auth.loading()
                ? 'Working…'
                : mode() === 'register'
                  ? 'Create innovator account'
                  : 'Sign in'
            }}

            <span>→</span>
          </button>

        </form>

        <p class="form-foot">

          {{
            mode() === 'register'
              ? 'Already registered? '
              : 'New to the Vault? '
          }}

          <a
            [routerLink]="
              mode() === 'register'
                ? '/auth/login'
                : '/auth/register'
            "
          >
            {{
              mode() === 'register'
                ? 'Sign in'
                : 'Create an account'
            }}
          </a>

        </p>

      </section>

      <aside class="auth-aside">

        <jhub-brand-logo
          logo="jkuat"
          variant="auth"
        />

        <jhub-brand-logo
          logo="jhub"
          variant="auth"
        />

        <h2>
          Good tools make
          <br />
          <em>bold work</em> possible.
        </h2>

      </aside>

    </main>
  `,

  styles: [`
    :host {
      display: block;
    }

    .auth-page {
      min-height: calc(100vh - 78px);
      display: grid;
      grid-template-columns: 1fr 1fr;
    }

    .auth-panel {
      background: #fff;
      padding: clamp(35px, 8vw, 120px);
      display: flex;
      flex-direction: column;
      justify-content: center;
    }

    .eyebrow {
      color: #3ea945;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 2px;
      margin: 0 0 18px;
    }

    .auth-panel h1 {
      font: 400 clamp(40px, 5vw, 58px)/1.02 Georgia, serif;
      color: #262571;
      margin: 0;
    }

    .auth-panel > p:not(.eyebrow) {
      color: #667083;
      line-height: 1.6;
      max-width: 390px;
      margin: 20px 0 30px;
    }

    .auth-panel form {
      display: grid;
      gap: 16px;
      max-width: 390px;
    }

    .auth-panel label {
      font-size: 11px;
      color: #586174;
    }

    .auth-panel input {
      display: block;
      width: 100%;
      box-sizing: border-box;
      border: 1px solid #dce0e8;
      margin-top: 7px;
      padding: 13px;
      outline-color: #3ea945;
      font-size: 14px;
      border-radius: 4px;
    }

    .auth-panel input:focus {
      border-color: #3ea945;
    }

    .auth-panel small {
      display: block;
      color: #e6292a;
      font-size: 10px;
      margin-top: 5px;
    }

    .phone-input {
      display: flex;
      width: 100%;
      margin-top: 7px;
    }

    .country-code {
      display: flex;
      align-items: center;
      padding: 0 12px;
      background: #f3f5f7;
      border: 1px solid #dce0e8;
      border-right: 0;
      color: #262571;
      font-size: 13px;
      font-weight: 700;
      border-radius: 4px 0 0 4px;
    }

    .phone-input input {
      flex: 1;
      width: auto;
      margin-top: 0;
      border-radius: 0 4px 4px 0;
    }

    .phone-help {
      display: block;
      margin-top: 5px;
      color: #8d95a3;
      font-size: 10px;
    }

    .submit-button {
      width: 100%;
      justify-content: space-between;
      margin-top: 8px;
    }

    .submit-button:disabled {
      opacity: .6;
      cursor: wait;
    }

    .form-alert {
      padding: 12px;
      margin-bottom: 18px;
      max-width: 390px;
      font-size: 12px;
    }

    .form-alert.error {
      color: #a51f20;
      background: #fff0f0;
      border-left: 3px solid #e6292a;
    }

    .form-foot {
      font-size: 11px !important;
      color: #8d95a3 !important;
    }

    .form-foot a {
      color: #262571;
      font-weight: 700;
    }

    .auth-aside {
      background: #262571;
      color: #fff;
      padding: 100px;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }

    .auth-aside h2 {
      font: 400 45px Georgia, serif;
    }

    .auth-aside h2 em {
      color: #89be32;
    }

    @media (max-width: 760px) {

      .auth-page {
        grid-template-columns: 1fr;
      }

      .auth-aside {
        display: none;
      }

      .auth-panel {
        padding: 60px 24px;
      }

    }
  `]
})
export class AuthPageComponent {

  protected readonly auth = inject(AuthStore);

  private readonly fb = inject(FormBuilder);

  private readonly router = inject(Router);

  protected readonly Role = Role;

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