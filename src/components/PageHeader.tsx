import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import shared from './shared.module.css';

export interface Crumb {
  label: string;
  to: string;
}

interface PageHeaderProps {
  title: ReactNode;
  meta?: ReactNode;
  /** Parent pages, shown above the title as a breadcrumb trail. */
  crumbs?: Crumb[];
  actions?: ReactNode;
}

export default function PageHeader({ title, meta, crumbs, actions }: PageHeaderProps) {
  return (
    <header className={shared.pageHeader}>
      <div>
        {crumbs && crumbs.length > 0 && (
          <nav aria-label="Breadcrumb">
            <ol className={shared.crumbs}>
              {crumbs.map((crumb) => (
                <li key={crumb.to} className={shared.crumb}>
                  <Link to={crumb.to}>{crumb.label}</Link>
                  <ChevronRight size={14} aria-hidden="true" />
                </li>
              ))}
            </ol>
          </nav>
        )}
        <h1 className={shared.pageTitle}>{title}</h1>
        {meta && <p className={shared.pageMeta}>{meta}</p>}
      </div>
      {actions && <div className={shared.pageActions}>{actions}</div>}
    </header>
  );
}
