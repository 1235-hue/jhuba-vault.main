


import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet, NavigationEnd } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs';
import { AssetCategory, AssetRequest, AuditLog, RequestStatus, Role } from './core/models';
import { AdminDashboard } from './core/api.service';
import { AuthStore } from './state/auth.store';
import { AssetStore } from './state/asset.store';
import { BrandLogoComponent } from './shared/brand-logo.component';

@Component({
  selector: 'jhub-root',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet, BrandLogoComponent],
  host: { '[class.landing-route]': 'isHome()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="topbar">
      <a class="brand" routerLink="/" aria-label="JHUB Africa Vault home"><jhub-brand-logo logo="jhub-africa" variant="header"></jhub-brand-logo><span><strong>AFRICA VAULT</strong><small>ASSET TRACKING</small></span></a>
      <button class="menu-toggle" type="button" aria-label="Toggle navigation" [attr.aria-expanded]="menuOpen()" (click)="menuOpen.update(open => !open)">☰</button>
      <nav class="desktop-nav" [class.mobile-open]="menuOpen()" aria-label="Primary navigation" (click)="menuOpen.set(false)">@if (auth.user()?.role === Role.ADMIN) {<a routerLink="/admin/dashboard" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">Dashboard</a><a routerLink="/admin/requests" routerLinkActive="active">Requests</a><a routerLink="/admin/assets" routerLinkActive="active">Assets</a><a routerLink="/admin/inventory" routerLinkActive="active">Inventory</a><a routerLink="/admin/users" routerLinkActive="active">Users</a><a routerLink="/admin/audit-log" routerLinkActive="active">Audit Log</a><a routerLink="/admin/settings" routerLinkActive="active">Settings</a>} @else if (auth.user()) {<a routerLink="/app/dashboard" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">Dashboard</a><a routerLink="/catalogue" routerLinkActive="active">Catalogue</a><a routerLink="/app/requests" routerLinkActive="active">My Requests</a><a routerLink="/app/loans" routerLinkActive="active">Active Loans</a>} @else {<a routerLink="/catalogue" routerLinkActive="active">Catalogue</a><a href="#how-it-works">How it works</a><a href="#categories">Categories</a>}</nav>
      <div class="nav-actions">
        @if (auth.user()) { <a class="user-chip" [routerLink]="auth.isAdmin() ? '/admin/dashboard' : '/app/dashboard'">{{ auth.user()?.fullName }}</a><button class="text-button" type="button" (click)="auth.signOut()">Sign out</button> }
        @else { <a class="text-button" routerLink="/auth/login">Sign in</a><a class="primary-button compact" routerLink="/auth/register">Create account</a> }
      </div>
    </header>

    @if (isHome()) {
      <main>
        <section class="hero page-width"><div class="hero-copy"><p class="eyebrow">JHUB AFRICA / ASSET VAULT</p><h1>Build what matters.<br><em>Borrow the tools.</em></h1><p class="hero-lede">A clear, accountable way for JHUB innovators to discover, request, and track the physical assets that turn promising ideas into working prototypes.</p><div class="hero-actions"><a class="primary-button" routerLink="/catalogue">Browse assets <span>→</span></a><a class="secondary-button" routerLink="/auth/register">Join the innovator network</a></div><div class="hero-note"><span class="live-dot"></span><span>{{ assetStore.loading() ? 'Loading live inventory…' : assetStore.error() ? 'Live inventory unavailable' : 'Live inventory · IoT, computing, AV and more' }}</span></div></div><div class="hero-art" aria-label="Abstract illustration of connected assets"><div class="art-grid"></div>@if (featuredAsset(); as asset) {<div class="art-card art-card-main"><span class="art-icon">⌁</span><strong>{{ asset.name }}</strong><small>{{ asset.assetTag }}</small><div class="availability"><span></span> {{ asset.availableQty }} available</div></div>}<div class="art-card art-card-small"><span class="mini-number">{{ categoryTotal() }}</span><small>asset categories</small></div><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div></div></section>
        <section class="stats-strip"><div class="page-width stats"><div><strong>01</strong><span>Discover what is available</span></div><div><strong>02</strong><span>Request for your project</span></div><div><strong>03</strong><span>Track it from pickup to return</span></div></div></section>
        <section class="section page-width" id="categories"><div class="section-heading"><div><p class="eyebrow">THE VAULT, AT A GLANCE</p><h2>Everything to move<br>from idea to <em>impact.</em></h2></div><a class="arrow-link" routerLink="/catalogue">View all assets <span>↗</span></a></div><div class="category-grid">@for (category of categories; track category.label) {<a class="category-card" routerLink="/catalogue"><span class="category-icon">{{ category.icon }}</span><div><strong>{{ category.label }}</strong><small>{{ categoryCount(category.value) }} assets available</small></div><span class="card-arrow">↗</span></a>}</div></section>
        <section class="process-band" id="how-it-works"><div class="page-width process-content"><div><p class="eyebrow light">DESIGNED FOR ACCOUNTABILITY</p><h2>Simple to borrow.<br><em>Easy to trust.</em></h2></div><div class="process-list"><div><span>01</span><p><strong>Find your components</strong><small>Browse live inventory by category, availability, or asset tag.</small></p></div><div><span>02</span><p><strong>Make a project request</strong><small>Tell us what you are building, who is involved, and how long you need it.</small></p></div><div><span>03</span><p><strong>Stay in control</strong><small>Every handover, due date, and return lives in one transparent record.</small></p></div></div></div></section>
        <section class="cta-band page-width"><div><p class="eyebrow">YOUR NEXT PROTOTYPE STARTS HERE</p><h2>What will you make<br>with the <em>Vault?</em></h2></div><a class="primary-button light-button" routerLink="/catalogue">Explore the catalogue <span>→</span></a></section>
      </main>
    } @else if (isCatalogue()) { <main class="page-width catalogue-page"><div class="catalogue-intro"><div><p class="eyebrow">PUBLIC CATALOGUE</p><h1>Tools for the <em>work ahead.</em></h1><p>Explore the physical assets available to JHUB Africa innovators.</p></div><div class="search-box"><span>⌕</span><input aria-label="Search assets" placeholder="Search by name, tag or specification"></div></div><div class="filter-row"><button class="filter-active">All assets</button><button>IoT & prototyping</button><button>Computing</button><button>Networking</button><button>AV & presentation</button></div><div class="asset-grid">@for (asset of assets(); track asset.tag) {<article class="asset-card"><div class="asset-visual" [style.--accent]="asset.accent"><span>{{ asset.icon }}</span><small>{{ asset.category.replace('_', ' ') }}</small></div><div class="asset-info"><div><p class="asset-tag">{{ asset.tag }}</p><h3>{{ asset.name }}</h3></div><div class="asset-meta"><span class="stock"><i></i>{{ asset.available }} available</span><span>Tracked asset</span></div><a class="asset-link" [routerLink]="['/assets', asset.id]">View details <span>↗</span></a></div></article>}</div></main> }
    @else if (isAuth()) { <main class="auth-page"><div class="auth-panel"><p class="eyebrow">JHUB AFRICA VAULT</p><h1>{{ isRegister() ? 'Make room for your next idea.' : 'Welcome back, innovator.' }}</h1><p>{{ isRegister() ? 'Create your innovator account to request and track JHUB assets.' : 'Sign in to manage your requests, loans, and profile.' }}</p><form (submit)="$event.preventDefault(); auth.signIn(isAdminLogin() ? Role.ADMIN : Role.INNOVATOR)"><label>Email address<input type="email" required placeholder="you@example.com"></label><label>Password<input type="password" required placeholder="Enter your password"></label>@if (isRegister()) {<label>Full name<input type="text" required placeholder="Your full name"></label>}<button class="primary-button submit-button" type="submit">{{ isRegister() ? 'Create innovator account' : 'Sign in' }} <span>→</span></button></form><p class="form-foot">Demo entry is wired to the typed auth store. Backend authentication connects at the service boundary.</p></div><div class="auth-aside"><span class="aside-mark">J</span><h2>Good tools make<br><em>bold work</em> possible.</h2></div></main> }
    @else if (isAdmin()) { <main class="dashboard page-width"><div class="dashboard-head"><div><p class="eyebrow">ADMINISTRATION / OVERVIEW</p><h1>Good morning, <em>administrator.</em></h1></div><a class="primary-button" routerLink="/admin/requests">Review requests <span>→</span></a></div>@if (dashboardLoading()) { <div class="dashboard-state">Loading dashboard metrics…</div> } @else if (dashboardError()) { <div class="dashboard-state error" role="alert">{{ dashboardError() }}</div> } @else if (adminMetrics(); as metrics) { <div class="metric-grid"><div class="metric-card accent-blue"><small>PENDING REQUESTS</small><strong>{{ metrics.pendingRequests }}</strong><span>Awaiting review</span></div><div class="metric-card accent-green"><small>AVAILABLE INVENTORY</small><strong>{{ metrics.availableInventory }}</strong><span>Available units</span></div><div class="metric-card accent-red"><small>OVERDUE LOANS</small><strong>{{ metrics.overdueRequests }}</strong><span>Needs attention</span></div><div class="metric-card"><small>USERS</small><strong>{{ metrics.users }}</strong><span>Registered accounts</span></div><div class="metric-card"><small>TOTAL ASSETS</small><strong>{{ metrics.totalAssets }}</strong><span>Tracked records</span></div><div class="metric-card"><small>ASSETS ON LOAN</small><strong>{{ metrics.checkedOutRequests }}</strong><span>Checked out requests</span></div></div><div class="dashboard-lower"><section class="dashboard-section"><div class="section-heading compact-heading"><div><p class="eyebrow">RECENT ACTIVITY</p><h2>Audit log</h2></div><a class="arrow-link" routerLink="/admin/audit-log">See all ↗</a></div>@if (auditLogs().length) { @for (log of auditLogs().slice(0, 3); track log.id) {<div class="request-row"><span class="request-avatar">{{ log.actor?.fullName?.slice(0, 2)?.toUpperCase() || 'SY' }}</span><div><strong>{{ log.action }}</strong><small>{{ log.actor?.fullName || 'System' }} · {{ log.entityType }}</small></div><span class="status approved">LOGGED</span></div>} } @else { <div class="dashboard-state">No audit activity recorded yet.</div> }</section><section class="quick-panel"><p class="eyebrow">QUICK ACCESS</p><a routerLink="/admin/assets"><span>▦</span>Manage assets <b>↗</b></a><a routerLink="/admin/inventory"><span>◫</span>View inventory <b>↗</b></a><a routerLink="/admin/users"><span>◎</span>Innovator directory <b>↗</b></a></section></div> }</main> }
    @else if (isDashboardShell()) { <main class="dashboard page-width"><div class="dashboard-head"><div><p class="eyebrow">INNOVATOR WORKSPACE</p><h1>Your ideas, <em>in motion.</em></h1><p>Welcome back. Here is the pulse of your JHUB activity.</p></div><a class="primary-button" routerLink="/catalogue">Find assets <span>→</span></a></div>@if (dashboardLoading()) { <div class="dashboard-state">Loading dashboard metrics…</div> } @else if (dashboardError()) { <div class="dashboard-state error" role="alert">{{ dashboardError() }}</div> } @else { <div class="metric-grid"><div class="metric-card accent-blue"><small>ACTIVE REQUESTS</small><strong>{{ activeRequestCount() }}</strong><span>Pending or approved</span></div><div class="metric-card accent-green"><small>ACTIVE LOANS</small><strong>{{ activeLoanCount() }}</strong><span>Checked out or overdue</span></div><div class="metric-card"><small>RETURNED ASSETS</small><strong>{{ returnedRequestCount() }}</strong><span>Returned requests</span></div></div><section class="welcome-panel"><div><p class="eyebrow">KEEP BUILDING</p><h2>Have a new project<br>in mind?</h2><p>Find the components your team needs and start a request in a few minutes.</p><a class="arrow-link" routerLink="/catalogue">Browse the Vault ↗</a></div><span class="welcome-symbol">+</span></section> }</main> }
    @else { <main class="routed-page"></main> }
    <router-outlet></router-outlet>
  `,
  styles: [`
    :host { display:block; }
    :host(:not(.landing-route)) > main { display:none; }
    .page-width { width:min(1160px,calc(100% - 48px)); margin-inline:auto; }
    .eyebrow { margin:0 0 16px; color:var(--green); font-size:10px; font-weight:800; letter-spacing:2px; }
    .hero { display:grid; grid-template-columns:minmax(0,1.1fr) minmax(320px,.9fr); align-items:center; gap:clamp(36px,7vw,100px); min-height:540px; padding-top:64px; padding-bottom:64px; }
    .hero-copy h1 { margin:0; color:var(--navy); font:400 clamp(44px,6vw,72px)/1.03 var(--font-display); letter-spacing:-1.8px; }
    .hero-copy h1 em,.section-heading h2 em,.process-content h2 em,.cta-band h2 em { color:var(--green); font-weight:400; }
    .hero-lede { max-width:560px; margin:22px 0 0; color:var(--muted); font-size:15px; line-height:1.75; }
    .hero-actions { display:flex; flex-wrap:wrap; align-items:center; gap:12px; margin-top:28px; }
    .hero-actions .primary-button,.hero-actions .secondary-button,.cta-band .primary-button { min-height:44px; display:inline-flex; align-items:center; justify-content:center; gap:12px; padding:0 18px; border:1px solid var(--blue); border-radius:5px; font-size:12px; font-weight:700; text-decoration:none; transition:background-color .15s ease,border-color .15s ease,box-shadow .15s ease; }
    .hero-actions .primary-button,.cta-band .primary-button { background:var(--blue); color:#fff; }
    .hero-actions .primary-button:hover,.cta-band .primary-button:hover { border-color:var(--navy); background:var(--navy); box-shadow:0 4px 12px #26257124; }
    .hero-actions .secondary-button { border-color:#dce0e8; background:#fff; color:var(--navy); }
    .hero-actions .secondary-button:hover { border-color:#aab8df; background:#f8faff; }
    .hero-note { display:flex; align-items:center; gap:9px; margin-top:25px; color:var(--muted); font-size:11px; }
    .live-dot,.availability span { width:8px; height:8px; flex:none; border-radius:50%; background:var(--green); box-shadow:0 0 0 4px #3ea94518; }
    .hero-art { position:relative; display:grid; min-height:350px; place-items:center; overflow:hidden; border:1px solid #e4e9f3; border-radius:14px; background:radial-gradient(ellipse at 50% 45%,#e9efff 0,#f6f7ff 58%,#f6f7ff 100%); }
    .art-grid { position:absolute; inset:0; opacity:.32; background-image:linear-gradient(#d7deed 1px,transparent 1px),linear-gradient(90deg,#d7deed 1px,transparent 1px); background-size:34px 34px; mask-image:radial-gradient(ellipse at center,#000 10%,transparent 75%); }
    .art-card { position:absolute; z-index:2; display:flex; flex-direction:column; border:1px solid #e6e8ee; border-radius:8px; background:#fff; box-shadow:0 16px 40px #17203316; }
    .art-card-main { top:27%; left:16%; width:min(270px,68%); padding:22px; }
    .art-icon { display:grid; width:40px; height:40px; place-items:center; margin-bottom:16px; border-radius:8px; background:#edf1ff; color:var(--blue); font-size:24px; }
    .art-card-main strong { color:var(--navy); font:20px var(--font-display); }
    .art-card-main small,.art-card-small small { margin-top:5px; color:#7c8492; font-size:10px; }
    .availability { display:flex; align-items:center; gap:8px; margin-top:17px; padding-top:13px; border-top:1px solid #edf0f4; color:var(--success); font-size:10px; }
    .availability span { width:7px; height:7px; box-shadow:none; }
    .art-card-small { right:8%; bottom:16%; padding:15px 18px; }
    .mini-number { color:var(--navy); font:30px var(--font-display); }
    .orbit { position:absolute; width:250px; height:250px; border:1px solid #bfcbe6; border-radius:50%; }
    .orbit-one { transform:rotate(35deg) scaleX(1.55); }
    .orbit-two { transform:rotate(-35deg) scaleX(1.55); }
    .stats-strip { border-block:1px solid #e5eaf1; background:#fff; }
    .stats { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); }
    .stats > div { display:flex; align-items:center; gap:14px; min-height:86px; padding:15px 24px; border-right:1px solid #edf0f4; color:var(--muted); font-size:12px; }
    .stats > div:first-child { padding-left:0; }
    .stats > div:last-child { border:0; }
    .stats strong { color:var(--green); font:24px var(--font-display); }
    .section { padding-top:78px; padding-bottom:84px; }
    .section-heading { display:flex; align-items:end; justify-content:space-between; gap:24px; margin-bottom:28px; }
    .section-heading h2,.process-content h2,.cta-band h2 { margin:0; color:var(--navy); font:400 clamp(32px,4vw,46px)/1.08 var(--font-display); }
    .section-heading .eyebrow { margin-bottom:12px; }
    .arrow-link { color:var(--blue); font-size:12px; font-weight:700; white-space:nowrap; }
    .category-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:14px; }
    .category-card { display:grid; grid-template-columns:auto minmax(0,1fr) auto; align-items:center; gap:14px; min-height:94px; padding:18px; border:1px solid var(--border); border-radius:var(--radius-card); background:var(--surface); box-shadow:var(--shadow-card); transition:border-color .15s ease,box-shadow .15s ease,transform .15s ease; }
    .category-card:hover { transform:translateY(-2px); border-color:#cbd4e6; box-shadow:0 8px 22px #17203312; }
    .category-icon { display:grid; width:42px; height:42px; place-items:center; border-radius:8px; background:#eff2ff; color:var(--blue); font-size:22px; }
    .category-card > div { min-width:0; }
    .category-card strong,.category-card small { display:block; }
    .category-card strong { color:var(--navy); font-size:13px; }
    .category-card small { margin-top:5px; color:#7c8492; font-size:10px; }
    .card-arrow { color:var(--blue); font-size:15px; }
    .process-band { padding:70px 0; background:var(--navy); color:#fff; }
    .process-content { display:grid; grid-template-columns:.8fr 1.2fr; gap:clamp(35px,8vw,100px); align-items:start; }
    .process-content .eyebrow.light { color:#9bd37d; }
    .process-content h2 { color:#fff; }
    .process-list > div { display:grid; grid-template-columns:42px minmax(0,1fr); gap:14px; padding:14px 0; border-bottom:1px solid #ffffff25; }
    .process-list > div:first-child { padding-top:0; }
    .process-list > div:last-child { border:0; padding-bottom:0; }
    .process-list > div > span { color:#9bd37d; font:20px var(--font-display); }
    .process-list p { margin:0; }
    .process-list strong,.process-list small { display:block; }
    .process-list strong { font-size:13px; }
    .process-list small { margin-top:5px; color:#d4d7e7; font-size:11px; line-height:1.6; }
    .cta-band { display:flex; align-items:center; justify-content:space-between; gap:30px; margin-top:64px; margin-bottom:70px; padding:34px 40px; border:1px solid #e3e8f2; border-radius:10px; background:#fff; box-shadow:var(--shadow-card); }
    .cta-band .eyebrow { margin-bottom:12px; }
    .cta-band h2 { font-size:clamp(30px,3.5vw,40px); }
    .routed-page { display:none; }
    .topbar { position:sticky; top:0; z-index:20; min-height:76px; display:flex; align-items:center; justify-content:space-between; gap:22px; padding:0 clamp(20px,3vw,48px); background:#fff; border-bottom:1px solid #e5eaf1; }
    .brand { flex:none; display:flex; align-items:center; gap:6px; color:#262571; text-decoration:none; }
    .brand jhub-brand-logo { width:132px; height:64px; flex:none; }
    .brand span { display:grid; gap:2px; }
    .brand strong { color:#262571; font-size:11px; letter-spacing:.6px; white-space:nowrap; }
    .brand small { color:#65738a; font-size:7px; letter-spacing:1px; white-space:nowrap; }
    .desktop-nav { flex:1; display:flex; justify-content:center; align-items:center; gap:clamp(10px,1.6vw,26px); }
    .desktop-nav a { padding:10px 1px; color:#54647b; font-size:13px; text-decoration:none; white-space:nowrap; }
    .desktop-nav a:hover,.desktop-nav a.active { color:#262571; }
    .desktop-nav a.active { font-weight:700; box-shadow:inset 0 -2px #2a4695; }
    .nav-actions { flex:none; display:flex; align-items:center; gap:16px; }
    .user-chip { max-width:180px; overflow:hidden; color:#263850; font-size:12px; font-weight:600; text-decoration:none; text-overflow:ellipsis; white-space:nowrap; }
    .text-button { border:0; background:transparent; color:#2a4695; font-size:12px; font-weight:600; text-decoration:none; white-space:nowrap; }
    .primary-button.compact { padding:9px 12px; border-radius:4px; background:#262571; color:#fff; font-size:11px; text-decoration:none; }
    .menu-toggle { display:none; }
    @media (max-width:900px) {
      .topbar { min-height:68px; gap:12px; padding:0 18px; }
      .hero { grid-template-columns:minmax(0,1fr) minmax(280px,.8fr); gap:30px; }
      .hero-art { min-height:310px; }
      .category-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
      .brand jhub-brand-logo { width:112px; height:54px; }
      .menu-toggle { display:block; margin-left:auto; border:1px solid #dce0e8; border-radius:4px; background:#fff; color:#262571; padding:7px 10px; }
      .desktop-nav { display:none; }
      .desktop-nav.mobile-open { position:absolute; top:100%; left:0; right:0; display:flex; align-items:stretch; flex-direction:column; gap:0; padding:8px 18px; background:#fff; border-bottom:1px solid #e6e8ee; box-shadow:0 10px 18px #17203318; }
      .desktop-nav.mobile-open a { padding:12px 8px; border-bottom:1px solid #edf0f4; }
    }
    @media (max-width:480px) {
      .topbar { gap:8px; padding:0 12px; }
      .page-width { width:calc(100% - 32px); }
      .hero { grid-template-columns:minmax(0,1fr); gap:30px; min-height:auto; padding-top:48px; padding-bottom:42px; }
      .hero-copy h1 { font-size:clamp(42px,12vw,56px); }
      .hero-lede { font-size:13px; }
      .hero-art { min-height:280px; }
      .stats { grid-template-columns:minmax(0,1fr); padding-block:8px; }
      .stats > div,.stats > div:first-child { min-height:55px; padding:10px 0; border-right:0; border-bottom:1px solid #edf0f4; }
      .stats > div:last-child { border:0; }
      .section { padding-top:54px; padding-bottom:60px; }
      .section-heading { align-items:start; flex-direction:column; gap:12px; }
      .category-grid { grid-template-columns:minmax(0,1fr); }
      .process-band { padding:48px 0; }
      .process-content { grid-template-columns:minmax(0,1fr); gap:26px; }
      .cta-band { align-items:flex-start; flex-direction:column; margin-top:38px; margin-bottom:42px; padding:26px 22px; }
      .brand { gap:5px; }
      .brand jhub-brand-logo { width:100px; height:49px; }
      .brand strong { font-size:9px; }
      .brand small { font-size:6px; }
      .nav-actions { gap:8px; }
      .user-chip { max-width:100px; font-size:10px; }
      .text-button { font-size:10px; }
    }
    @media (max-width:380px) {
      .brand { gap:4px; }
      .brand jhub-brand-logo { width:88px; height:43px; }
      .brand strong { font-size:8px; }
      .brand small { font-size:6px; }
      .user-chip { max-width:78px; }
      .nav-actions { gap:4px; }
      .primary-button.compact { padding:6px 7px; font-size:9px; }
      .menu-toggle { padding:5px 7px; }
    }
  `]
})

export class AppComponent {
  protected readonly auth = inject(AuthStore);
  protected readonly router = inject(Router);
  protected readonly menuOpen = signal(false);

  protected readonly assetStore = inject(AssetStore);
  protected readonly dashboardLoading = signal(false);
  protected readonly dashboardError = signal<string | null>(null);
  protected readonly adminMetrics = signal<AdminDashboard | null>(null);
  protected readonly auditLogs = signal<AuditLog[]>([]);
  protected readonly innovatorRequests = signal<AssetRequest[]>([]);

  protected readonly Role = Role;

  private readonly navigationUrl = toSignal(
    this.router.events.pipe(

      filter(
        (event): event is NavigationEnd =>
          event instanceof NavigationEnd
      ),
      map(event => event.urlAfterRedirects),
      startWith(this.router.url)
    ),
    { initialValue: this.router.url }
  );

  constructor() {
    this.auth.hydrate().subscribe();
    this.assetStore.load();
  }

  protected readonly isHome = computed(() => {

    const url = this.navigationUrl().split('?')[0];
    return url === '/' || url === '/landing';
  });

  protected readonly isCatalogue = computed(() => {
    const url = this.navigationUrl()
      .split('?')[0]
      .replace(/\/$/, '');

    return url === '/catalogue';
  });

  protected readonly isAuth = computed(() => {
    const url = this.navigationUrl().split('?')[0];

    return (
      url.startsWith('/auth/') ||
      url === '/admin/login'
    );
  });

  protected readonly isRegister = computed(() =>
    this.navigationUrl().split('?')[0] === '/auth/register'
  );

  protected readonly isAdminLogin = computed(() =>
    this.navigationUrl().split('?')[0] === '/admin/login'
  );

  protected readonly isAdmin = computed(() => {
    const url = this.navigationUrl().split('?')[0];

    return (
      url.startsWith('/admin/') &&
      url !== '/admin/login'
    );
  });

  protected readonly isAdminRequests = computed(() => {
    const url = this.navigationUrl().split('?')[0];

    return (
      url === '/admin/requests' ||
      url === '/requests'
    );
  });

  protected readonly isDashboardShell = computed(() =>
    this.navigationUrl().split('?')[0] === '/app/dashboard'
  );

  protected readonly categories = [
    {
      label: 'IoT & Prototyping',
      value: AssetCategory.IOT_PROTOTYPING,
      icon: '⌁'
    },
    {
      label: 'Computing Peripherals',
      value: AssetCategory.COMPUTING_PERIPHERALS,
      icon: '▣'
    },
    {
      label: 'Networking Infrastructure',
      value: AssetCategory.NETWORKING_INFRASTRUCTURE,
      icon: '⌘'
    },
    {
      label: 'AV & Presentation',
      value: AssetCategory.AV_PRESENTATION,
      icon: '◉'
    },
    {
      label: 'Office Supplies',
      value: AssetCategory.OFFICE_SUPPLIES,
      icon: '▤'
    },
    {
      label: 'Furniture',
      value: AssetCategory.FURNITURE,
      icon: '⌂'
    },
    {
      label: 'Software',
      value: AssetCategory.SOFTWARE,
      icon: '▧'
    }
  ];

  protected readonly featuredAsset = computed(() =>
    this.assetStore.assets()[0]
  );

  protected readonly categoryTotal = computed(() =>
    new Set(
      this.assetStore.assets().map(asset => asset.category)
    ).size
  );

  protected readonly assets = computed(() => this.assetStore.assets().map(asset => ({
    id: asset.id,
    name: asset.name,
    tag: asset.assetTag,
    category: asset.category,
    available: asset.availableQty,
    total: asset.totalQuantity,
    accent: asset.category === AssetCategory.IOT_PROTOTYPING ? '#3ea945' : asset.category === AssetCategory.NETWORKING_INFRASTRUCTURE ? '#e6292a' : '#2a4695',
    icon: asset.category === AssetCategory.IOT_PROTOTYPING ? '⌁' : asset.category === AssetCategory.COMPUTING_PERIPHERALS ? '▣' : asset.category === AssetCategory.NETWORKING_INFRASTRUCTURE ? '⌘' : asset.category === AssetCategory.AV_PRESENTATION ? '◉' : asset.category === AssetCategory.OFFICE_SUPPLIES ? '▤' : '⌂'
  })));

  protected readonly activeRequestCount = computed(() =>
    this.innovatorRequests().filter(
      request =>
        request.status === RequestStatus.PENDING ||
        request.status === RequestStatus.APPROVED
    ).length
  );

  protected readonly activeLoanCount = computed(() =>
    this.innovatorRequests().filter(
      request =>
        request.status === RequestStatus.CHECKED_OUT ||
        request.status === RequestStatus.OVERDUE
    ).length
  );

  protected readonly returnedRequestCount = computed(() =>
    this.innovatorRequests().filter(
      request => request.status === RequestStatus.RETURNED
    ).length
  );

  protected categoryCount(category: AssetCategory): number {
    return this.assetStore.assets().filter(
      asset => asset.category === category
    ).length;
  }

}
