
export class AppComponent {
  protected readonly auth = inject(AuthStore);
  protected readonly router = inject(Router);
  protected readonly menuOpen = signal(false);

  private readonly adminService = inject(AdminService);
  private readonly requestService = inject(RequestService);

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

    effect(() => {
      const user = this.auth.user();
      const url = this.navigationUrl().split('?')[0];

      if (!user) {
        this.dashboardLoading.set(false);
        return;
      }

      if (
        url === '/admin/dashboard' ||
        url === '/app/dashboard'
      ) {
        this.loadDashboard(user.role);
      }
    });
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

  protected readonly assets: Array<{
    name: string;
    tag: string;
    category: AssetCategory;
    available: number;
    total: number;
    accent: string;
    icon: string;
  }> = [];

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

  private loadDashboard(role: Role): void {
    this.dashboardLoading.set(true);
    this.dashboardError.set(null);

    if (role === Role.ADMIN) {
      forkJoin({
        metrics: this.adminService.dashboard(),
        audit: this.adminService.auditLog()
      }).subscribe({
        next: result => {
          this.adminMetrics.set(result.metrics);
          this.auditLogs.set(result.audit);
          this.dashboardLoading.set(false);
        },
        error: () => {
          this.dashboardLoading.set(false);
          this.dashboardError.set(
            'Unable to load the administration dashboard.'
          );
        }
      });

      return;
    }

    this.requestService.listMine().subscribe({
      next: requests => {
        this.innovatorRequests.set(requests);
        this.dashboardLoading.set(false);
      },
      error: () => {
        this.dashboardLoading.set(false);
        this.dashboardError.set(
          'Unable to load your workspace dashboard.'
        );
      }
    });
  }
}
