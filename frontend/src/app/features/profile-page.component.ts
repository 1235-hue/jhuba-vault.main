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

import { PageHeaderComponent } from '../shared/page-header.component';
import { MediaService } from '../core/media.service';

import { ProfileStore } from '../state/profile.store';
import { AuthStore } from '../state/auth.store';
import { Role } from '../core/models';

@Component({
  selector: 'jhub-profile-page',
  standalone: true,
  imports: [ReactiveFormsModule, PageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './profile-page.component.html',
  styleUrl: './profile-page.component.css'
})
export class ProfilePageComponent {

  protected readonly profile = inject(ProfileStore);

  private readonly auth = inject(AuthStore);

  private readonly fb = inject(FormBuilder);
  private readonly media = inject(MediaService);

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

    this.imageMessage = `Uploading photo (${this.formatBytes(file.size)})…`;

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
    const current = this.auth.user();
    this.media.upload(file, 'profile').subscribe({
      next: update => {
        if (update.result?.url && current) {
          this.auth.updateUser({ ...current, avatarUrl: update.result.url });
          this.imageMessage = 'Profile photo updated.';
          this.imageError = false;
        }
      },
      error: () => this.setImageError('We couldn’t upload your photo. Please try again.')
    });

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