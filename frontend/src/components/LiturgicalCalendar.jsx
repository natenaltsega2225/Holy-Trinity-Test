// //frontend\src\components\LiturgicalCalendar.jsx
import React, { useEffect, useMemo, useState } from "react";
import api from "./api";
import "../styles/liturgicalCalendar.css";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function toKey(date) {
  return new Date(date).toISOString().slice(0, 10);
}

function formatLongDate(dateValue) {
  if (!dateValue) return "";
  return new Date(dateValue).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatRange(startDate, endDate) {
  if (!startDate && !endDate) return "—";

  const fmt = (value) =>
    new Date(value).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });

  if (startDate && endDate) {
    if (startDate === endDate) return fmt(startDate);
    return `${fmt(startDate)} – ${fmt(endDate)}`;
  }

  return fmt(startDate || endDate);
}

function formatSummaryRange(startDate, endDate) {
  if (!startDate && !endDate) return "—";

  const fmt = (value) =>
    new Date(value).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });

  if (startDate && endDate) {
    if (startDate === endDate) return fmt(startDate);
    return `${fmt(startDate)}, and ${fmt(endDate)}`;
  }

  return fmt(startDate || endDate);
}

function stripHtml(value) {
  if (!value) return "";
  return String(value).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function eachDateInRange(startDate, endDate) {
  if (!startDate) return [];

  const start = new Date(startDate);
  const end = new Date(endDate || startDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return [];
  }

  const days = [];
  const cursor = new Date(start);

  while (cursor <= end) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
}

function getYearOptions(baseYear) {
  const years = [];
  for (let y = baseYear - 2; y <= baseYear + 5; y += 1) {
    years.push(y);
  }
  return years;
}

export default function LiturgicalCalendar() {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();

  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedDate, setSelectedDate] = useState(today);
  const [holidayItems, setHolidayItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    async function loadHolidays() {
      setLoading(true);
      setErr("");

      try {
        const { data } = await api.get("/news-events", {
          params: {
            category: "holiday",
            published: "1",
            page: 1,
            limit: 500,
          },
        });

        setHolidayItems(Array.isArray(data?.items) ? data.items : []);
      } catch (error) {
        console.error(error);
        setHolidayItems([]);
        setErr("Could not load holiday activities.");
      } finally {
        setLoading(false);
      }
    }

    loadHolidays();
  }, []);

  const holidaysByDate = useMemo(() => {
    const map = new Map();

    holidayItems.forEach((item) => {
      eachDateInRange(item.start_date, item.end_date).forEach((dateObj) => {
        const key = toKey(dateObj);
        const items = map.get(key) || [];
        items.push(item);
        map.set(key, items);
      });
    });

    return map;
  }, [holidayItems]);

  const holidaysForYear = useMemo(() => {
    return [...holidayItems]
      .filter((item) => {
        const startYear = item.start_date ? new Date(item.start_date).getFullYear() : null;
        const endYear = item.end_date ? new Date(item.end_date).getFullYear() : null;
        return startYear === selectedYear || endYear === selectedYear;
      })
      .sort((a, b) => {
        const aDate = a.start_date || a.end_date || "";
        const bDate = b.start_date || b.end_date || "";
        return aDate.localeCompare(bDate);
      });
  }, [holidayItems, selectedYear]);

  const selectedDateKey = useMemo(() => toKey(selectedDate), [selectedDate]);

  const selectedDayItems = useMemo(() => {
    return holidaysByDate.get(selectedDateKey) || [];
  }, [holidaysByDate, selectedDateKey]);

  const calendarCells = useMemo(() => {
    const first = new Date(selectedYear, selectedMonth, 1);
    const firstDay = first.getDay();
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const prevMonthDays = new Date(selectedYear, selectedMonth, 0).getDate();

    const cells = [];

    for (let i = firstDay - 1; i >= 0; i -= 1) {
      const date = new Date(selectedYear, selectedMonth - 1, prevMonthDays - i);
      cells.push({
        date,
        inCurrentMonth: false,
        holidays: holidaysByDate.get(toKey(date)) || [],
      });
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(selectedYear, selectedMonth, day);
      cells.push({
        date,
        inCurrentMonth: true,
        holidays: holidaysByDate.get(toKey(date)) || [],
      });
    }

    const extra = cells.length % 7 === 0 ? 0 : 7 - (cells.length % 7);
    for (let i = 1; i <= extra; i += 1) {
      const date = new Date(selectedYear, selectedMonth + 1, i);
      cells.push({
        date,
        inCurrentMonth: false,
        holidays: holidaysByDate.get(toKey(date)) || [],
      });
    }

    return cells;
  }, [selectedYear, selectedMonth, holidaysByDate]);

  const yearOptions = useMemo(() => getYearOptions(currentYear), [currentYear]);

  function changeMonth(offset) {
    const next = new Date(selectedYear, selectedMonth + offset, 1);
    setSelectedYear(next.getFullYear());
    setSelectedMonth(next.getMonth());
  }

  function handleMonthChange(e) {
    setSelectedMonth(Number(e.target.value));
  }

  function handleYearChange(e) {
    setSelectedYear(Number(e.target.value));
  }

  function focusHoliday(item) {
    const focusDate = item.start_date || item.end_date;
    if (!focusDate) return;

    const date = new Date(focusDate);
    setSelectedYear(date.getFullYear());
    setSelectedMonth(date.getMonth());
    setSelectedDate(date);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <section className="lc-wrap">
      <div className="lc-head">
        <div>
          <h2>Liturgical Calendar</h2>
          <p>Important fasting seasons, feasts, and holy days.</p>
        </div>
      </div>

      {err && <div className="lc-error">{err}</div>}

      <div className="lc-controls">
        <div className="lc-controls-left">
          <button
            type="button"
            className="lc-nav-btn"
            onClick={() => changeMonth(-1)}
            aria-label="Previous month"
          >
            ←
          </button>

          <select
            className="lc-select"
            value={selectedMonth}
            onChange={handleMonthChange}
          >
            {MONTHS.map((month, index) => (
              <option key={month} value={index}>
                {month}
              </option>
            ))}
          </select>

          <select
            className="lc-select"
            value={selectedYear}
            onChange={handleYearChange}
          >
            {yearOptions.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="lc-nav-btn"
            onClick={() => changeMonth(1)}
            aria-label="Next month"
          >
            →
          </button>
        </div>

        <div className="lc-current-label">
          {MONTHS[selectedMonth]} {selectedYear}
        </div>
      </div>

      <div className="lc-grid-layout">
        <div className="lc-panel">
          <div className="lc-weekdays">
            <span>Sun</span>
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span>Sat</span>
          </div>

          <div className="lc-grid">
            {calendarCells.map((cell) => {
              const key = toKey(cell.date);
              const isSelected = key === selectedDateKey;
              const primaryHoliday = cell.holidays[0];
              const holidayColor = primaryHoliday?.holiday_color || "#2ea36f";

              return (
                <button
                  key={key}
                  type="button"
                  className={[
                    "lc-day",
                    isSelected ? "is-selected" : "",
                    !cell.inCurrentMonth ? "is-outside" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => setSelectedDate(cell.date)}
                >
                  <span className="lc-day-number">{cell.date.getDate()}</span>

                  {cell.holidays.length > 0 && (
                    <div className="lc-day-bars">
                      {cell.holidays.slice(0, 2).map((holiday) => (
                        <div
                          key={`${holiday.id}-${key}`}
                          className="lc-day-bar"
                          style={{
                            backgroundColor: holiday.holiday_color || holidayColor,
                          }}
                          title={holiday.title}
                        >
                          {holiday.title}
                        </div>
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="lc-panel">
          <h3>{formatLongDate(selectedDate)}</h3>

          {loading ? (
            <div className="lc-empty">Loading holidays...</div>
          ) : selectedDayItems.length ? (
            <div className="lc-events">
              {selectedDayItems.map((item) => (
                <article key={item.id} className="lc-event-card">
                  <div className="lc-badge">Holiday Activity</div>
                  <h4>{item.title}</h4>
                  <div className="lc-event-date">
                    {formatRange(item.start_date, item.end_date)}
                  </div>
                  {item.summary ? <p>{stripHtml(item.summary)}</p> : null}
                </article>
              ))}
            </div>
          ) : (
            <div className="lc-empty">No holiday is assigned to this date.</div>
          )}
        </div>
      </div>

      <div className="lc-summary-panel">
        <div className="lc-summary-head">
          <h3>{selectedYear} Holy Trinity Holidays</h3>
          <p>The following Holy Trinity holidays are available for {selectedYear}.</p>
        </div>

        {loading ? (
          <div className="lc-empty">Loading yearly holiday summary...</div>
        ) : holidaysForYear.length ? (
          <ul className="lc-summary-bullets">
            {holidaysForYear.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="lc-summary-bullet-btn"
                  onClick={() => focusHoliday(item)}
                >
                  <span
                    className="lc-summary-dot"
                    style={{ backgroundColor: item.holiday_color || "#2ea36f" }}
                  />
                  <span>
                    {formatSummaryRange(item.start_date, item.end_date)} –{" "}
                    <strong>{item.title}</strong>
                    {item.summary ? ` — ${stripHtml(item.summary)}` : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="lc-empty">
            No holiday summary is available for {selectedYear}.
          </div>
        )}
      </div>
    </section>
  );
}