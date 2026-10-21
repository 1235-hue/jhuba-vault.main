import { CurrencyPipe, DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import {
  AssetCategory,
  RequestStatus,
  Asset,
  AuditLog
} from '../core/models';

import { AdminService, AssetService } from '../core/api.service';
import { MediaService } from '../core/media.service';
import { AssetImageComponent } from '../shared/asset-image.component';

interface AssetDraft {
  assetTag: string;
  name: string;
  category: AssetCategory;
  description: string;
  price: number;
  totalQuantity: number;
  availableQty: number;
}

@Component({
  selector: 'jhub-admin-page',
  standalone: true,
  imports: [
    CurrencyPipe,
    DatePipe,
    FormsModule,
    RouterLink,
    AssetImageComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,

  template: `
    <main class="admin-page page-width">

      <!-- HEADER -->
      <div class="admin-heading">
        <div>
          <p class="eyebrow">
            ADMINISTRATION / {{ sectionLabel() }}
          </p>

          <h1>
            {{ title() }}
            <em>{{ accent() }}</em>
          </h1>
          @if (section() === 'audit-log') {
            <p class="admin-intro">Track recorded system activity and user actions for accountability.</p>
          }
        </div>

        @if (section() === 'audit-log') {
          <div class="audit-header-actions">
            <label>From <input type="date" aria-label="Filter audit logs from date" [ngModel]="auditDateFrom()" (ngModelChange)="setAuditDateFrom($event)"></label>
            <label>To <input type="date" aria-label="Filter audit logs to date" [ngModel]="auditDateTo()" (ngModelChange)="setAuditDateTo($event)"></label>
            <button type="button" class="export-button" disabled aria-describedby="export-unavailable"><i class="pi pi-download"></i> Export Log</button>
            <span id="export-unavailable" class="sr-only">Audit export is not supported by the current API.</span>
          </div>
        } @else {
          <a class="arrow-link" routerLink="/admin/dashboard">Dashboard ↗</a>
        }
      </div>


      <!-- ===================================================== -->
      <!-- ASSETS -->
      <!-- ===================================================== -->

      @if (section() === 'assets') {

        <section class="table-panel">

          <div class="toolbar">
            <strong>Asset management</strong>

            <span>
              {{ assets().length }} development records
            </span>
          </div>


          <!-- CREATE / EDIT ASSET -->
          <form
            class="asset-form"
            (ngSubmit)="saveAsset()">

            <strong>
              {{ editingId() ? 'Edit asset' : 'Create asset' }}
            </strong>

            <div class="form-grid">

              <label>
                Asset tag

                <input
                  name="assetTag"
                  [(ngModel)]="form.assetTag"
                  required>
              </label>


              <label>
                Name

                <input
                  name="name"
                  [(ngModel)]="form.name"
                  required>
              </label>


              <label>
                Category

                <select
                  name="category"
                  [(ngModel)]="form.category"
                  required>

                  @for (
                    category of categories;
                    track category
                  ) {

                    <option
                      [ngValue]="category">

                      {{ label(category) }}

                    </option>

                  }

                </select>
              </label>


              <label>
                Price

                <input
                  name="price"
                  type="number"
                  min="0"
                  step="0.01"
                  [(ngModel)]="form.price"
                  required>
              </label>


              <label>
                Total quantity

                <input
                  name="totalQuantity"
                  type="number"
                  min="1"
                  step="1"
                  [(ngModel)]="form.totalQuantity"
                  required>
              </label>


              <label>
                Available quantity

                <input
                  name="availableQty"
                  type="number"
                  min="0"
                  [max]="form.totalQuantity"
                  step="1"
                  [(ngModel)]="form.availableQty"
                  required>
              </label>

            </div>


            <label>
              Description

              <textarea
                name="description"
                rows="3"
                [(ngModel)]="form.description"
                required>
              </textarea>
            </label>


            @if (message()) {

              <p
                class="feedback"
                [class.error]="error()">

                {{ message() }}

              </p>

            }


            <div class="form-actions">

              <button
                type="submit"
                [disabled]="busy()">

                {{ editingId()
                  ? 'Save changes'
                  : 'Create asset'
                }}

              </button>


              @if (editingId()) {

                <button
                  type="button"
                  class="cancel"
                  (click)="resetForm()">

                  Cancel

                </button>

              }

            </div>

          </form>


          <!-- ASSET LIST -->
          <div class="asset-management">

            @for (
              asset of assets();
              track asset.id
            ) {

              <article class="asset-editor">

                <!-- IMAGE -->
                <div class="asset-preview">

                  <jhub-asset-image
                    [url]="asset.imageUrl"
                    [alt]="asset.name">
                  </jhub-asset-image>

                </div>


                <!-- DETAILS -->
                <div class="asset-editor-info">

                  <strong>
                    {{ asset.name }}
                  </strong>


                  <small>
                    {{ asset.assetTag }}
                  </small>


                  <small>
                    {{
                      asset.price
                        | currency:'USD':'symbol':'1.2-2'
                    }}

                    ·

                    {{ asset.availableQty }}/
                    {{ asset.totalQuantity }}
                    available
                  </small>


                  <!-- EDIT -->
                  <button
                    type="button"
                    class="edit-asset"
                    (click)="edit(asset)">

                    Edit details

                  </button>


                  <!-- AVAILABILITY -->
                  <button
                    type="button"
                    class="edit-asset"
                    (click)="toggleAvailability(asset)">

                    {{
                      asset.availableQty
                        ? 'Mark unavailable'
                        : 'Mark available'
                    }}

                  </button>


                  <!-- DELETE ASSET -->
                  <button
                    type="button"
                    class="remove-image"
                    [disabled]="busy()"
                    (click)="deleteAsset(asset)">

                    Delete asset

                  </button>


                  <!-- IMAGE UPLOAD -->
                  <label class="file-button">

                    {{
                      uploadingId() === asset.id
                        ? 'Uploading ' + progress() + '%'
                        : asset.imageUrl
                          ? 'Replace image'
                          : 'Select image'
                    }}

                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      [disabled]="busy()"
                      (change)="upload(asset, $event)">

                  </label>


                  <!-- IMAGE DELETE -->
                  @if (asset.imageUrl) {

                    <button
                      type="button"
                      class="remove-image"
                      [disabled]="busy()"
                      (click)="remove(asset)">

                      Remove image

                    </button>

                  }


                  <small class="image-help">
                    JPG, PNG or WebP · max 5MB
                  </small>

                </div>

              </article>

            }

          </div>

        </section>

      }


      <!-- ===================================================== -->
      <!-- INVENTORY -->
      <!-- ===================================================== -->

      @else if (section() === 'inventory') {

        <section class="table-panel">

          <div class="toolbar">

            <strong>
              Inventory overview
            </strong>

          </div>


          @for (
            asset of assets();
            track asset.id
          ) {

            <div class="asset-line">

              <span>

                <strong>
                  {{ asset.name }}
                </strong>

                <small>
                  {{ asset.assetTag }}
                </small>

              </span>


              <span>
                {{ label(asset.category) }}
              </span>


              <span>
                {{ asset.totalQuantity }}
              </span>


              <span>
                {{ asset.availableQty }}
              </span>


              <span>

                {{
                  asset.availableQty
                    ? 'IN STOCK'
                    : 'CHECKED OUT'
                }}

              </span>

            </div>

          }

        </section>

      }


      <!-- ===================================================== -->
      <!-- REQUESTS -->
      <!-- ===================================================== -->

      @else if (section() === 'requests') {

        <section class="table-panel">

          <div class="toolbar">

            <strong>
              Request queue
            </strong>

          </div>


          <div class="asset-line">

            <span>

              <strong>
                AgriSense Soil Monitor
              </strong>

              <small>
                Amina Wanjiku · 4 assets
              </small>

            </span>


            <span class="status pending">

              {{ RequestStatus.PENDING }}

            </span>


            <button class="approve">
              Approve
            </button>


            <button class="reject">
              Reject
            </button>

          </div>

        </section>

      }


      <!-- ===================================================== -->
      <!-- USERS -->
      <!-- ===================================================== -->

      @else if (section() === 'users') {

        <section class="table-panel">

          <div class="toolbar">

            <strong>
              Innovator directory
            </strong>

          </div>


          <div class="asset-line">

            <span>

              <strong>
                Amina Wanjiku
              </strong>

              <small>
                JHUB-001
              </small>

            </span>


            <span>
              amina@example.com
            </span>


            <span>
              INNOVATOR
            </span>

          </div>

        </section>

      }


      <!-- ===================================================== -->
      <!-- AUDIT -->
      <!-- ===================================================== -->

      @else if (section() === 'audit-log') {
        <section class="audit-metrics" aria-label="Audit log summary">
          <article class="audit-metric"><span class="audit-icon blue"><i class="pi pi-file"></i></span><div><small>Latest Logs</small><strong>{{ auditLoading() || auditError() ? '—' : auditLogs().length }}</strong><p>Up to 100 records from the API</p></div></article>
          <article class="audit-metric"><span class="audit-icon green"><i class="pi pi-user-edit"></i></span><div><small>User Actions</small><strong>{{ auditLoading() || auditError() ? '—' : auditUserActions() }}</strong><p>Recorded with an actor</p></div></article>
          <article class="audit-metric"><span class="audit-icon violet"><i class="pi pi-cog"></i></span><div><small>System Actions</small><strong>{{ auditLoading() || auditError() ? '—' : auditSystemActions() }}</strong><p>Recorded without an actor</p></div></article>
          <article class="audit-metric"><span class="audit-icon red"><i class="pi pi-shield"></i></span><div><small>Security Events</small><strong class="not-tracked">Not tracked</strong><p>No event classification in API</p></div></article>
        </section>

        <section class="table-panel audit-panel" aria-labelledby="audit-table-heading">
          <div class="toolbar audit-toolbar">
            <strong id="audit-table-heading">Activity log</strong>
            <span>Showing the latest {{ auditLogs().length }} records provided by the API</span>
          </div>
          @if (auditError()) {
            <p class="audit-state error" role="alert">{{ auditError() }} <button type="button" (click)="loadAuditLogs()">Try again</button></p>
          } @else if (auditLoading()) {
            <p class="audit-state" role="status">Loading audit activity…</p>
          } @else {
            <div class="audit-filters">
              <label class="audit-search"><i class="pi pi-search"></i><input type="search" aria-label="Search audit user, action, resource, or record ID" placeholder="Search user, action, resource, or ID…" [ngModel]="auditSearch()" (ngModelChange)="setAuditSearch($event)"></label>
              <label><span class="sr-only">Filter by action</span><select aria-label="Filter by action type" [ngModel]="auditActionFilter()" (ngModelChange)="setAuditAction($event)"><option value="">All actions</option>@for (action of auditActions(); track action) { <option [value]="action">{{ action.replaceAll('_', ' ') }}</option> }</select></label>
              <label><span class="sr-only">Filter by user</span><select aria-label="Filter by user" [ngModel]="auditUserFilter()" (ngModelChange)="setAuditUser($event)"><option value="">All users</option>@for (user of auditUsers(); track user.id) { <option [value]="user.id">{{ user.fullName }}</option> }</select></label>
              <label><span class="sr-only">Filter by resource</span><select aria-label="Filter by resource" [ngModel]="auditResourceFilter()" (ngModelChange)="setAuditResource($event)"><option value="">All resources</option>@for (resource of auditResources(); track resource) { <option [value]="resource">{{ resource }}</option> }</select></label>
              <button type="button" class="clear-audit-filters" [disabled]="!hasAuditFilters()" (click)="clearAuditFilters()">Clear filters</button>
            </div>
            <p class="audit-scope-note">Search, date filters, and counts apply only to the latest 100 logs returned by the API. IP addresses and event security classifications are not provided.</p>
            <div class="audit-table-wrap">
              <table class="audit-table">
                <thead><tr><th>ID</th><th>Timestamp</th><th>User</th><th>Action Type</th><th>Resource</th><th>Details</th><th>IP Address</th></tr></thead>
                <tbody>
                  @for (entry of auditPageItems(); track entry.id) {
                    <tr>
                      <td class="audit-id">{{ shortAuditId(entry.id) }}</td>
                      <td class="audit-timestamp">{{ entry.createdAt | date:'MMM d, y, h:mm a' }}</td>
                      <td><span class="audit-user"><span class="audit-avatar">{{ initials(entry.actor?.fullName || 'System') }}</span><span><strong>{{ entry.actor?.fullName || 'System' }}</strong><small>{{ entry.actor?.email || 'Automated activity' }}</small></span></span></td>
                      <td><span class="audit-action" [class]="actionClass(entry.action)">{{ actionLabel(entry.action) }}</span></td>
                      <td>{{ entry.entityType }}</td>
                      <td class="audit-detail">Record {{ shortAuditId(entry.entityId) }}</td>
                      <td class="audit-unavailable" title="IP address is not included in the audit API">Not captured</td>
                    </tr>
                  } @empty {
                    <tr><td colspan="7"><div class="audit-empty"><i class="pi pi-search"></i><strong>{{ auditLogs().length ? 'No audit events match these filters' : 'No audit events have been recorded' }}</strong><p>{{ auditLogs().length ? 'Try another search or clear the current filters.' : 'New audit activity will appear here when it is recorded.' }}</p>@if (auditLogs().length) { <button type="button" class="clear-audit-filters" (click)="clearAuditFilters()">Clear filters</button> }</div></td></tr>
                  }
                </tbody>
              </table>
            </div>
            <footer class="audit-pagination">
              <span>Showing {{ auditStart() }}–{{ auditEnd() }} of {{ filteredAuditLogs().length }} loaded logs</span>
              <div class="audit-page-controls">
                <label>Rows <select aria-label="Audit rows per page" [ngModel]="auditPageSize()" (ngModelChange)="setAuditPageSize($event)"><option [ngValue]="10">10</option><option [ngValue]="25">25</option><option [ngValue]="50">50</option></select></label>
                <button type="button" aria-label="Previous audit page" [disabled]="auditPage() <= 1" (click)="setAuditPage(auditPage() - 1)"><i class="pi pi-angle-left"></i></button>
                <span>{{ auditPage() }} / {{ auditPageCount() }}</span>
                <button type="button" aria-label="Next audit page" [disabled]="auditPage() >= auditPageCount()" (click)="setAuditPage(auditPage() + 1)"><i class="pi pi-angle-right"></i></button>
              </div>
            </footer>
          }
        </section>

      }


      <!-- ===================================================== -->
      <!-- SETTINGS -->
      <!-- ===================================================== -->

      @else {

        <section class="settings-panel">

          <p class="eyebrow">
            ADMIN SETTINGS
          </p>

          <h2>
            Vault configuration
          </h2>

          <p>
            Settings exposed by the backend will appear here.
          </p>

        </section>

      }

    </main>
  `,

  styles: [`

    :host {
      display: block;
    }

    .admin-page {
      padding: 65px 0 110px;
    }

    .page-width {
      width: min(1160px, calc(100% - 48px));
      margin: auto;
    }

    .eyebrow {
      color: #3ea945;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 2px;
      margin: 0 0 18px;
    }

    .admin-heading {
      display: flex;
      justify-content: space-between;
      align-items: end;
      margin-bottom: 35px;
    }

    .admin-heading h1 {
      font: 400 clamp(42px, 5vw, 58px)/1.05 Georgia, serif;
      color: #262571;
      margin: 0;
    }

    .admin-heading em {
      color: #3ea945;
    }

    .admin-intro {
      margin: 9px 0 0;
      color: #667083;
      font-size: 12px;
      line-height: 1.5;
    }

    .arrow-link {
      color: #262571;
      text-decoration: none;
      font-size: 12px;
      font-weight: 700;
    }

    .table-panel,
    .settings-panel,
    .empty-panel {
      background: #fff;
      border: 1px solid #e6e8ee;
      padding: 25px;
    }

    .toolbar {
      display: flex;
      justify-content: space-between;
      padding-bottom: 18px;
      border-bottom: 1px solid #edf0f4;
      color: #262571;
    }

    .toolbar span {
      font-size: 11px;
      color: #7c8492;
    }

    /* FORM */

    .asset-form {
      display: grid;
      gap: 18px;
      padding: 22px 0;
      border-bottom: 1px solid #edf0f4;
    }

    .form-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
    }

    .asset-form label {
      display: block;
      color: #586174;
      font-size: 11px;
    }

    .asset-form input,
    .asset-form select,
    .asset-form textarea {
      display: block;
      width: 100%;
      box-sizing: border-box;
      border: 1px solid #dce0e8;
      margin-top: 7px;
      padding: 12px;
      font: inherit;
      outline-color: #3ea945;
    }

    .form-actions {
      display: flex;
      gap: 10px;
    }

    .form-actions button {
      border: 0;
      background: #262571;
      color: #fff;
      padding: 12px 18px;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
    }

    .form-actions button:disabled {
      opacity: .5;
      cursor: wait;
    }

    .form-actions .cancel {
      background: #e9ebf1;
      color: #262571;
    }

    /* ASSETS */

    .asset-management {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 18px;
      padding-top: 20px;
    }

    .asset-editor {
      display: grid;
      grid-template-columns: 130px 1fr;
      gap: 15px;
      border: 1px solid #edf0f4;
      padding: 15px;
    }

    .asset-preview {
      height: 120px;
      overflow: hidden;
      background: #f4f5f8;
    }

    .asset-preview jhub-asset-image {
      display: block;
      width: 100%;
      height: 100%;
    }

    .asset-editor-info strong,
    .asset-editor-info small {
      display: block;
    }

    .asset-editor-info strong {
      color: #262571;
    }

    .asset-editor-info small {
      font-size: 10px;
      color: #7c8492;
      margin: 5px 0;
    }

    .image-help {
      color: #9aa1ad !important;
    }

    /* UPLOAD */

    .file-button {
      display: inline-block;
      background: #262571;
      color: #fff;
      padding: 9px;
      margin-top: 8px;
      font-size: 10px;
      font-weight: 700;
      cursor: pointer;
    }

    .file-button input {
      display: none;
    }

    .edit-asset {
      display: block;
      border: 0;
      background: transparent;
      color: #262571;
      padding: 8px 0;
      font-size: 10px;
      font-weight: 700;
      cursor: pointer;
    }

    .remove-image {
      display: block;
      border: 0;
      background: transparent;
      color: #e6292a;
      padding: 8px 0;
      font-size: 10px;
      cursor: pointer;
    }

    .remove-image:disabled {
      opacity: .5;
      cursor: wait;
    }

    /* FEEDBACK */

    .feedback {
      color: #26742b;
      font-size: 12px;
      margin: 0;
    }

    .feedback.error {
      color: #a51f20;
    }

    /* INVENTORY */

    .asset-line {
      display: grid;
      grid-template-columns: 2fr 1fr 1fr 1fr 1fr;
      gap: 15px;
      padding: 15px 0;
      border-bottom: 1px solid #edf0f4;
      font-size: 11px;
      color: #667083;
    }

    .asset-line strong,
    .asset-line small {
      display: block;
    }

    .asset-line strong {
      color: #262571;
    }

    .asset-line small {
      font-size: 9px;
    }

    /* REQUESTS */

    .approve,
    .reject {
      border: 0;
      background: transparent;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
    }

    .approve {
      color: #3ea945;
    }

    .reject {
      color: #e6292a;
    }

    .pending {
      color: #b17b19;
    }

    /* EMPTY */

    .empty-panel {
      min-height: 220px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: #667083;
      gap: 10px;
    }

    .empty-panel strong,
    .settings-panel h2 {
      font: 25px Georgia, serif;
      color: #262571;
    }

    .audit-header-actions{display:flex;align-items:end;flex-wrap:wrap;justify-content:flex-end;gap:8px}
    .audit-header-actions label{display:grid;gap:4px;color:#687284;font-size:9px}
    .audit-header-actions input{height:33px;padding:6px 8px;border:1px solid #dce0e8;border-radius:5px;background:#fff;color:#344054;font:inherit;font-size:10px}
    .export-button{height:33px;display:inline-flex;align-items:center;gap:6px;padding:0 11px;border:0;border-radius:5px;background:var(--blue,#2a4695);color:#fff;font-size:10px;font-weight:700}
    .export-button:disabled{opacity:.55;cursor:not-allowed}
    .audit-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:0 0 18px}
    .audit-metric{min-width:0;min-height:95px;display:flex;align-items:flex-start;gap:11px;padding:14px;background:#fff;border:1px solid #e6e8ee;border-radius:8px}
    .audit-icon{width:34px;height:34px;display:grid;place-items:center;flex:none;border-radius:8px;background:#edf3ff;color:#2a4695}
    .audit-icon.green{background:#eaf7ec;color:#3ea945}.audit-icon.violet{background:#f4effb;color:#8061b2}.audit-icon.red{background:#fff0f0;color:#e6292a}
    .audit-metric small{display:block;color:#727c8d;font-size:9px;font-weight:800;letter-spacing:.4px}
    .audit-metric strong{display:block;margin-top:5px;color:#172033;font-size:22px}
    .audit-metric strong.not-tracked{font-size:12px;color:#8993a1}
    .audit-metric p{margin:4px 0 0;color:#7c8492;font-size:9px}
    .audit-panel{padding:0;overflow:hidden}
    .audit-toolbar{align-items:baseline;gap:10px;padding:16px 17px;border-bottom:1px solid #edf0f4}
    .audit-toolbar strong{color:#172033;font-size:15px}
    .audit-toolbar span{font-size:9px;color:#7c8492;text-align:right}
    .audit-filters{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:12px 16px;border-bottom:1px solid #edf0f4}
    .audit-search,.audit-filters>label:not(.audit-search){height:34px;display:flex;align-items:center;gap:7px;padding:0 9px;border:1px solid #dce0e8;border-radius:5px;background:#fff;color:#788397}
    .audit-search{flex:1;min-width:180px}
    .audit-search input{width:100%;min-width:0;border:0;outline:0;background:transparent;color:#172033;font-size:10px}
    .audit-search input::placeholder{color:#8a93a2}
    .audit-filters select{max-width:150px;border:0;outline:0;background:transparent;color:#586174;font-size:10px}
    .clear-audit-filters{height:32px;padding:0 10px;border:1px solid #dce0e8;border-radius:5px;background:#fff;color:#586174;font-size:10px;font-weight:600}
    .clear-audit-filters:disabled{opacity:.5;cursor:default}
    .audit-scope-note{margin:0;padding:8px 16px;border-bottom:1px solid #edf0f4;background:#f7f9fc;color:#687284;font-size:9px;line-height:1.45}
    .audit-table-wrap{width:100%;overflow-x:auto}
    .audit-table{width:100%;min-width:930px;border-collapse:collapse;text-align:left}
    .audit-table th{height:42px;padding:8px 9px;background:#fafbfc;border-bottom:1px solid #e6e8ee;color:#687284;font-size:9px;letter-spacing:.45px;text-transform:uppercase}
    .audit-table td{height:58px;padding:8px 9px;border-bottom:1px solid #edf0f4;color:#586174;font-size:9px;vertical-align:middle}
    .audit-table tbody tr:hover{background:#fbfcfe}.audit-table tbody tr:last-child td{border-bottom:0}
    .audit-id{color:#667083!important;font-family:Consolas,monospace;font-size:8px!important;white-space:nowrap}
    .audit-timestamp{white-space:nowrap}
    .audit-user{min-width:135px;display:flex;align-items:center;gap:7px}
    .audit-avatar{width:27px;height:27px;display:grid;place-items:center;flex:none;border-radius:50%;background:#edf3ff;color:#2a4695;font-size:8px;font-weight:800}
    .audit-user>span:last-child{min-width:0;display:grid;gap:3px}
    .audit-user strong,.audit-user small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .audit-user strong{color:#344054;font-size:9px}.audit-user small{color:#8993a1;font-size:8px}
    .audit-action{display:inline-flex;padding:4px 7px;border-radius:12px;background:#edf3ff;color:#2a4695;font-size:8px;font-weight:700;white-space:nowrap}
    .audit-action.create{background:#eaf7ec;color:#287c32}.audit-action.update{background:#fff6e7;color:#aa7015}
    .audit-action.delete{background:#fff0f0;color:#c52c2d}.audit-action.view{background:#f4effb;color:#8061b2}
    .audit-action.auth{background:#edf3ff;color:#2a4695}.audit-action.system{background:#f0f2f5;color:#586174}
    .audit-detail{font-family:Consolas,monospace;font-size:8px!important;white-space:nowrap}
    .audit-unavailable{color:#8993a1!important;font-size:8px!important;white-space:nowrap}
    .audit-empty{min-height:160px;padding:20px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;color:#7c8492}
    .audit-empty>i{font-size:20px;color:#8994a5}.audit-empty strong{margin-top:9px;color:#344054;font-size:12px}.audit-empty p{margin:5px 0 10px;font-size:10px}
    .audit-state{margin:0;padding:24px 17px;color:#667083;font-size:11px}
    .audit-state.error{color:#a51f20}.audit-state button{margin-left:8px;border:0;background:transparent;color:#262571;text-decoration:underline}
    .audit-pagination{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 16px;border-top:1px solid #edf0f4;color:#7c8492;font-size:9px}
    .audit-page-controls{display:flex;align-items:center;gap:7px}.audit-page-controls label{display:flex;align-items:center;gap:5px}
    .audit-page-controls select,.audit-page-controls button{height:27px;border:1px solid #dce0e8;border-radius:4px;background:#fff;color:#586174;font-size:9px}
    .audit-page-controls select{padding:0 4px}.audit-page-controls button{width:27px}.audit-page-controls button:disabled{opacity:.45;cursor:not-allowed}
    .sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}

    /* MOBILE */

    @media (max-width: 760px) {
      .admin-heading{align-items:flex-start;flex-direction:column;gap:14px}
      .audit-header-actions{justify-content:flex-start}
      .audit-metrics{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
      .audit-metric{min-height:84px;padding:11px;gap:8px}
      .audit-toolbar{align-items:flex-start;flex-direction:column}
      .audit-toolbar span{text-align:left}
      .audit-filters{align-items:stretch}
      .audit-search{flex-basis:100%}
      .audit-filters>label:not(.audit-search){flex:1;min-width:120px}
      .audit-filters select{max-width:none;width:100%}
      .audit-pagination{align-items:flex-start;flex-direction:column}
      .audit-page-controls{align-self:flex-end}

      .asset-management {
        grid-template-columns: 1fr;
      }

      .form-grid {
        grid-template-columns: 1fr;
      }

      .admin-heading {
        display: block;
      }

      .asset-line {
        min-width: 650px;
      }

      .table-panel {
        overflow: auto;
      }

    }

  `]
})
export class AdminPageComponent {

  private readonly router = inject(Router);
  private readonly media = inject(MediaService);
  private readonly assetService = inject(AssetService);
  private readonly adminService = inject(AdminService);

  protected readonly RequestStatus = RequestStatus;

  protected readonly categories =
    Object.values(AssetCategory);

  protected readonly assets =
    signal<Asset[]>([]);

  protected readonly auditLogs =
    signal<AuditLog[]>([]);

  protected readonly auditLoading =
    signal(false);

  protected readonly auditError =
    signal<string | null>(null);

  protected readonly auditSearch = signal('');
  protected readonly auditActionFilter = signal('');
  protected readonly auditUserFilter = signal('');
  protected readonly auditResourceFilter = signal('');
  protected readonly auditDateFrom = signal('');
  protected readonly auditDateTo = signal('');
  protected readonly auditPage = signal(1);
  protected readonly auditPageSize = signal(10);

  protected readonly auditActions = computed(() =>
    Array.from(new Set(this.auditLogs().map(log => log.action))).sort()
  );
  protected readonly auditUsers = computed(() => {
    const unique = new Map<string, { id: string; fullName: string }>();
    for (const log of this.auditLogs()) {
      if (log.actor) unique.set(log.actor.id, { id: log.actor.id, fullName: log.actor.fullName });
    }
    return Array.from(unique.values()).sort((left, right) => left.fullName.localeCompare(right.fullName));
  });
  protected readonly auditResources = computed(() =>
    Array.from(new Set(this.auditLogs().map(log => log.entityType))).sort()
  );
  protected readonly filteredAuditLogs = computed(() => {
    const query = this.auditSearch().trim().toLowerCase();
    return this.auditLogs().filter(log => {
      const logDate = new Date(log.createdAt).toISOString().slice(0, 10);
      const matchesSearch = !query || `${log.id} ${log.actor?.fullName ?? ''} ${log.actor?.email ?? ''} ${log.action} ${log.entityType} ${log.entityId}`.toLowerCase().includes(query);
      return matchesSearch
        && (!this.auditActionFilter() || log.action === this.auditActionFilter())
        && (!this.auditUserFilter() || log.actor?.id === this.auditUserFilter())
        && (!this.auditResourceFilter() || log.entityType === this.auditResourceFilter())
        && (!this.auditDateFrom() || logDate >= this.auditDateFrom())
        && (!this.auditDateTo() || logDate <= this.auditDateTo());
    });
  });
  protected readonly auditPageCount = computed(() => Math.max(1, Math.ceil(this.filteredAuditLogs().length / this.auditPageSize())));
  protected readonly auditPageItems = computed(() => {
    const start = (this.auditPage() - 1) * this.auditPageSize();
    return this.filteredAuditLogs().slice(start, start + this.auditPageSize());
  });
  protected readonly auditStart = computed(() => this.filteredAuditLogs().length ? (this.auditPage() - 1) * this.auditPageSize() + 1 : 0);
  protected readonly auditEnd = computed(() => Math.min(this.auditPage() * this.auditPageSize(), this.filteredAuditLogs().length));
  protected readonly auditUserActions = computed(() => this.auditLogs().filter(log => log.actor !== null && log.actor !== undefined).length);
  protected readonly auditSystemActions = computed(() => this.auditLogs().filter(log => !log.actor).length);

  protected readonly editingId =
    signal<string | null>(null);

  protected readonly saving =
    signal(false);

  protected readonly uploadingId =
    signal<string | null>(null);

  protected readonly progress =
    signal(0);

  protected readonly message =
    signal('');

  protected readonly error =
    signal(false);

  protected form: AssetDraft =
    this.emptyForm();


  protected readonly busy =
    computed(() =>
      this.uploadingId() !== null ||
      this.saving()
    );


  protected readonly section =
    computed(() =>
      this.router.url.split('/')[2] || 'dashboard'
    );


  protected readonly sectionLabel =
    computed(() =>
      this.section()
        .replace('-', ' ')
        .toUpperCase()
    );


  protected readonly title =
    computed(() =>
      this.section() === 'audit-log'
        ? 'Audit'
        : this.section()
    );


  protected readonly accent =
    computed(() =>
      this.section() === 'audit-log'
        ? 'log.'
        : this.section() === 'requests'
        ? 'queue.'
        : 'overview.'
    );


  constructor() {
    if (this.section() === 'audit-log') {
      this.loadAuditLogs();
    } else {
      this.loadAssets();
    }
  }


  protected label(
    value: AssetCategory
  ): string {

    return value.replaceAll('_', ' ');
  }

  protected setAuditSearch(value: string): void {
    this.auditSearch.set(value);
    this.auditPage.set(1);
  }

  protected setAuditAction(value: string): void {
    this.auditActionFilter.set(value);
    this.auditPage.set(1);
  }

  protected setAuditUser(value: string): void {
    this.auditUserFilter.set(value);
    this.auditPage.set(1);
  }

  protected setAuditResource(value: string): void {
    this.auditResourceFilter.set(value);
    this.auditPage.set(1);
  }

  protected setAuditDateFrom(value: string): void {
    this.auditDateFrom.set(value);
    this.auditPage.set(1);
  }

  protected setAuditDateTo(value: string): void {
    this.auditDateTo.set(value);
    this.auditPage.set(1);
  }

  protected setAuditPageSize(value: number): void {
    this.auditPageSize.set(Number(value));
    this.auditPage.set(1);
  }

  protected setAuditPage(value: number): void {
    this.auditPage.set(Math.min(this.auditPageCount(), Math.max(1, value)));
  }

  protected hasAuditFilters(): boolean {
    return Boolean(
      this.auditSearch()
      || this.auditActionFilter()
      || this.auditUserFilter()
      || this.auditResourceFilter()
      || this.auditDateFrom()
      || this.auditDateTo()
    );
  }

  protected clearAuditFilters(): void {
    this.auditSearch.set('');
    this.auditActionFilter.set('');
    this.auditUserFilter.set('');
    this.auditResourceFilter.set('');
    this.auditDateFrom.set('');
    this.auditDateTo.set('');
    this.auditPage.set(1);
  }

  protected shortAuditId(id: string): string {
    return id.length > 12 ? `${id.slice(0, 8)}…` : id;
  }

  protected initials(name: string): string {
    return name.trim().split(/\s+/).filter(Boolean).slice(0, 2)
      .map(part => part.charAt(0).toUpperCase())
      .join('') || 'SY';
  }

  protected actionLabel(action: string): string {
    return action.toLowerCase().split('_')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  protected actionClass(action: string): string {
    const value = action.toLowerCase();
    if (value.includes('create') || value.includes('upload')) return 'audit-action create';
    if (value.includes('update') || value.includes('replace')) return 'audit-action update';
    if (value.includes('delete') || value.includes('remove')) return 'audit-action delete';
    if (value.includes('view') || value.includes('read')) return 'audit-action view';
    if (value.includes('login') || value.includes('auth')) return 'audit-action auth';
    return 'audit-action system';
  }


  private emptyForm(): AssetDraft {

    return {
      assetTag: '',
      name: '',
      category:
        AssetCategory.COMPUTING_PERIPHERALS,
      description: '',
      price: 0,
      totalQuantity: 1,
      availableQty: 1
    };

  }


  private loadAssets(): void {

    this.assetService.list().subscribe({

      next: assets => {
        this.assets.set(assets);
      },

      error: () => {
        this.setFeedback(
          'Unable to load assets.',
          true
        );
      }

    });

  }

  protected loadAuditLogs(): void {
    this.auditLoading.set(true);
    this.auditError.set(null);
    this.adminService.auditLog().subscribe({
      next: logs => {
        this.auditLogs.set(logs);
        this.auditPage.set(1);
        this.auditLoading.set(false);
      },
      error: () => {
        this.auditError.set('Unable to load the audit log.');
        this.auditLoading.set(false);
      }
    });
  }


  private setFeedback(
    message: string,
    isError = false
  ): void {

    this.error.set(isError);
    this.message.set(message);

  }


  protected resetForm(): void {

    this.editingId.set(null);

    this.form =
      this.emptyForm();

  }


  protected edit(asset: Asset): void {

    this.editingId.set(asset.id);

    this.form = {

      assetTag: asset.assetTag,

      name: asset.name,

      category: asset.category,

      description: asset.description,

      price: Number(asset.price),

      totalQuantity:
        asset.totalQuantity,

      availableQty:
        asset.availableQty

    };

    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });

  }


  protected saveAsset(): void {

    if (
      !this.form.assetTag.trim() ||
      !this.form.name.trim() ||
      !this.form.description.trim() ||
      this.form.price < 0 ||
      this.form.totalQuantity < 1 ||
      this.form.availableQty < 0 ||
      this.form.availableQty >
        this.form.totalQuantity
    ) {

      this.setFeedback(
        'Complete all fields and keep quantities within valid limits.',
        true
      );

      return;
    }


    this.saving.set(true);

    this.setFeedback('');


    const request =
      this.editingId()

        ? this.assetService.update(
            this.editingId()!,
            this.form
          )

        : this.assetService.create({
            ...this.form,
            imageUrl: null,
            specifications: {}
          });


    request.subscribe({

      next: asset => {

        this.assets.update(
          assets =>
            this.editingId()

              ? assets.map(item =>
                  item.id === asset.id
                    ? asset
                    : item
                )

              : [...assets, asset]
        );

        this.resetForm();

        this.setFeedback(
          'Asset saved successfully.'
        );

      },

      error: () => {

        this.setFeedback(
          'Unable to save asset. Check the asset tag and field values.',
          true
        );

      },

      complete: () => {
        this.saving.set(false);
      }

    });

  }


  protected toggleAvailability(
    asset: Asset
  ): void {

    const availableQty =
      asset.availableQty
        ? 0
        : asset.totalQuantity;


    this.assetService
      .update(
        asset.id,
        { availableQty }
      )
      .subscribe({

        next: updated => {

          this.assets.update(
            assets =>
              assets.map(item =>
                item.id === updated.id
                  ? updated
                  : item
              )
          );

          this.setFeedback(
            'Asset availability updated.'
          );

        },

        error: (error: unknown) => {

          this.setFeedback(
            'Unable to update asset availability.',
            true
          );

        }

      });

  }


  protected deleteAsset(
    asset: Asset
  ): void {

    if (
      !confirm(
        `Delete ${asset.name}?`
      )
    ) {
      return;
    }


    this.assetService
      .remove(asset.id)
      .subscribe({

        next: () => {

          this.assets.update(
            assets =>
              assets.filter(
                item =>
                  item.id !== asset.id
              )
          );

          this.setFeedback(
            'Asset deleted successfully.'
          );

        },

        error: (error: unknown) => {

          this.setFeedback(
            'Unable to delete this asset. It may have request history.',
            true
          );

        }

      });

  }


  // =========================================================
  // IMAGE UPLOAD
  // =========================================================

  protected upload(
    asset: Asset,
    event: Event
  ): void {

    const input =
      event.target as HTMLInputElement;

    const file =
      input.files?.[0];


    if (!file) {
      return;
    }


    /*
     * MAXIMUM IMAGE SIZE
     *
     * 5 MB
     */
    const MAX_SIZE =
      5 * 1024 * 1024;


    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp'
    ];


    // FILE TYPE CHECK

    if (
      !allowedTypes.includes(
        file.type
      )
    ) {

      this.error.set(true);

      this.message.set(
        'Only JPG, PNG, or WebP images are allowed.'
      );

      input.value = '';

      return;
    }


    // FILE SIZE CHECK

    if (
      file.size > MAX_SIZE
    ) {

      this.error.set(true);

      this.message.set(
        'Image must be 5MB or smaller.'
      );

      input.value = '';

      return;
    }


    // START UPLOAD

    this.error.set(false);

    this.message.set('');

    this.uploadingId.set(
      asset.id
    );

    this.progress.set(0);


    this.media
      .upload(
        file,
        'assets',
        asset.id
      )
      .subscribe({

        next: update => {

          this.progress.set(
            update.percent
          );


          /*
           * CLOUDINARY / MEDIA RESULT
           */
          if (update.result?.asset) {
            const updated = update.result.asset;
            this.assets.update(assets =>
              assets.map(item => item.id === updated.id ? updated : item)
            );
            this.message.set('Asset image uploaded successfully.');
          } else if (update.result) {
            this.error.set(true);
            this.message.set('The server returned an invalid asset image response.');
          }

        },


        error: (error: unknown) => {

          this.uploadingId.set(
            null
          );

          this.progress.set(0);

          this.error.set(true);

          const message = error instanceof HttpErrorResponse
            ? error.error?.message
            : undefined;
          this.message.set(
            message || 'Image upload failed. Please try again.'
          );

          input.value = '';

        },


        complete: () => {

          this.uploadingId.set(
            null
          );

          this.progress.set(100);

          input.value = '';

        }

      });

  }


  // =========================================================
  // REMOVE IMAGE
  // =========================================================

  protected remove(
    asset: Asset
  ): void {

    if (!asset.imageUrl) {
      return;
    }


    this.uploadingId.set(
      asset.id
    );

    this.error.set(false);

    this.message.set('');


    this.media
      .removeAssetImage(
        asset.id
      )
      .subscribe({

        next: () => {

          /*
           * Update frontend immediately.
           */
          this.assets.update(
            assets =>
              assets.map(item =>
                item.id === asset.id
                  ? {
                      ...item,
                      imageUrl: null
                    }
                  : item
              )
          );


          this.message.set(
            'Asset image removed successfully.'
          );

        },


        error: () => {

          this.error.set(true);

          this.message.set(
            'Unable to remove the asset image.'
          );

        },


        complete: () => {

          this.uploadingId.set(
            null
          );

        }

      });

  }

}