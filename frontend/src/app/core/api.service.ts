import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs';
import { Asset, AssetCategory, AssetRequest, AuditLog, RequestStatus, TeamMember, User } from './models';

const API_URL = '/api';
interface ApiResponse<T> { success: boolean; data: T; }
export interface AuthCredentials { email: string; password: string; }
export interface RegistrationData extends AuthCredentials { fullName: string; phoneNumber: string; identificationId: string; department?: string; }
export interface AuthResponse { user: User; token: string; }
export interface AdminRequestCounts extends Record<RequestStatus, number> { total: number; }
export interface AdminRequestPage { items: AssetRequest[]; page: number; limit: number; total: number; totalPages: number; statusCounts?: AdminRequestCounts; }

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  login(credentials: AuthCredentials): Observable<AuthResponse> { return this.http.post<ApiResponse<AuthResponse>>(`${API_URL}/auth/login`, credentials).pipe(map(response => response.data)); }
  register(data: RegistrationData): Observable<AuthResponse> { return this.http.post<ApiResponse<AuthResponse>>(`${API_URL}/auth/register`, data).pipe(map(response => response.data)); }
  me(): Observable<User> { return this.http.get<ApiResponse<User>>(`${API_URL}/auth/me`).pipe(map(response => response.data)); }
}

@Injectable({ providedIn: 'root' })
export class AssetService {
  private readonly http = inject(HttpClient);
  list(filters?: { search?: string; category?: AssetCategory; availability?: string }): Observable<Asset[]> {
    let params = new HttpParams();
    if (filters?.search) params = params.set('search', filters.search);
    if (filters?.category) params = params.set('category', filters.category);
    if (filters?.availability) params = params.set('availability', filters.availability);
    return this.http.get<ApiResponse<Asset[]>>(`${API_URL}/assets`, { params }).pipe(map(response => response.data));
  }
  getById(id: string): Observable<Asset> { return this.http.get<ApiResponse<Asset>>(`${API_URL}/assets/${id}`).pipe(map(response => response.data)); }
  create(asset: Omit<Asset, 'id' | 'createdAt' | 'updatedAt' | 'imagePublicId'>): Observable<Asset> { return this.http.post<ApiResponse<Asset>>(`${API_URL}/assets`, asset).pipe(map(response => response.data)); }
  update(id: string, asset: Partial<Omit<Asset, 'id' | 'createdAt' | 'updatedAt' | 'imagePublicId'>>): Observable<Asset> { return this.http.patch<ApiResponse<Asset>>(`${API_URL}/assets/${id}`, asset).pipe(map(response => response.data)); }
  remove(id: string): Observable<void> { return this.http.delete<void>(`${API_URL}/assets/${id}`); }
}

@Injectable({ providedIn: 'root' })
export class RequestService {
  private readonly http = inject(HttpClient);
  listMine(): Observable<AssetRequest[]> { return this.http.get<ApiResponse<{ items: AssetRequest[] }>>(`${API_URL}/requests`).pipe(map(response => response.data.items)); }
  getById(id: string): Observable<AssetRequest> { return this.http.get<ApiResponse<AssetRequest>>(`${API_URL}/requests/${id}`).pipe(map(response => response.data)); }
  create(request: { projectName: string; projectAbstract: string; loanDays: number; startDate: string; items: Array<{ assetId: string; quantity: number }>; teamMembers: Array<Omit<TeamMember, 'id' | 'requestId' | 'name' | 'role'>> }): Observable<AssetRequest> { return this.http.post<ApiResponse<AssetRequest>>(`${API_URL}/requests`, request).pipe(map(response => response.data)); }
  update(id: string, request: Partial<AssetRequest>): Observable<AssetRequest> { return this.http.patch<ApiResponse<AssetRequest>>(`${API_URL}/requests/${id}`, request).pipe(map(response => response.data)); }
  approve(id: string): Observable<AssetRequest> { return this.http.patch<ApiResponse<AssetRequest>>(`${API_URL}/admin/requests/${id}/approve`, {}).pipe(map(response => response.data)); }
  reject(id: string, rejectionReason: string): Observable<AssetRequest> { return this.http.patch<ApiResponse<AssetRequest>>(`${API_URL}/admin/requests/${id}/reject`, { rejectionReason }).pipe(map(response => response.data)); }
  checkout(id: string): Observable<AssetRequest> { return this.http.patch<ApiResponse<AssetRequest>>(`${API_URL}/admin/requests/${id}/checkout`, {}).pipe(map(response => response.data)); }
  returnAsset(id: string): Observable<AssetRequest> { return this.http.patch<ApiResponse<AssetRequest>>(`${API_URL}/admin/requests/${id}/return`, {}).pipe(map(response => response.data)); }
  listAdmin(filters?: { search?: string; status?: string }): Observable<AssetRequest[]> { return this.listAdminPage(filters).pipe(map(response => response.items)); }
  listAdminPage(filters?: { search?: string; status?: string; page?: number; limit?: number; dateFrom?: string; dateTo?: string }): Observable<AdminRequestPage> {
    let params = new HttpParams();
    if (filters?.search) params = params.set('search', filters.search);
    if (filters?.status) params = params.set('status', filters.status);
    if (filters?.page) params = params.set('page', filters.page);
    if (filters?.limit) params = params.set('limit', filters.limit);
    if (filters?.dateFrom) params = params.set('dateFrom', filters.dateFrom);
    if (filters?.dateTo) params = params.set('dateTo', filters.dateTo);
    return this.http.get<ApiResponse<AdminRequestPage>>(`${API_URL}/admin/requests`, { params }).pipe(map(response => response.data));
  }
}

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly http = inject(HttpClient);
  getMine(): Observable<User> { return this.http.get<ApiResponse<User>>(`${API_URL}/users/me`).pipe(map(response => response.data)); }
  updateMine(profile: Partial<User>): Observable<User> { return this.http.patch<ApiResponse<User>>(`${API_URL}/users/me`, profile).pipe(map(response => response.data)); }
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly http = inject(HttpClient);
  dashboard(): Observable<AdminDashboard> { return this.http.get<ApiResponse<AdminDashboard>>(`${API_URL}/admin/dashboard`).pipe(map(response => response.data)); }
  search(query: string): Observable<AdminSearchResult[]> { return this.http.get<ApiResponse<AdminSearchResult[]>>(`${API_URL}/admin/search`, { params: { q: query } }).pipe(map(response => response.data)); }
  users(): Observable<User[]> { return this.http.get<ApiResponse<User[]>>(`${API_URL}/admin/users`).pipe(map(response => response.data)); }
  inventory(): Observable<Asset[]> { return this.http.get<ApiResponse<Asset[]>>(`${API_URL}/admin/inventory`).pipe(map(response => response.data)); }
  auditLog(): Observable<AuditLog[]> { return this.http.get<ApiResponse<AuditLog[]>>(`${API_URL}/admin/audit`).pipe(map(response => response.data)); }
}

export interface AdminDashboard {
  totalAssets: number;
  availableInventory: number;
  checkedOutInventory: number;
  pendingRequests: number;
  approvedRequests: number;
  checkedOutRequests: number;
  returnedRequests: number;
  overdueRequests: number;
  users: number;
  categoryDistribution: Array<{ category: AssetCategory; quantity: number }>;
  requestActivity: Array<{ month: string; pending: number; approved: number; rejected: number }>;
  recentRequests: AssetRequest[];
  recentActivity: AuditLog[];
}
export interface AdminSearchResult { type: 'asset' | 'request' | 'user'; id: string; label: string; detail: string; href: string; }
