import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../core/api.service';
import { Role, User } from '../core/models';

type UserRoleFilter = 'ALL' | Role;
type UserDialogMode = 'view' | 'edit' | null;
interface UserDraft {
  fullName: string;
  phoneNumber: string;
  department: string;
  role: Role;
}

@Component({
  selector: 'jhub-admin-users-page',
  standalone: true,
  imports: [DatePipe, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="users-page">
      <header class="page-heading">
        <div>
          <p class="eyebrow">ADMINISTRATION / USERS</p>
          <h1>User <em>management.</em></h1>
          <p class="intro">Review registered accounts and manage the user details supported by the Vault API.</p>
        </div>
        <div class="heading-actions">
          <button class="primary-button add-button" type="button" disabled aria-describedby="create-user-note"><i class="pi pi-plus"></i> Add User</button>
          <p id="create-user-note">Admin account creation is not available in the current API.</p>
        </div>
      </header>

      @if (feedback()) {
        <div class="feedback" [class.error]="feedbackIsError()" [attr.role]="feedbackIsError() ? 'alert' : 'status'">
          {{ feedback() }} <button type="button" (click)="feedback.set('')" aria-label="Dismiss message">×</button>
        </div>
      }

      @if (loading()) {
        <div class="page-message" role="status"><i class="pi pi-spin pi-spinner"></i> Loading users…</div>
      } @else if (error()) {
        <div class="page-message error" role="alert">{{ error() }} <button type="button" (click)="loadUsers()">Try again</button></div>
      } @else {
        <section class="summary-grid" aria-label="User metrics">
          <article class="summary-card">
            <span class="summary-icon blue"><i class="pi pi-users"></i></span>
            <div><small>Total Users</small><strong>{{ users().length }}</strong><p>Registered accounts</p></div>
          </article>
          <article class="summary-card">
            <span class="summary-icon green"><i class="pi pi-check-circle"></i></span>
            <div><small>Active Users</small><strong class="unavailable">Not tracked</strong><p>Account status is not exposed</p></div>
          </article>
          <article class="summary-card">
            <span class="summary-icon amber"><i class="pi pi-clock"></i></span>
            <div><small>Pending Approval</small><strong class="unavailable">Not tracked</strong><p>No user approval status</p></div>
          </article>
          <article class="summary-card">
            <span class="summary-icon red"><i class="pi pi-ban"></i></span>
            <div><small>Suspended Users</small><strong class="unavailable">Not tracked</strong><p>No suspension status</p></div>
          </article>
        </section>

        <section class="directory-panel" aria-labelledby="directory-heading">
          <div class="panel-toolbar">
            <div class="panel-title">
              <h2 id="directory-heading">Registered Users</h2>
              <span>{{ filteredUsers().length }} of {{ users().length }}</span>
            </div>
            <div class="role-summary">{{ innovatorsCount() }} Innovators <span>·</span> {{ adminsCount() }} Administrators</div>
          </div>

          <div class="filter-toolbar">
            <label class="search-field">
              <i class="pi pi-search"></i>
              <input type="search" aria-label="Search name, email, phone, identification, or role" placeholder="Search name, email, phone, ID, or role…" [ngModel]="search()" (ngModelChange)="setSearch($event)">
            </label>
            <label class="select-control">
              <span class="sr-only">Filter by role</span><i class="pi pi-filter"></i>
              <select [ngModel]="roleFilter()" (ngModelChange)="setRoleFilter($event)">
                <option value="ALL">All roles</option>
                <option [value]="Role.INNOVATOR">Innovator</option>
                <option [value]="Role.ADMIN">Administrator</option>
              </select>
            </label>
            <button type="button" class="secondary-button reset-button" [disabled]="!search() && roleFilter() === 'ALL'" (click)="clearFilters()">Reset filters</button>
          </div>

          <div class="table-scroll">
            <table>
              <thead><tr>
                <th>User</th><th>Email</th><th>Phone</th><th>Role</th><th>Registered</th><th class="actions-heading">Actions</th>
              </tr></thead>
              <tbody>
                @for (user of pageUsers(); track user.id) {
                  <tr>
                    <td>
                      <div class="user-cell">
                        <span class="avatar">@if (user.avatarUrl) { <img [src]="user.avatarUrl" [alt]="user.fullName"> } @else { {{ initials(user.fullName) }} }</span>
                        <span class="user-copy"><strong>{{ user.fullName }}</strong><small>{{ user.identificationId }}</small></span>
                      </div>
                    </td>
                    <td class="email-cell">{{ user.email }}</td>
                    <td>{{ user.phoneNumber || '—' }}</td>
                    <td><span class="role-badge" [class.admin]="user.role === Role.ADMIN">{{ user.role === Role.ADMIN ? 'Administrator' : 'Innovator' }}</span></td>
                    <td class="date-cell">{{ user.createdAt | date:'d MMM yyyy' }}</td>
                    <td><div class="row-actions">
                      <button type="button" class="action-button" (click)="viewUser(user)"><i class="pi pi-eye"></i><span>View</span></button>
                      <button type="button" class="action-button" (click)="editUser(user)"><i class="pi pi-pencil"></i><span>Edit</span></button>
                    </div></td>
                  </tr>
                } @empty {
                  <tr><td colspan="6">
                    <div class="empty-state"><i class="pi pi-users"></i><strong>{{ users().length ? 'No users match these filters' : 'No users are registered yet' }}</strong><p>{{ users().length ? 'Try another search or role, or reset the filters.' : 'Registered accounts will appear here.' }}</p>@if (users().length) { <button class="secondary-button" type="button" (click)="clearFilters()">Reset filters</button> }</div>
                  </td></tr>
                }
              </tbody>
            </table>
          </div>

          <footer class="pagination">
            <span>Showing {{ showingStart() }}–{{ showingEnd() }} of {{ filteredUsers().length }} users</span>
            <div class="page-controls">
              <label>Rows
                <select [ngModel]="pageSize()" (ngModelChange)="setPageSize($event)" aria-label="Users per page">
                  <option [ngValue]="10">10</option><option [ngValue]="25">25</option><option [ngValue]="50">50</option>
                </select>
              </label>
              <button type="button" class="page-button" [disabled]="page() <= 1" (click)="setPage(page() - 1)" aria-label="Previous page"><i class="pi pi-chevron-left"></i></button>
              <span class="page-number">{{ page() }} / {{ pageCount() }}</span>
              <button type="button" class="page-button" [disabled]="page() >= pageCount()" (click)="setPage(page() + 1)" aria-label="Next page"><i class="pi pi-chevron-right"></i></button>
            </div>
          </footer>
        </section>
      }
    </main>

    @if (dialogMode() && selectedUser(); as user) {
      <div class="modal-backdrop" (click)="closeDialog()">
        <section class="user-dialog" role="dialog" aria-modal="true" [attr.aria-labelledby]="dialogMode() === 'edit' ? 'edit-heading' : 'view-heading'" (click)="$event.stopPropagation()">
          <header class="dialog-heading">
            <div><p class="eyebrow">{{ dialogMode() === 'edit' ? 'EDIT ACCOUNT' : 'USER DETAILS' }}</p><h2 [id]="dialogMode() === 'edit' ? 'edit-heading' : 'view-heading'">{{ user.fullName }}</h2></div>
            <button type="button" class="dialog-close" aria-label="Close dialog" [disabled]="saving()" (click)="closeDialog()">×</button>
          </header>

          @if (dialogMode() === 'view') {
            <dl class="detail-grid">
              <div><dt>Email</dt><dd>{{ user.email }}</dd></div>
              <div><dt>Phone</dt><dd>{{ user.phoneNumber || '—' }}</dd></div>
              <div><dt>Identification</dt><dd>{{ user.identificationId }}</dd></div>
              <div><dt>Role</dt><dd>{{ user.role === Role.ADMIN ? 'Administrator' : 'Innovator' }}</dd></div>
              <div><dt>Department</dt><dd>{{ user.department || '—' }}</dd></div>
              <div><dt>Registered</dt><dd>{{ user.createdAt | date:'mediumDate' }}</dd></div>
            </dl>
            <p class="unsupported-note">Account status and last login are not provided by the API.</p>
            <div class="dialog-actions"><button type="button" class="secondary-button" (click)="closeDialog()">Close</button><button type="button" class="primary-button" (click)="editUser(user)">Edit user</button></div>
          } @else {
            <form class="edit-form" (ngSubmit)="saveUser()">
              <label>Full name<input name="fullName" [(ngModel)]="draft.fullName" required maxlength="120"></label>
              <label>Phone number<input name="phoneNumber" [(ngModel)]="draft.phoneNumber" required maxlength="40"></label>
              <label>Department<input name="department" [(ngModel)]="draft.department" maxlength="120"></label>
              <label>Role<select name="role" [(ngModel)]="draft.role" required><option [ngValue]="Role.INNOVATOR">Innovator</option><option [ngValue]="Role.ADMIN">Administrator</option></select></label>
              <p class="unsupported-note">Email, account status, suspension, and deletion are not editable through the current API.</p>
              @if (formError()) { <p class="form-error" role="alert">{{ formError() }}</p> }
              <div class="dialog-actions"><button type="button" class="secondary-button" [disabled]="saving()" (click)="closeDialog()">Cancel</button><button type="submit" class="primary-button" [disabled]="saving()">{{ saving() ? 'Saving…' : 'Save changes' }}</button></div>
            </form>
          }
        </section>
      </div>
    }
  `,
  styles: [`
    :host{display:block;color:var(--ink,#172033)}
    .users-page{width:min(1160px,calc(100% - 48px));margin:0 auto;padding:44px 0 72px}
    .page-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:22px}
    .eyebrow{color:var(--green,#3ea945);font-size:10px;font-weight:800;letter-spacing:2px;margin:0 0 10px}
    h1{font:400 clamp(34px,4vw,46px)/1.05 Georgia,serif;color:var(--navy,#262571);margin:0}h1 em{color:var(--green,#3ea945)}
    .intro{color:#7c8492;font-size:13px;margin:8px 0 0}
    .heading-actions{text-align:right;flex:none}.add-button{display:inline-flex;align-items:center;gap:7px;padding:11px 15px;border:0;border-radius:5px;background:var(--blue,#2a4695);color:#fff;font-size:11px;font-weight:700}
    .add-button:disabled{opacity:.62;cursor:not-allowed}.heading-actions p{max-width:200px;margin:6px 0 0;color:#7c8492;font-size:9px;line-height:1.35}
    .summary-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:18px}
    .summary-card{min-height:104px;padding:15px;background:#fff;border:1px solid #e6e8ee;border-radius:8px;display:flex;align-items:flex-start;justify-content:space-between;gap:9px}
    .summary-card small{display:block;color:#727c8d;font-size:10px;font-weight:800;letter-spacing:.45px}.summary-card strong{display:block;margin-top:7px;color:#172033;font-size:23px}
    .summary-card p{margin:5px 0 0;color:#7c8492;font-size:9px}.summary-card strong.unavailable{color:#8993a1;font-size:12px;font-weight:600}
    .summary-icon{width:34px;height:34px;border-radius:8px;display:grid;place-items:center;flex:none}
    .summary-icon.blue{background:#edf3ff;color:#2a4695}.summary-icon.green{background:#eaf7ec;color:#3ea945}.summary-icon.amber{background:#fff6e7;color:#c78620}.summary-icon.red{background:#fff0f0;color:#e6292a}
    .directory-panel{background:#fff;border:1px solid #e6e8ee;border-radius:8px;overflow:hidden}
    .panel-toolbar{min-height:55px;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;gap:12px;border-bottom:1px solid #edf0f4}
    .panel-title{display:flex;align-items:baseline;gap:9px}.panel-title h2{margin:0;color:#172033;font-size:15px}.panel-title>span,.role-summary{color:#7c8492;font-size:10px}.role-summary{white-space:nowrap}.role-summary span{padding:0 4px}
    .filter-toolbar{display:flex;align-items:center;gap:8px;padding:12px 16px;border-bottom:1px solid #edf0f4}
    .search-field,.select-control{height:34px;border:1px solid #dce0e8;border-radius:5px;display:flex;align-items:center;gap:7px;padding:0 9px;background:#fff;color:#788397}
    .search-field{flex:1;min-width:180px;max-width:430px}.search-field input{min-width:0;width:100%;border:0;outline:0;background:transparent;color:#172033;font-size:10px}
    .search-field input::placeholder{color:#8a93a2}.select-control select{max-width:160px;border:0;background:transparent;outline:0;color:#586174;font-size:10px}
    .secondary-button{padding:8px 10px;border:1px solid #dce0e8;border-radius:5px;background:#fff;color:#586174;font-size:10px;font-weight:600}
    .reset-button:disabled{opacity:.5;cursor:default}
    .table-scroll{width:100%;overflow-x:auto}table{width:100%;min-width:900px;border-collapse:collapse;text-align:left}
    th{height:42px;padding:8px 10px;background:#fafbfc;border-bottom:1px solid #e6e8ee;color:#687284;font-size:9px;letter-spacing:.55px;text-transform:uppercase}
    td{height:64px;padding:9px 10px;border-bottom:1px solid #edf0f4;color:#586174;font-size:10px;vertical-align:middle}
    tbody tr:hover{background:#fbfcfe}tbody tr:last-child td{border-bottom:0}.actions-heading{text-align:right;padding-right:16px}
    .user-cell{min-width:190px;display:flex;align-items:center;gap:9px}.avatar{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;overflow:hidden;flex:none;background:#edf3ff;color:var(--blue,#2a4695);font-size:10px;font-weight:800}
    .avatar img{width:100%;height:100%;object-fit:cover}.user-copy{min-width:0}.user-copy strong,.user-copy small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .user-copy strong{color:#262571;font-size:10px}.user-copy small{margin-top:4px;color:#8993a1;font-size:9px}.email-cell{max-width:205px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .role-badge{display:inline-flex;padding:5px 8px;border-radius:12px;background:#eaf7ec;color:#287c32;font-size:9px;font-weight:700;white-space:nowrap}.role-badge.admin{background:#edf3ff;color:#2a4695}
    .date-cell{white-space:nowrap}.row-actions{display:flex;justify-content:flex-end;gap:5px;white-space:nowrap}
    .action-button{height:27px;padding:0 8px;border:1px solid #dce0e8;border-radius:4px;background:#fff;color:#586174;display:inline-flex;align-items:center;gap:5px;font-size:9px}
    .action-button:hover{border-color:#aab8df;color:var(--navy,#262571)}
    .empty-state{min-height:180px;padding:20px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;color:#7c8492}.empty-state>i{font-size:21px;color:#8994a5}.empty-state strong{margin-top:10px;color:#344054;font-size:13px}.empty-state p{margin:5px 0 12px;font-size:10px}
    .pagination{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 16px;border-top:1px solid #edf0f4;color:#7c8492;font-size:10px}
    .page-controls{display:flex;align-items:center;gap:7px}.page-controls label{display:flex;align-items:center;gap:5px}.page-controls select{height:27px;border:1px solid #dce0e8;border-radius:4px;color:#586174;background:white;font-size:10px}
    .page-button{width:27px;height:27px;border:1px solid #dce0e8;border-radius:4px;background:#fff;color:#586174}.page-button:disabled{opacity:.45;cursor:not-allowed}.page-number{min-width:38px;text-align:center;color:#344054}
    .page-message,.feedback{margin-bottom:12px;padding:11px 14px;border:1px solid #dce8dc;border-radius:5px;background:#f5fbf5;color:#26742b;font-size:12px}
    .page-message.error,.feedback.error{border-color:#ead4d4;background:#fff7f7;color:#a51f20}.page-message button,.feedback button{margin-left:9px;border:0;background:transparent;color:inherit;font-size:11px;text-decoration:underline}
    .modal-backdrop{position:fixed;inset:0;z-index:30;background:#17203380;display:grid;place-items:center;padding:20px;overflow:auto}
    .user-dialog{width:min(520px,100%);max-height:90vh;overflow:auto;padding:22px;background:#fff;border:1px solid #e6e8ee;border-radius:8px;box-shadow:0 20px 60px #17203330}
    .dialog-heading{display:flex;justify-content:space-between;gap:12px;margin-bottom:18px}.dialog-heading h2{margin:0;color:var(--navy,#262571);font-size:19px}.dialog-heading .eyebrow{margin-bottom:6px}
    .dialog-close{border:0;background:none;color:#687284;font-size:24px;line-height:1}.detail-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px}
    .detail-grid div{min-width:0;padding:10px;background:#f7f8fb;border-radius:4px}.detail-grid dt{color:#7c8492;font-size:9px;text-transform:uppercase;letter-spacing:.4px}
    .detail-grid dd{margin:5px 0 0;overflow-wrap:anywhere;color:#262571;font-size:11px;font-weight:600}
    .edit-form{display:grid;grid-template-columns:1fr 1fr;gap:12px}.edit-form label{display:grid;gap:5px;color:#586174;font-size:10px}
    .edit-form input,.edit-form select{width:100%;min-height:36px;padding:8px;border:1px solid #dce0e8;border-radius:4px;color:#172033;background:#fff;font:inherit;font-size:11px}
    .unsupported-note{grid-column:1/-1;margin:2px 0;color:#7c8492;font-size:9px;line-height:1.45}.form-error{grid-column:1/-1;margin:0;color:#a51f20;font-size:10px}
    .dialog-actions{grid-column:1/-1;display:flex;justify-content:flex-end;gap:8px;margin-top:5px}.dialog-actions .primary-button{padding:9px 13px;border:0;border-radius:4px;background:var(--blue,#2a4695);color:#fff;font-size:10px;font-weight:700}
    .dialog-actions button:disabled{opacity:.55;cursor:wait}
    .sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
    @media(max-width:850px){.summary-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.panel-toolbar{align-items:flex-start;flex-direction:column}.role-summary{white-space:normal}}
    @media(max-width:600px){.users-page{width:calc(100% - 28px);padding:30px 0 48px}.page-heading{align-items:flex-start;flex-direction:column}.heading-actions{text-align:left}.heading-actions p{max-width:260px}.summary-grid{gap:8px}.summary-card{min-height:94px;padding:12px}.summary-card strong{font-size:20px}.summary-card small{font-size:9px}.summary-card strong.unavailable{font-size:11px}.summary-card p{font-size:8px}.filter-toolbar{align-items:stretch;flex-wrap:wrap;padding:10px}.search-field{width:100%;max-width:none;flex:auto}.select-control{flex:1}.reset-button{flex:none}.pagination{align-items:flex-start;flex-direction:column}.page-controls{width:100%;justify-content:flex-end}.edit-form,.detail-grid{grid-template-columns:1fr}.unsupported-note,.form-error,.dialog-actions{grid-column:auto}.user-dialog{padding:17px}}
  `]
})
export class AdminUsersPageComponent {
  protected readonly Role = Role;
  private readonly service = inject(AdminService);
  protected readonly users = signal<User[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly search = signal('');
  protected readonly roleFilter = signal<UserRoleFilter>('ALL');
  protected readonly page = signal(1);
  protected readonly pageSize = signal(10);
  protected readonly dialogMode = signal<UserDialogMode>(null);
  protected readonly selectedUser = signal<User | null>(null);
  protected readonly saving = signal(false);
  protected readonly formError = signal('');
  protected readonly feedback = signal('');
  protected readonly feedbackIsError = signal(false);
  protected draft: UserDraft = this.emptyDraft();

  protected readonly filteredUsers = computed(() => {
    const query = this.search().trim().toLowerCase();
    const role = this.roleFilter();
    return this.users().filter(user => {
      const matchesSearch = !query || `${user.fullName} ${user.email} ${user.phoneNumber} ${user.identificationId} ${user.role}`.toLowerCase().includes(query);
      return matchesSearch && (role === 'ALL' || user.role === role);
    });
  });
  protected readonly pageCount = computed(() => Math.max(1, Math.ceil(this.filteredUsers().length / this.pageSize())));
  protected readonly pageUsers = computed(() => {
    const start = (this.page() - 1) * this.pageSize();
    return this.filteredUsers().slice(start, start + this.pageSize());
  });
  protected readonly showingStart = computed(() => this.filteredUsers().length ? (this.page() - 1) * this.pageSize() + 1 : 0);
  protected readonly showingEnd = computed(() => Math.min(this.page() * this.pageSize(), this.filteredUsers().length));
  protected readonly adminsCount = computed(() => this.users().filter(user => user.role === Role.ADMIN).length);
  protected readonly innovatorsCount = computed(() => this.users().filter(user => user.role === Role.INNOVATOR).length);

  constructor() {
    this.loadUsers();
  }

  protected loadUsers(): void {
    this.loading.set(true);
    this.error.set(null);
    this.service.users().subscribe({
      next: users => {
        this.users.set(users);
        this.page.set(1);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Unable to load the user directory.');
        this.loading.set(false);
      }
    });
  }

  protected setSearch(value: string): void {
    this.search.set(value);
    this.page.set(1);
  }

  protected setRoleFilter(value: UserRoleFilter): void {
    this.roleFilter.set(value);
    this.page.set(1);
  }

  protected setPage(value: number): void {
    this.page.set(Math.min(this.pageCount(), Math.max(1, value)));
  }

  protected setPageSize(value: number): void {
    this.pageSize.set(Number(value));
    this.page.set(1);
  }

  protected clearFilters(): void {
    this.search.set('');
    this.roleFilter.set('ALL');
    this.page.set(1);
  }

  protected initials(name: string): string {
    return name.trim().split(/\s+/).slice(0, 2).map(part => part.charAt(0)).join('').toUpperCase() || '?';
  }

  protected viewUser(user: User): void {
    this.selectedUser.set(user);
    this.dialogMode.set('view');
  }

  protected editUser(user: User): void {
    this.selectedUser.set(user);
    this.draft = { fullName: user.fullName, phoneNumber: user.phoneNumber, department: user.department ?? '', role: user.role };
    this.formError.set('');
    this.dialogMode.set('edit');
  }

  protected closeDialog(): void {
    if (this.saving()) return;
    this.dialogMode.set(null);
    this.selectedUser.set(null);
    this.formError.set('');
  }

  protected saveUser(): void {
    const user = this.selectedUser();
    if (!user || this.saving()) return;
    this.saving.set(true);
    this.formError.set('');
    this.service.updateUser(user.id, this.draft).subscribe({
      next: updated => {
        this.users.update(users => users.map(entry => entry.id === updated.id ? updated : entry));
        this.feedbackIsError.set(false);
        this.feedback.set(`${updated.fullName}'s details were updated.`);
        this.saving.set(false);
        this.closeDialog();
      },
      error: error => {
        this.formError.set(error?.error?.message ?? 'Unable to save user details. Please try again.');
        this.saving.set(false);
      }
    });
  }

  private emptyDraft(): UserDraft {
    return { fullName: '', phoneNumber: '', department: '', role: Role.INNOVATOR };
  }
}
