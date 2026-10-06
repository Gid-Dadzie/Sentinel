import { Monitor, Moon, Sun, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { applyThemePreference, readThemePreference, type ThemePreference } from '../utils/theme';
import styles from './Layout.module.css';

const OPTIONS: { value: ThemePreference; label: string; Icon: LucideIcon }[] = [
  { value: 'system', label: 'System theme', Icon: Monitor },
  { value: 'light', label: 'Light theme', Icon: Sun },
  { value: 'dark', label: 'Dark theme', Icon: Moon },
];

/** Three-way segmented control. Each option is a toggle button so the current one is announced. */
export default function ThemeToggle() {
  const [preference, setPreference] = useState<ThemePreference>(readThemePreference);

  return (
    <div className={styles.themeToggle} role="group" aria-label="Colour theme">
      {OPTIONS.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          className={styles.themeOption}
          aria-pressed={preference === value}
          aria-label={label}
          title={label}
          onClick={() => {
            applyThemePreference(value);
            setPreference(value);
          }}
        >
          <Icon size={15} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
