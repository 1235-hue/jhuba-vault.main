import {
  ChangeDetectionStrategy,
  Component,
  inject
} from '@angular/core';

import {
  FormBuilder,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';

import { RouterLink } from '@angular/router';

import { ProfileStore } from '../state/profile.store';
import { AuthStore } from '../state/auth.store';
import { Role } from '../core/models';

@Component({
  selector: 'jhub-profile-page',
  standalone: true,
  styleUrls: ['./innovator-theme.component.css'],
  imports: [ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,

  template: `
    <main class="profile-page page-width">

      <div class="profile-heading">
        <div>
          <p class="eyebrow">INNOVATOR PROFILE</p>

          <h1>
            Your bio-data,
            <em>your story.</em>
          </h1>

          <p>
            Keep your information current so project and loan records stay accountable.
          </p>
        </div>

        <a class="arrow-link" routerLink="/app/settings">
          Settings ↗
        </a>
      </div>

      @if (profile.success()) {
        <div class="notice success" role="status">
          {{ profile.success() }}
        </div>
      }

      @if (profile.error()) {
        <div class="notice error" role="alert">
          {{ profile.error() }}
        </div>
      }

      <section class="profile-layout">

        <!-- PROFILE IMAGE -->
        <div class="avatar-card">

          @if (previewUrl) {
            <img
              class="avatar-image"
              [src]="previewUrl"
              alt="Profile picture"
            />
          } @else {
            <div class="avatar">
              {{ initials() }}
            </div>
          }

          <h2>
            {{ form.controls.fullName.value || 'Your name' }}
          </h2>

          <p>
            {{ form.controls.email.value }}
          </p>

          <label class="upload-button">
            {{ uploadingImage ? 'Processing image…' : 'Change profile picture' }}

            <input
              type="file"
              accept="image/jpeg,image/png"
              [disabled]="uploadingImage"
              (change)="upload($event)"
            />
          </label>

          <small>
            JPG or PNG · automatically compressed · max 1MB
          </small>

          @if (imageMessage) {
            <div
              class="image-message"
              [class.error]="imageError"
              [class.success]="!imageError"
            >
              {{ imageMessage }}
            </div>
          }

        </div>

        <!-- PROFILE FORM -->
        <form
          class="profile-form"
          [formGroup]="form"
          (ngSubmit)="save()"
        >

          <div class="form-grid">

            <label>
              Full name

              <input formControlName="fullName">

              @if (invalid('fullName')) {
                <small>Full name is required.</small>
              }
            </label>

            <label>
              Official email

              <input
                type="email"
                formControlName="email"
              >

              @if (invalid('email')) {
                <small>Enter a valid email.</small>
              }
            </label>

            <label>
              Phone number

              <div class="phone-input">
                <span class="country-code">+254</span>
                <input
                  type="tel"
                  formControlName="phoneNumber"
                  placeholder="712345678"
                  maxlength="9"
                  inputmode="numeric"
                  autocomplete="tel-national"
                >
              </div>

              @if (invalid('phoneNumber')) {
                <small>
                  Enter a valid Kenyan phone number (e.g. 712345678). Do not include the leading 0.
                </small>
              }
            </label>

            <label>
              Identification / student number

              <input formControlName="identificationId">
            </label>

            <label>
              Department / track

              <input formControlName="department">
            </label>

            <label>
              Primary role

              <input formControlName="primaryRole">
            </label>

          </div>

          <label>
            Bio / skill summary

            <textarea
              rows="5"
              formControlName="bio"
              placeholder="Tell the JHUB community what you are working on."
            ></textarea>
          </label>

          <label>
            GitHub / portfolio URL

            <input
              type="url"
              formControlName="githubUrl"
              placeholder="https://"
            >
          </label>

          <div class="form-actions">

            <button
              type="button"
              class="secondary-button"
              (click)="cancel()"
            >
              Cancel
            </button>

            <button
              type="submit"
              class="primary-button"
              [disabled]="profile.saving()"
            >
              {{ profile.saving() ? 'Saving…' : 'Save profile' }}
              <span>→</span>
            </button>

          </div>

        </form>

      </section>

    </main>
  `,

  styles: [`
    :host {
      display: block;
    }

    .profile-page {
      padding: 65px 0 110px;
    }

    .profile-heading {
      display: flex;
      justify-content: space-between;
      align-items: end;
      margin-bottom: 35px;
    }

    .eyebrow {
      color: #3ea945;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 2px;
      margin: 0 0 18px;
    }

    .profile-heading h1 {
      font: 400 clamp(40px, 5vw, 58px)/1.05 Georgia, serif;
      color: #262571;
      margin: 0;
    }

    .profile-heading h1 em {
      color: #3ea945;
    }

    .profile-heading p:last-child {
      color: #667083;
      font-size: 13px;
    }

    .arrow-link {
      color: #262571;
      text-decoration: none;
      font-size: 12px;
      font-weight: 700;
    }

    .profile-layout {
      display: grid;
      grid-template-columns: 270px 1fr;
      gap: 20px;
      align-items: start;
    }

    .avatar-card,
    .profile-form {
      background: #fff;
      border: 1px solid #e6e8ee;
      padding: 28px;
    }

    .avatar-card {
      text-align: center;
    }

    .avatar {
      width: 100px;
      height: 100px;
      display: grid;
      place-items: center;
      margin: 5px auto 18px;
      background: #e5eafa;
      color: #262571;
      font: 38px Georgia, serif;
      border-radius: 50%;
    }

    .avatar-image {
      width: 100px;
      height: 100px;
      display: block;
      object-fit: cover;
      margin: 5px auto 18px;
      border-radius: 50%;
      border: 3px solid #e5eafa;
    }

    .avatar-card h2 {
      font: 24px Georgia, serif;
      color: #262571;
      margin: 0;
    }

    .avatar-card p {
      font-size: 11px;
      color: #7c8492;
      word-break: break-word;
    }

    .upload-button {
      display: block;
      border: 1px solid #dce0e8;
      padding: 11px 8px;
      color: #262571;
      font-size: 11px;
      font-weight: 700;
      margin-top: 22px;
      cursor: pointer;
      transition: 0.2s ease;
    }

    .upload-button:hover {
      border-color: #3ea945;
      background: #f7fff7;
    }

    .upload-button input {
      display: none;
    }

    .avatar-card > small {
      display: block;
      color: #9aa1ad;
      font-size: 9px;
      margin-top: 10px;
      line-height: 1.5;
    }

    .image-message {
      margin-top: 12px;
      padding: 9px;
      font-size: 10px;
      line-height: 1.4;
      text-align: left;
    }

    .image-message.error {
      color: #a51f20;
      background: #fff0f0;
      border-left: 3px solid #e6292a;
    }

    .image-message.success {
      color: #26742b;
      background: #f0fff1;
      border-left: 3px solid #3ea945;
    }

    .profile-form {
      display: grid;
      gap: 18px;
    }

    .form-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 18px;
    }

    .profile-form label {
      display: block;
      color: #586174;
      font-size: 11px;
    }

    .profile-form input,
    .profile-form textarea {
      display: block;
      width: 100%;
      box-sizing: border-box;
      border: 1px solid #dce0e8;
      margin-top: 7px;
      padding: 12px;
      outline-color: #3ea945;
      resize: vertical;
    }

    .profile-form input:focus,
    .profile-form textarea:focus {
      border-color: #3ea945;
    }

    .phone-input {
      display: flex;
      align-items: stretch;
      margin-top: 7px;
    }

    .phone-input .country-code {
      display: flex;
      align-items: center;
      padding: 0 12px;
      border: 1px solid #dce0e8;
      border-right: 0;
      background: #f7f8fb;
      color: #586174;
    }

    .phone-input input {
      flex: 1;
      min-width: 0;
      margin-top: 0;
    }

    .profile-form small {
      display: block;
      color: #e6292a;
      margin-top: 5px;
      font-size: 10px;
    }

    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      margin-top: 8px;
    }

    .notice {
      padding: 12px 15px;
      margin-bottom: 16px;
      font-size: 12px;
      background: #fff;
    }

    .notice.success {
      border-left: 3px solid #3ea945;
      color: #26742b;
    }

    .notice.error {
      border-left: 3px solid #e6292a;
      color: #a51f20;
    }

    @media (max-width: 760px) {

      .profile-page {
        padding-top: 45px;
      }

      .profile-heading {
        display: block;
      }

      .profile-heading .arrow-link {
        display: inline-block;
        margin-top: 18px;
      }

      .profile-layout {
        grid-template-columns: 1fr;
      }

      .form-grid {
        grid-template-columns: 1fr;
      }

      .form-actions {
        justify-content: stretch;
      }

      .form-actions button {
        flex: 1;
        justify-content: center;
      }
    }
  `]
})
export class ProfilePageComponent {

  protected readonly profile = inject(ProfileStore);

  private readonly auth = inject(AuthStore);

  private readonly fb = inject(FormBuilder);

  protected readonly form = this.fb.nonNullable.group({

    fullName: [
      '',
      [
        Validators.required
      ]
    ],

    email: [
      {
        value: '',
        disabled: true
      },
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

    department: [
      ''
    ],

    primaryRole: [
      {
        value: '',
        disabled: true
      }
    ],

    bio: [
      '',
      Validators.maxLength(500)
    ],

    githubUrl: [
      '',
      Validators.pattern(/^https?:\/\/.+/)
    ]
  });

  protected previewUrl: string | null = null;

  protected uploadingImage = false;

  protected imageMessage = '';

  protected imageError = false;

  private readonly MAX_IMAGE_SIZE = 1_000_000;

  constructor() {

    const user = this.auth.user();

    if (user) {

      this.form.patchValue({
        fullName: user.fullName,
        email: user.email,
        phoneNumber: this.displayPhoneNumber(user.phoneNumber),
        identificationId: user.identificationId,
        department: user.department ?? '',
        primaryRole:
          user.role === Role.ADMIN
            ? 'Administrator'
            : 'Innovator',
        bio: user.bio ?? '',
        githubUrl: user.githubUrl ?? ''
      });

      if (user.avatarUrl) {
        this.previewUrl = user.avatarUrl;
      }
    }
  }

  protected invalid(field: string): boolean {

    const control =
      this.form.controls[
        field as keyof typeof this.form.controls
      ];

    return control.invalid &&
      (control.dirty || control.touched);
  }

  protected initials(): string {

    return (
      this.form.controls.fullName.value ||
      'JH'
    )
      .split(' ')
      .map(part => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }

  protected cancel(): void {

    const current = this.auth.user();

    if (!current) {
      return;
    }

    this.form.reset({
      fullName: current.fullName,
      email: current.email,
      phoneNumber: this.displayPhoneNumber(
        current.phoneNumber
      ),
      identificationId: current.identificationId,
      department: current.department ?? '',
      primaryRole:
        current.role === Role.ADMIN
          ? 'Administrator'
          : 'Innovator',
      bio: current.bio ?? '',
      githubUrl: current.githubUrl ?? ''
    });

    this.profile.clearMessage();

    this.imageMessage = '';
    this.imageError = false;
  }

  protected save(): void {

    this.form.markAllAsTouched();

    if (this.form.invalid) {
      return;
    }

    const current = this.auth.user();

    if (!current) {
      return;
    }

    this.profile.beginSave();

    const phoneNumber =
      this.normalisePhoneNumber(
        this.form.controls.phoneNumber.value
      );

    this.profile.save(
      {
        ...current,

        fullName:
          this.form.controls.fullName.value,

        phoneNumber,

        identificationId:
          this.form.controls.identificationId.value,

        department:
          this.form.controls.department.value || '',

        bio:
          this.form.controls.bio.value || undefined,

        githubUrl:
          this.form.controls.githubUrl.value || undefined
      },

      user => this.auth.updateUser(user)
    );
  }

  /**
   * Handle profile image.
   *
   * The user can select a large phone image.
   *
   * We resize/compress it automatically.
   */
  protected async upload(event: Event): Promise<void> {

    const input =
      event.target as HTMLInputElement;

    const file =
      input.files?.[0];

    if (!file) {
      return;
    }

    this.imageMessage = '';
    this.imageError = false;

    /*
     * Only allow JPG and PNG.
     */
    if (
      file.type !== 'image/jpeg' &&
      file.type !== 'image/png'
    ) {

      this.setImageError(
        'Please select a JPG or PNG image.'
      );

      input.value = '';

      return;
    }

    this.uploadingImage = true;

    try {

      /*
       * If already below 1MB, use it directly.
       */
      if (file.size <= this.MAX_IMAGE_SIZE) {

        await this.processImage(file);

        return;
      }

      /*
       * Large image:
       * resize + compress.
       */
      const compressed =
        await this.compressImage(file);

      if (
        compressed.size >
        this.MAX_IMAGE_SIZE
      ) {

        this.setImageError(
          'The image could not be compressed below 1MB. Please choose a smaller image.'
        );

        return;
      }

      await this.processImage(compressed);

    } catch (error) {

      console.error(
        'Profile image processing failed:',
        error
      );

      this.setImageError(
        'Unable to process this image. Please try another image.'
      );

    } finally {

      this.uploadingImage = false;

      /*
       * Allow selecting the same file again.
       */
      input.value = '';
    }
  }

  /**
   * Compress and resize image.
   */
  private async compressImage(
    file: File
  ): Promise<File> {

    const image =
      await this.loadImage(file);

    /*
     * Maximum profile image dimensions.
     *
     * 1200x1200 is more than enough
     * for a profile picture.
     */
    const MAX_WIDTH = 1200;
    const MAX_HEIGHT = 1200;

    let width = image.width;
    let height = image.height;

    if (
      width > MAX_WIDTH ||
      height > MAX_HEIGHT
    ) {

      const ratio =
        Math.min(
          MAX_WIDTH / width,
          MAX_HEIGHT / height
        );

      width =
        Math.round(width * ratio);

      height =
        Math.round(height * ratio);
    }

    const canvas =
      document.createElement('canvas');

    canvas.width = width;
    canvas.height = height;

    const context =
      canvas.getContext('2d');

    if (!context) {
      throw new Error(
        'Could not create image canvas.'
      );
    }

    /*
     * White background prevents transparent
     * PNGs from becoming black when converted
     * to JPEG.
     */
    context.fillStyle = '#ffffff';

    context.fillRect(
      0,
      0,
      width,
      height
    );

    context.drawImage(
      image,
      0,
      0,
      width,
      height
    );

    /*
     * Start at 80% quality.
     */
    let quality = 0.8;

    let blob =
      await this.canvasToBlob(
        canvas,
        quality
      );

    /*
     * Continue reducing quality until
     * the file is <= 1MB.
     */
    while (
      blob.size > this.MAX_IMAGE_SIZE &&
      quality > 0.3
    ) {

      quality -= 0.1;

      blob =
        await this.canvasToBlob(
          canvas,
          quality
        );
    }

    /*
     * If quality alone wasn't enough,
     * progressively resize the canvas.
     */
    while (
      blob.size > this.MAX_IMAGE_SIZE &&
      width > 400
    ) {

      width =
        Math.round(width * 0.8);

      height =
        Math.round(height * 0.8);

      canvas.width = width;
      canvas.height = height;

      context.fillStyle = '#ffffff';

      context.fillRect(
        0,
        0,
        width,
        height
      );

      context.drawImage(
        image,
        0,
        0,
        width,
        height
      );

      quality = 0.7;

      blob =
        await this.canvasToBlob(
          canvas,
          quality
        );
    }

    return new File(
      [blob],
      this.changeExtension(
        file.name,
        'jpg'
      ),
      {
        type: 'image/jpeg',
        lastModified: Date.now()
      }
    );
  }

  /**
   * Convert canvas to JPEG blob.
   */
  private canvasToBlob(
    canvas: HTMLCanvasElement,
    quality: number
  ): Promise<Blob> {

    return new Promise(
      (resolve, reject) => {

        canvas.toBlob(
          blob => {

            if (blob) {
              resolve(blob);
            } else {
              reject(
                new Error(
                  'Image compression failed.'
                )
              );
            }
          },
          'image/jpeg',
          quality
        );
      }
    );
  }

  /**
   * Load image into browser memory.
   */
  private loadImage(
    file: File
  ): Promise<HTMLImageElement> {

    return new Promise(
      (resolve, reject) => {

        const url =
          URL.createObjectURL(file);

        const image =
          new Image();

        image.onload = () => {

          URL.revokeObjectURL(url);

          resolve(image);
        };

        image.onerror = () => {

          URL.revokeObjectURL(url);

          reject(
            new Error(
              'Could not read image.'
            )
          );
        };

        image.src = url;
      }
    );
  }

  /**
   * This is where the compressed image
   * is currently prepared for upload.
   *
   * If your ProfileStore already has an
   * uploadImage method, call it here.
   */
  private async processImage(
    file: File
  ): Promise<void> {

    if (
      file.size >
      this.MAX_IMAGE_SIZE
    ) {

      this.setImageError(
        'Image must be smaller than 1MB.'
      );

      return;
    }

    /*
     * Display compressed image immediately.
     */
    const url =
      URL.createObjectURL(file);

    if (this.previewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(
        this.previewUrl
      );
    }

    this.previewUrl = url;

    this.imageMessage =
      `Image ready: ${this.formatBytes(file.size)}`;

    this.imageError = false;

    /*
     * IMPORTANT:
     *
     * This is the compressed File that should
     * be sent to Cloudinary/backend.
     *
     * If your ProfileStore has an image upload
     * method, connect it here.
     */
    console.log(
      'Compressed profile image:',
      {
        name: file.name,
        type: file.type,
        size: file.size
      }
    );

    /*
     * If your existing ProfileStore supports:
     *
     * this.profile.uploadAvatar(file, user => ...)
     *
     * put that call here.
     */
  }

  private setImageError(
    message: string
  ): void {

    this.imageMessage = message;
    this.imageError = true;
  }

  private formatBytes(
    bytes: number
  ): string {

    if (bytes < 1024) {
      return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(0)} KB`;
    }

    return `${(
      bytes /
      (1024 * 1024)
    ).toFixed(2)} MB`;
  }

  private changeExtension(
    filename: string,
    extension: string
  ): string {

    const dot =
      filename.lastIndexOf('.');

    const base =
      dot > 0
        ? filename.substring(0, dot)
        : filename;

    return `${base}.${extension}`;
  }

  private displayPhoneNumber(
    phone: string
  ): string {

    if (!phone) {
      return '';
    }

    if (phone.startsWith('+254')) {
      return phone.substring(4);
    }

    if (phone.startsWith('254')) {
      return phone.substring(3);
    }

    if (phone.startsWith('0')) {
      return phone.substring(1);
    }

    return phone;
  }

  private normalisePhoneNumber(
    phone: string
  ): string {
    return `+254${phone}`;
  }
}