import {
  CurrencyPipe,
  DatePipe
} from '@angular/common';

import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import {
  ActivatedRoute,
  RouterLink
} from '@angular/router';

import {
  Asset,
  AssetCategory
} from '../core/models';

import {
  AssetService
} from '../core/api.service';

import {
  AssetImageComponent
} from '../shared/asset-image.component';


@Component({
  selector: 'jhub-asset-details-page',

  standalone: true,
  styleUrls: ['./innovator-theme.component.css'],

  imports: [
    CurrencyPipe,
    DatePipe,
    RouterLink,
    AssetImageComponent
  ],

  changeDetection:
    ChangeDetectionStrategy.OnPush,

  template: `

    <main class="asset-details page-width">

      <!-- BACK -->
      <a
        class="back-link"
        routerLink="/catalogue">

        ← Back to catalogue

      </a>


      <!-- LOADING -->
      @if (loading()) {

        <div class="state">

          Loading asset…

        </div>

      }


      <!-- ERROR -->
      @else if (error()) {

        <div
          class="state error"
          role="alert">

          {{ error() }}

        </div>

      }


      <!-- ASSET -->
      @else if (asset()) {

        <article class="asset-card">

          <!-- IMAGE -->
          <div class="asset-image">

            <jhub-asset-image
              [url]="asset()!.imageUrl"
              [alt]="asset()!.name"
              [fit]="'contain'"
              [loading]="'eager'">
            </jhub-asset-image>

          </div>


          <!-- DETAILS -->
          <div class="asset-content">

            <p class="eyebrow">
              ASSET / {{ categoryLabel() }}
            </p>


            <h1>
              {{ asset()!.name }}
            </h1>


            <p class="asset-tag">
              {{ asset()!.assetTag }}
            </p>


            <p class="description">
              {{ asset()!.description }}
            </p>


            <div class="details-grid">

              <div class="detail">

                <span>
                  Category
                </span>

                <strong>
                  {{ categoryLabel() }}
                </strong>

              </div>


              <div class="detail">

                <span>
                  Price
                </span>

                <strong>
                  {{
                    asset()!.price
                      | currency:'USD':'symbol':'1.2-2'
                  }}
                </strong>

              </div>


              <div class="detail">

                <span>
                  Available
                </span>

                <strong
                  [class.unavailable]="
                    asset()!.availableQty === 0
                  ">

                  {{ asset()!.availableQty }}

                  /
                  
                  {{ asset()!.totalQuantity }}

                </strong>

              </div>


              <div class="detail">

                <span>
                  Status
                </span>

                <strong
                  [class.available]="
                    asset()!.availableQty > 0
                  "
                  [class.unavailable]="
                    asset()!.availableQty === 0
                  ">

                  {{
                    asset()!.availableQty > 0
                      ? 'AVAILABLE'
                      : 'UNAVAILABLE'
                  }}

                </strong>

              </div>

            </div>

            @if (specifications().length) {
              <section class="specifications" aria-labelledby="specifications-heading">
                <h2 id="specifications-heading">Technical specifications</h2>
                <dl>
                  @for (specification of specifications(); track specification[0]) {
                    <div>
                      <dt>{{ specification[0] }}</dt>
                      <dd>{{ specification[1] }}</dd>
                    </div>
                  }
                </dl>
              </section>
            }


            <!-- ACTION -->
            <div class="actions">

              @if (asset()!.availableQty > 0) {

                <button
                  type="button"
                  class="primary"
                  (click)="requestAsset()">

                  Request this asset

                </button>

              }

              @else {

                <button
                  type="button"
                  class="primary"
                  disabled>

                  Currently unavailable

                </button>

              }


              <a
                class="secondary"
                routerLink="/catalogue">

                Browse other assets

              </a>

            </div>


            @if (message()) {

              <p
                class="feedback"
                [class.error]="messageError()">

                {{ message() }}

              </p>

            }

          </div>

        </article>

      }


      <!-- NOT FOUND -->
      @else {

        <div class="state">

          Asset not found.

        </div>

      }

    </main>

  `,

  styles: [`

    :host {
      display: block;
    }


    .page-width {
      width:
        min(
          1100px,
          calc(100% - 48px)
        );

      margin: 0 auto;
    }


    .asset-details {
      padding:
        55px 0 110px;
    }


    /* BACK */

    .back-link {
      display: inline-block;

      margin-bottom: 28px;

      color: #262571;

      text-decoration: none;

      font-size: 12px;

      font-weight: 700;
    }


    .back-link:hover {
      color: #3ea945;
    }


    /* CARD */

    .asset-card {
      display: grid;

      grid-template-columns:
        minmax(320px, 1fr)
        minmax(0, 1fr);

      gap: 50px;

      background: #fff;

      border:
        1px solid
        #e6e8ee;

      padding: 30px;
    }


    /* IMAGE */

    .asset-image {
      min-height: 420px;

      background: #f4f5f8;

      overflow: hidden;
    }


    .asset-image
    jhub-asset-image {
      display: block;

      width: 100%;

      height: 100%;
    }


    /* CONTENT */

    .asset-content {
      display: flex;

      flex-direction: column;

      justify-content: center;
    }


    .eyebrow {
      color: #3ea945;

      font-size: 10px;

      font-weight: 800;

      letter-spacing: 2px;

      margin:
        0 0 15px;
    }


    h1 {
      color: #262571;

      font:
        400
        clamp(38px, 5vw, 58px)
        / 1.05
        Georgia,
        serif;

      margin:
        0 0 8px;
    }


    .asset-tag {
      color: #7c8492;

      font-size: 11px;

      font-weight: 700;

      letter-spacing: 1px;

      margin:
        0 0 25px;
    }


    .description {
      color: #667083;

      font-size: 14px;

      line-height: 1.8;

      margin:
        0 0 30px;
    }


    /* DETAILS */

    .details-grid {
      display: grid;

      grid-template-columns:
        repeat(2, 1fr);

      border-top:
        1px solid
        #edf0f4;

      border-left:
        1px solid
        #edf0f4;

      margin-bottom: 30px;
    }


    .detail {
      padding: 16px;

      border-right:
        1px solid
        #edf0f4;

      border-bottom:
        1px solid
        #edf0f4;
    }


    .detail span {
      display: block;

      color: #7c8492;

      font-size: 9px;

      font-weight: 800;

      letter-spacing: 1px;

      text-transform: uppercase;

      margin-bottom: 7px;
    }


    .detail strong {
      display: block;

      color: #262571;

      font-size: 13px;
    }


    .detail strong.available {
      color: #3ea945;
    }


    .detail strong.unavailable {
      color: #e6292a;
    }

    .specifications {
      margin: 0 0 24px;
    }

    .specifications h2 {
      margin: 0 0 10px;
      color: #262571;
      font-size: 13px;
    }

    .specifications dl {
      margin: 0;
      border-top: 1px solid #edf0f4;
    }

    .specifications dl > div {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      padding: 9px 0;
      border-bottom: 1px solid #edf0f4;
      font-size: 11px;
    }

    .specifications dt {
      color: #7c8492;
    }

    .specifications dd {
      margin: 0;
      color: #262571;
      text-align: right;
    }


    /* ACTIONS */

    .actions {
      display: flex;

      flex-wrap: wrap;

      align-items: center;

      gap: 12px;
    }


    .primary,
    .secondary {
      display: inline-block;

      padding:
        13px 18px;

      font-size: 11px;

      font-weight: 800;

      text-decoration: none;

      cursor: pointer;
    }


    .primary {
      border: 0;

      background: #262571;

      color: #fff;
    }


    .primary:hover:not(:disabled) {
      background: #3ea945;
    }


    .primary:disabled {
      opacity: .5;

      cursor: not-allowed;
    }


    .secondary {
      border:
        1px solid
        #dce0e8;

      color: #262571;

      background: #fff;
    }


    .secondary:hover {
      border-color: #3ea945;

      color: #3ea945;
    }


    /* FEEDBACK */

    .feedback {
      margin-top: 18px;

      color: #26742b;

      font-size: 12px;
    }


    .feedback.error {
      color: #a51f20;
    }


    /* STATE */

    .state {
      background: #fff;

      border:
        1px solid
        #e6e8ee;

      padding: 35px;

      color: #667083;

      font-size: 12px;
    }


    .state.error {
      color: #a51f20;

      background: #fffafa;

      border-color: #efd0d0;
    }


    /* MOBILE */

    @media (max-width: 760px) {

      .page-width {
        width:
          calc(100% - 30px);
      }


      .asset-details {
        padding:
          35px 0 70px;
      }


      .asset-card {
        grid-template-columns: 1fr;

        gap: 30px;

        padding: 18px;
      }


      .asset-image {
        min-height: 300px;
      }


      .details-grid {
        grid-template-columns: 1fr;
      }


      .actions {
        flex-direction: column;

        align-items: stretch;
      }


      .primary,
      .secondary {
        text-align: center;

        width: 100%;

        box-sizing: border-box;
      }

    }

  `]
})
export class AssetDetailsPageComponent {

