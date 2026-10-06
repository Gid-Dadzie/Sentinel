import { CalendarDays } from 'lucide-react';
import type { DailyCount } from '../../utils/dashboard';
import { calendarWeeks } from '../../utils/dashboard';
import { formatDate } from '../../utils/format';
import shared from '../shared.module.css';
import styles from './Dashboard.module.css';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Sequential steps: 0, 1, 2, 3+ flagged on the day. */
function step(flagged: number): 0 | 1 | 2 | 3 {
  return flagged >= 3 ? 3 : (flagged as 0 | 1 | 2);
}

/**
 * Flagged transactions per day as a month-style calendar. It is a real table,
 * so screen readers get every day's numbers; colour is a second cue on top.
 */
export default function FlaggedCalendar({ daily }: { daily: readonly DailyCount[] }) {
  const weeks = calendarWeeks(daily);
  const flaggedTotal = daily.reduce((sum, d) => sum + d.flagged, 0);
  const activeDays = daily.filter((d) => d.flagged > 0).length;

  return (
    <section className={shared.card} aria-labelledby="calendar-heading">
      <h2 id="calendar-heading" className={shared.cardTitle}>
        <CalendarDays size={17} aria-hidden="true" />
        Flagged by day
      </h2>
      <p className={shared.cardDescription}>
        {flaggedTotal} flagged on {activeDays} of {daily.length} days.
      </p>
      <table className={styles.calendar} aria-labelledby="calendar-heading">
        <thead>
          <tr>
            {WEEKDAYS.map((d) => (
              <th key={d} scope="col" abbr={d}>
                {d.charAt(0)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={week.find(Boolean)?.date}>
              {week.map((day, i) =>
                day ? (
                  <td
                    key={day.date}
                    className={styles[`cal${step(day.flagged)}`]}
                    title={`${formatDate(day.date)}: ${day.flagged} flagged of ${day.total}`}
                  >
                    <span aria-hidden="true">{Number(day.date.slice(8))}</span>
                    <span className="visually-hidden">
                      {formatDate(day.date)}: {day.flagged} flagged of {day.total}
                    </span>
                  </td>
                ) : (
                  <td key={`pad-${i}`} className={styles.calPad} />
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
      <div className={styles.calLegend} aria-hidden="true">
        <span>Fewer</span>
        {[0, 1, 2, 3].map((n) => (
          <span key={n} className={`${styles.calSwatch} ${styles[`cal${n}`]}`} />
        ))}
        <span>3+ flagged</span>
      </div>
    </section>
  );
}
