import { LayoutDashboard, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { Suspense } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
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

export default function Layout() {
  const { pathname } = useLocation();
  const needsReview = useFraudStore((state) => countNeedsReview(state.transactions, state.reviews));

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
        </nav>
        <div className={styles.sidebarFooter}>
          <ThemeToggle />
          <p className={styles.dataNote}>Demo data · 1 Sep – 5 Oct 2026</p>
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
