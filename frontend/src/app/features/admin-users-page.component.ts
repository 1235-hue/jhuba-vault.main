import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../core/api.service';
import { Role, User } from '../core/models';
import { ToastService } from '../core/toast.service';
import { EmptyStateComponent } from '../shared/empty-state.component';
import { ModalComponent } from '../shared/modal.component';
import { PageHeaderComponent } from '../shared/page-header.component';
import { initials as makeInitials } from '../shared/format';

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
  imports: [DatePipe, FormsModule, EmptyStateComponent, ModalComponent, PageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-users-page.component.html',
  styleUrl: './admin-users-page.component.css'
})
export class AdminUsersPageComponent {
  protected readonly Role = Role;
  private readonly service = inject(AdminService);
  private readonly toast = inject(ToastService);
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

  protected readonly initials = (name: string) => makeInitials(name);

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
        this.toast.success(`${updated.fullName}’s details were updated.`, 'User updated');
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
