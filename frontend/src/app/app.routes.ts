import { Routes } from '@angular/router';
import { AppComponent } from './app.component';
import { authGuard, guestGuard, roleGuard } from './core/guards';
import { Role } from './core/models';
import { AuthPageComponent } from './features/auth-page.component';
import { CataloguePageComponent } from './features/catalogue-page.component';
import { AssetDetailsPageComponent } from './features/asset-details-page.component';
import { ProfilePageComponent } from './features/profile-page.component';
import { WorkspacePageComponent } from './features/workspace-page.component';
import { AdminPageComponent } from './features/admin-page.component';
import { RequestDetailsPageComponent } from './features/request-details-page.component';
import { SimpleWorkspacePageComponent } from './features/simple-workspace-page.component';
import { RequestSubmittedPageComponent } from './features/request-submitted-page.component';
import { RequestCartPageComponent } from './features/request-cart-page.component';
import { RequestHistoryPageComponent } from './features/request-history-page.component';
import { AdminRequestsPageComponent } from './features/admin-requests-page.component';
import { InnovatorDashboardPageComponent } from './features/innovator-dashboard-page.component';
import { AdminDashboardPageComponent } from './features/admin-dashboard-page.component';
import { AdminUsersPageComponent } from './features/admin-users-page.component';
import { AdminInventoryPageComponent } from './features/admin-inventory-page.component';
import { AdminSettingsPageComponent } from './features/admin-settings-page.component';

export const routes: Routes = [
  { path: 'auth/login', component: AuthPageComponent, canActivate: [guestGuard] },
  { path: 'auth/register', component: AuthPageComponent, canActivate: [guestGuard] },
  { path: 'admin/login', component: AuthPageComponent, canActivate: [guestGuard] },
  { path: 'catalogue', component: CataloguePageComponent },
  { path: 'requests', component: AdminRequestsPageComponent, canActivate: [authGuard, roleGuard(Role.ADMIN)] },
  { path: 'assets/:id', component: AssetDetailsPageComponent },
  { path: 'app/dashboard', component: InnovatorDashboardPageComponent, canActivate: [authGuard] },
  { path: 'app/requests', component: RequestHistoryPageComponent, canActivate: [authGuard] },
  { path: 'app/cart', component: RequestCartPageComponent, canActivate: [authGuard] },
  { path: 'app/requests/new', component: RequestCartPageComponent, canActivate: [authGuard] },
  { path: 'app/requests/review', component: WorkspacePageComponent, canActivate: [authGuard] },
  { path: 'app/requests/submitted', component: RequestSubmittedPageComponent, canActivate: [authGuard] },
  { path: 'app/requests/:id', component: RequestDetailsPageComponent, canActivate: [authGuard] },
  { path: 'app/loans', component: RequestHistoryPageComponent, canActivate: [authGuard] },
  { path: 'app/profile', component: ProfilePageComponent, canActivate: [authGuard] },
  { path: 'app/team', component: SimpleWorkspacePageComponent, canActivate: [authGuard] },
  { path: 'app/settings', component: SimpleWorkspacePageComponent, canActivate: [authGuard] },
  { path: 'admin/dashboard', component: AdminDashboardPageComponent, canActivate: [authGuard, roleGuard(Role.ADMIN)] },
  { path: 'admin/requests', component: AdminRequestsPageComponent, canActivate: [authGuard, roleGuard(Role.ADMIN)] },
  { path: 'admin/assets', component: AdminPageComponent, canActivate: [authGuard, roleGuard(Role.ADMIN)] },
  { path: 'admin/inventory', component: AdminInventoryPageComponent, canActivate: [authGuard, roleGuard(Role.ADMIN)] },
  { path: 'admin/users', component: AdminUsersPageComponent, canActivate: [authGuard, roleGuard(Role.ADMIN)] },
  { path: 'admin/audit-log', component: AdminPageComponent, canActivate: [authGuard, roleGuard(Role.ADMIN)] },
  { path: 'admin/settings', component: AdminSettingsPageComponent, canActivate: [authGuard, roleGuard(Role.ADMIN)] },
  { path: '**', redirectTo: '' }
];
