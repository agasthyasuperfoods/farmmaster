'use client';

import { ReactNode, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard, 
  Warehouse, 
  Tag, 
  Users, 
  ShieldCheck,
  Building2,
  Beef as CattleIcon,
  LogOut,
  Menu,
  X,
  ChevronRight,
  ChevronDown,
  Tractor,
  Map,
  Snowflake
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  installAuthFetchInterceptor,
  isTokenExpired,
  logoutAndRedirect,
} from '@/src/utils/clientAuth';

const TOKEN_CHECK_INTERVAL_MS = 30_000;

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SidebarChild {
  name: string;
  href: string;
}

interface SidebarItem {
  name: string;
  icon: any;
  href?: string;
  children?: SidebarChild[];
}

const sidebarItems: SidebarItem[] = [
  {
    name: 'Health Application',
    icon: Tractor,
    children: [
      { name: 'Dashboard', href: '/' },
      { name: 'Farms', href: '/farms' },
      { name: 'Sheds', href: '/sheds' },
      { name: 'Tags', href: '/tags' },
      { name: 'Cattle', href: '/cattle' },
      { name: 'Land Management', href: '/land-management' },
      { name: 'BMC Management', href: '/bmc-management' },
      { name: 'Departments', href: '/departments' },
      { name: 'User Management', href: '/users' },
      { name: 'Role Management', href: '/roles' },
    ],
  },
  {
    name: 'Customer App',
    icon: Users,
    children: [
      { name: 'Customers', href: '/customer-app/customers' },
      { name: 'Carts', href: '/customer-app/cart' },
      { name: 'Favorites', href: '/customer-app/favorites' },
      { name: 'Orders', href: '/customer-app/orders' },
      { name: 'Products', href: '/customer-app/products' },
      { name: 'Inventory', href: '/customer-app/inventory' },
      { name: 'Categories', href: '/customer-app/categories' },
      { name: 'Locations', href: '/customer-app/locations' },
      { name: 'Executives', href: '/customer-app/executives' },
      { name: 'Routes', href: '/customer-app/routes' },
      { name: 'Payment Methods', href: '/customer-app/payment-methods' },
      { name: 'Delivery Slots', href: '/customer-app/slots' },
    ],
  },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const router = useRouter();
  const pathname = usePathname();
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    if (pathname?.startsWith('/customer-app')) {
      initial['Customer App'] = true;
    }
    const isHealthAppPath = ['/', '/farms', '/sheds', '/tags', '/cattle', '/land-management', '/bmc-management', '/departments', '/users', '/roles'].some(path => pathname === path || (path !== '/' && pathname?.startsWith(path + '/')));
    if (isHealthAppPath) {
      initial['Health Application'] = true;
    }
    return initial;
  });

  useEffect(() => {
    Promise.resolve().then(() => {
      if (pathname.startsWith('/customer-app')) {
        setExpandedMenus((prev) => ({ ...prev, 'Customer App': true }));
      }
      const isHealthAppPath = ['/', '/farms', '/sheds', '/tags', '/cattle', '/land-management', '/bmc-management', '/departments', '/users', '/roles'].some(path => pathname === path || (path !== '/' && pathname.startsWith(path + '/')));
      if (isHealthAppPath) {
        setExpandedMenus((prev) => ({ ...prev, 'Health Application': true }));
      }
    });
  }, [pathname]);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const token = localStorage.getItem('token');

    if (!storedUser || !token || isTokenExpired(token)) {
      logoutAndRedirect();
      return;
    }

    Promise.resolve().then(() => {
      setUser(JSON.parse(storedUser));
    });

    const removeInterceptor = installAuthFetchInterceptor();
    const intervalId = window.setInterval(() => {
      const currentToken = localStorage.getItem('token');
      if (!currentToken || isTokenExpired(currentToken)) {
        logoutAndRedirect();
      }
    }, TOKEN_CHECK_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
      removeInterceptor();
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    const isFarmAdmin = user.role === 'FARM_ADMIN';
    if (isFarmAdmin && (pathname === '/users' || pathname === '/roles')) {
      router.replace('/');
    }
  }, [user, pathname, router]);

  const handleLogout = () => {
    logoutAndRedirect();
  };

  if (!user) return null;

  const allowedSidebarItems = sidebarItems
    .map((item) => {
      if (item.children) {
        const children = item.children.filter((child) => {
          if (user.role === 'FARM_ADMIN' && (child.href === '/users' || child.href === '/roles')) {
            return false;
          }
          return true;
        });
        return { ...item, children };
      }
      return item;
    })
    .filter((item) => {
      if (user.role === 'FARM_ADMIN' && (item.href === '/users' || item.href === '/roles')) {
        return false;
      }
      return true;
    });

  const toggleMenu = (name: string) => {
    setExpandedMenus((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const isCustomerApp = pathname.startsWith('/customer-app');

  return (
    <div className="h-screen w-screen bg-slate-50 text-slate-900 flex overflow-hidden">
      {/* Sidebar Desktop */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-72 h-screen max-h-screen bg-white border-r border-slate-200 transform transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 shrink-0 flex flex-col",
        sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <div className="h-full flex flex-col min-h-0">
          <div className="p-8 flex items-center gap-3 shrink-0">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20">
              <CattleIcon className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900">FarmMaster</span>
          </div>

          <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto min-h-0">
            {allowedSidebarItems.map((item) => {
              if (item.children) {
                const isExpanded = !!expandedMenus[item.name];
                const isAnyChildActive = item.children.some((child) => pathname === child.href);

                const isCustomerAppItem = item.name === 'Customer App';

                return (
                  <div key={item.name} className={cn("space-y-1", isCustomerAppItem && "customer-app-theme")}>
                    <button
                      onClick={() => toggleMenu(item.name)}
                      className={cn(
                        "flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-all duration-200 group relative text-left",
                        isAnyChildActive
                          ? "bg-blue-600/5 text-blue-600 font-semibold"
                          : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                      )}
                    >
                      <item.icon className={cn("w-5 h-5", isAnyChildActive ? "text-blue-600" : "group-hover:text-blue-600 transition-colors")} />
                      <span className="font-semibold text-sm">{item.name}</span>
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 ml-auto text-slate-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 ml-auto text-slate-400" />
                      )}
                    </button>
                    {isExpanded && (
                      <div className="pl-6 space-y-1 border-l border-slate-100 ml-6">
                        {item.children.map((child) => {
                          const isChildActive = pathname === child.href;
                          return (
                            <Link
                              key={child.href}
                              href={child.href}
                              scroll={false}
                              className={cn(
                                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all duration-150",
                                isChildActive
                                  ? "text-blue-600 font-bold bg-blue-50"
                                  : "text-slate-500 hover:text-slate-900 hover:bg-slate-50/50"
                              )}
                            >
                              <span>{child.name}</span>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href!}
                  scroll={false}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative",
                    isActive 
                      ? "bg-blue-600/10 text-blue-600" 
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                  )}
                >
                  <item.icon className={cn("w-5 h-5", isActive ? "text-blue-600" : "group-hover:text-blue-600 transition-colors")} />
                  <span className="font-semibold text-sm">{item.name}</span>
                  {isActive && <div className="absolute right-0 w-1 h-6 bg-blue-600 rounded-l-full" />}
                  <ChevronRight className={cn("w-4 h-4 ml-auto opacity-0 group-hover:opacity-100 transition-opacity", isActive && "opacity-100")} />
                </Link>
              );
            })}
          </nav>

          <div className="p-6 border-t border-slate-100 shrink-0 mt-auto">
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-4 py-3 text-red-600 hover:bg-red-50 rounded-xl transition-colors font-semibold text-sm"
            >
              <LogOut className="w-5 h-5" />
              <span>Logout Account</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 h-screen max-h-screen overflow-hidden">
        {/* Navbar */}
        <header className="h-20 shrink-0 bg-white/80 backdrop-blur-md border-b border-slate-200 px-8 flex items-center justify-between sticky top-0 z-40">
          <div className="flex items-center gap-4">
            <button
              className="lg:hidden p-2 text-slate-500 hover:text-slate-900"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-6 h-6" />
            </button>
            <h2 className="text-xl font-bold text-slate-900 capitalize hidden md:block">
              {pathname.split('/').pop()?.replace('-', ' ') || 'Dashboard'}
            </h2>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-slate-900">{user.name}</p>
              <p className="text-xs font-semibold text-slate-400">{user.role.replace('_', ' ')}</p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center text-white font-bold text-sm shadow-xl shadow-blue-500/20">
              {user.name.charAt(0)}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className={cn("flex-1 min-h-0 overflow-y-auto p-10 relative", isCustomerApp && "customer-app-theme")}>
          {children}
        </main>
      </div>

      {/* Overlay for mobile sidebar */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
