import { LayoutDashboard, LogOut, ShieldCheck, SlidersHorizontal, Upload } from 'lucide-react';
import { Suspense, useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth, useOptionalUser } from '../api/auth';
import { API_MODE } from '../api/client';
import { useQueueCount } from '../api/queueCount';
import { useFraudStore } from '../state/useFraudStore';
import { countNeedsReview } from '../utils/dashboard';
import styles from './Layout.module.css';
import ThemeToggle from './ThemeToggle';

const navClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? `${styles.link} ${styles.active}` : styles.link;

/** Transaction and customer pages are drill-downs from the dashboard, so its tab stays lit. */
function isDashboardArea(pathname: string): boolean {
  return pathname === '/' || pathname.startsWith('/tx/') || pathname.startsWith('/customer/');
}

/** Who is signed in, with a way out. Only rendered in API mode. */
function SignedIn({ name, role }: { name: string; role: string }) {
  const { logout } = useAuth();
  return (
    <div className={styles.account}>
      <span className={styles.accountName}>
        {name}
        <span className={styles.dataNote}>{role === 'admin' ? 'Admin' : 'Analyst'}</span>
      </span>
      <button type="button" className={styles.signOut} onClick={() => void logout()}>
        <LogOut size={15} aria-hidden="true" />
        Sign out
      </button>
    </div>
  );
}

export default function Layout() {
  const { pathname } = useLocation();
  const user = useOptionalUser();
  const demoCount = useFraudStore((state) =>
    API_MODE ? 0 : countNeedsReview(state.transactions, state.reviews),
  );
  const apiCount = useQueueCount((state) => state.count);
  const refreshQueueCount = useQueueCount((state) => state.refresh);
  useEffect(() => {
    if (API_MODE) refreshQueueCount();
  }, [pathname, refreshQueueCount]);
  const needsReview = API_MODE ? (apiCount ?? 0) : demoCount;

  return (
    <div className={styles.shell}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">
            <ShieldCheck size={18} strokeWidth={2.25} />
          </span>
          <span className={styles.brandText}>
            <span className={styles.brandName}>Sentinel</span>
            <span className={styles.brandTag}>Fraud risk</span>
          </span>
        </div>
        <nav aria-label="Main" className={styles.nav}>
          <NavLink to="/" end className={() => navClass({ isActive: isDashboardArea(pathname) })}>
            <LayoutDashboard size={17} aria-hidden="true" />
            <span>Dashboard</span>
            {needsReview > 0 && (
              <span className={styles.count}>
                {needsReview}
                <span className="visually-hidden"> to review</span>
              </span>
            )}
          </NavLink>
          <NavLink to="/rules" className={navClass}>
            <SlidersHorizontal size={17} aria-hidden="true" />
            <span>Rules</span>
          </NavLink>
          {user?.role === 'admin' && (
            <NavLink to="/import" className={navClass}>
              <Upload size={17} aria-hidden="true" />
              <span>Import</span>
            </NavLink>
          )}
        </nav>
        <div className={styles.sidebarFooter}>
          <ThemeToggle />
          {user ? (
            <SignedIn name={user.name} role={user.role} />
          ) : (
            <p className={styles.dataNote}>Demo data · 1 Sep – 5 Oct 2026</p>
          )}
        </div>
      </aside>
      <main id="main" className={styles.main}>
        <Suspense fallback={<p role="status">Loading…</p>}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
