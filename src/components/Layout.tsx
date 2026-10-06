import { Suspense } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import styles from './Layout.module.css';

const navClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? `${styles.link} ${styles.active}` : styles.link;

export default function Layout() {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className={styles.header}>
        <span className={styles.brand}>Fraud Risk</span>
        <nav aria-label="Main" className={styles.nav}>
          <NavLink to="/" end className={navClass}>
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