  private readonly route =
    inject(ActivatedRoute);

  private readonly assetService =
    inject(AssetService);


  protected readonly asset =
    signal<Asset | null>(null);


  protected readonly loading =
    signal(true);


  protected readonly error =
    signal<string | null>(null);


  protected readonly message =
    signal('');


  protected readonly messageError =
    signal(false);


  constructor() {
    this.route.paramMap
      .pipe(takeUntilDestroyed())
      .subscribe(params => this.loadAsset(params.get('id')));
  }

  protected specifications(): Array<[string, string]> {
    return Object.entries(this.asset()?.specifications ?? {});
  }

  private loadAsset(id: string | null): void {
    this.loading.set(true);
    this.error.set(null);

    if (!id) {

      this.error.set(
        'No asset ID was provided.'
      );

      this.loading.set(false);

      return;

    }


    this.assetService
      .getById(id)
      .subscribe({

        next: asset => {
          if (this.route.snapshot.paramMap.get('id') !== id) return;

          this.asset.set(asset);

          this.loading.set(false);

        },


        error: error => {
          if (this.route.snapshot.paramMap.get('id') !== id) return;

          console.error(
            'Unable to load asset:',
            error
          );

          this.error.set(
            'Unable to load this asset.'
          );

          this.loading.set(false);

        }

      });

  }


  protected categoryLabel(): string {

    const category =
      this.asset()?.category;


    if (!category) {
      return '';
    }


    return String(category)
      .replaceAll('_', ' ');

  }


  protected requestAsset(): void {

    this.messageError.set(false);

    this.message.set(
      'Asset request functionality can be connected here.'
    );

  }

}