import { Suspense } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import styles from './Layout.module.css';

const navClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? `${styles.link} ${styles.active}` : styles.link;

/** Transaction and customer pages are drill-downs from the dashboard, so its tab stays lit. */
function isDashboardArea(pathname: string): boolean {
  return pathname === '/' || pathname.startsWith('/tx/') || pathname.startsWith('/customer/');
}

export default function Layout() {
  const { pathname } = useLocation();
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className={styles.header}>
        <span className={styles.brand}>Fraud Risk</span>
        <nav aria-label="Main" className={styles.nav}>
          <NavLink to="/" end className={() => navClass({ isActive: isDashboardArea(pathname) })}>
            Dashboard
          </NavLink>
          <NavLink to="/rules" className={navClass}>
            Rules
          </NavLink>
        </nav>
      </header>
      <main id="main" className={styles.main}>
        <Suspense fallback={<p role="status">Loading…</p>}>
          <Outlet />
        </Suspense>
      </main>
    </>
  );
}
