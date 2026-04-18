import { useEffect, useMemo, useState, type JSX } from "react";
import { getDailyForecast } from "../api/weather.api";

interface WeatherSectionProps {
  locationName?: string;
  latitude?: number | null;
  longitude?: number | null;
  startAt: string;
  endAt: string;
  onStartAtChange: (value: string) => void;
  onEndAtChange: (value: string) => void;
  capacity: number;
  onCapacityChange: (value: number) => void;
  meetingPoint: string;
  onMeetingPointChange: (value: string) => void;
  sessionNote: string;
  onSessionNoteChange: (value: string) => void;
}

type WeatherCondition = "sunny" | "partly-cloudy" | "cloudy" | "rainy" | "stormy" | "snowy" | "foggy";

interface ForecastDay {
  date: string;
  tempMax: number;
  tempMin: number;
  rain: number;
  wind: number;
  code: number;
  condition: WeatherCondition;
  label: string;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DURATION_OPTIONS = [1, 2, 3, 5, 7, 10, 14];

function mapWeatherCode(code: number): { condition: WeatherCondition; label: string } {
  if (code === 0) return { condition: "sunny", label: "Clear sky" };
  if ([1, 2].includes(code)) return { condition: "partly-cloudy", label: "Partly cloudy" };
  if (code === 3) return { condition: "cloudy", label: "Cloudy" };
  if ([45, 48].includes(code)) return { condition: "foggy", label: "Foggy" };
  if ([95, 96, 99].includes(code)) return { condition: "stormy", label: "Thunderstorm" };
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { condition: "snowy", label: "Snow" };
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) {
    return { condition: "rainy", label: "Rain" };
  }
  return { condition: "cloudy", label: "Variable clouds" };
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function toDateOnly(date: Date): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseDateOnly(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);
}

function formatDateHeading(value: string): string {
  const date = parseDateOnly(value);
  return `${DAY_NAMES[date.getDay()]}, ${date.getDate()} ${MONTH_NAMES[date.getMonth()]}`;
}

function formatCardDay(value: string) {
  const date = parseDateOnly(value);
  return {
    dow: DAY_NAMES[date.getDay()],
    dayMonth: `${date.getDate()} ${MONTH_NAMES[date.getMonth()]}`,
  };
}

function addDays(value: string, amount: number): string {
  const date = parseDateOnly(value);
  date.setDate(date.getDate() + amount);
  return toDateOnly(date);
}

function diffDaysInclusive(start: string, end: string): number {
  const startDate = parseDateOnly(start);
  const endDate = parseDateOnly(end);
  const ms = endDate.getTime() - startDate.getTime();
  return Math.floor(ms / 86400000) + 1;
}

function combineLocalDateAndTime(dateOnly: string, timeValue: string): string {
  return `${dateOnly}T${timeValue}`;
}

function extractDateOnly(dateTime: string): string {
  return dateTime ? dateTime.slice(0, 10) : "";
}

function extractTime(dateTime: string, fallback: string): string {
  if (!dateTime || !dateTime.includes("T")) return fallback;
  return dateTime.slice(11, 16) || fallback;
}

function getBadge(day: ForecastDay): { text: string; tone: "good" | "warn" | "info" } | null {
  if (day.rain >= 60) return { text: "Rain risk", tone: "warn" };
  if (day.condition === "stormy") return { text: "Storm", tone: "warn" };
  if (day.condition === "sunny" && day.tempMax >= 18) return { text: "Best day", tone: "good" };
  if (day.rain <= 15 && ["sunny", "partly-cloudy"].includes(day.condition)) {
    return { text: "Good weather", tone: "info" };
  }
  return null;
}

function clampCapacity(value: number): number {
  if (Number.isNaN(value)) return 3;
  return Math.max(3, Math.floor(value));
}

const WeatherIcon = ({ condition, size = 26 }: { condition: WeatherCondition; size?: number }) => {
  const s = size;
  const icons: Record<WeatherCondition, JSX.Element> = {
    sunny: (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="4" fill="#f97316" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
          <line
            key={deg}
            x1={12 + Math.cos((deg * Math.PI) / 180) * 6.5}
            y1={12 + Math.sin((deg * Math.PI) / 180) * 6.5}
            x2={12 + Math.cos((deg * Math.PI) / 180) * 9}
            y2={12 + Math.sin((deg * Math.PI) / 180) * 9}
            stroke="#f97316"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        ))}
      </svg>
    ),
    "partly-cloudy": (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <circle cx="9" cy="9" r="3.5" fill="#f97316" opacity="0.92" />
        <path d="M8 16.5a4.5 4.5 0 1 1 0-9 3.5 3.5 0 0 1 6.96-.75A3 3 0 1 1 17 16.5z" fill="#b0c4d8" />
      </svg>
    ),
    cloudy: (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <path d="M6 18a5 5 0 1 1 0-10 4 4 0 0 1 7.74-.5A3.5 3.5 0 1 1 18 18z" fill="#94a3b8" />
      </svg>
    ),
    rainy: (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <path d="M6 13a5 5 0 1 1 0-10 4 4 0 0 1 7.74-.5A3.5 3.5 0 1 1 18 13z" fill="#94a3b8" />
        <line x1="8" y1="16" x2="6" y2="20" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="12" y1="16" x2="10" y2="20" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="16" y1="16" x2="14" y2="20" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    stormy: (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <path d="M5 13a5 5 0 1 1 0-10 4 4 0 0 1 7.74-.5A3.5 3.5 0 1 1 17 13z" fill="#64748b" />
        <polyline points="13,15 10,19 13,19 10,23" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    ),
    snowy: (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <path d="M6 13a5 5 0 1 1 0-10 4 4 0 0 1 7.74-.5A3.5 3.5 0 1 1 18 13z" fill="#cbd5e1" />
        <circle cx="8" cy="17" r="1" fill="#bfdbfe" />
        <circle cx="12" cy="19" r="1" fill="#bfdbfe" />
        <circle cx="16" cy="17" r="1" fill="#bfdbfe" />
      </svg>
    ),
    foggy: (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <line x1="4" y1="9" x2="20" y2="9" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="4" y1="13" x2="20" y2="13" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="6" y1="17" x2="18" y2="17" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  };
  return icons[condition];
};

function buildForecast(res: Awaited<ReturnType<typeof getDailyForecast>> | null): ForecastDay[] {
  if (!res?.daily?.time?.length) return [];
  return res.daily.time.map((date, index) => {
    const code = res.daily.weathercode[index] ?? 0;
    const mapped = mapWeatherCode(code);
    return {
      date,
      code,
      tempMax: res.daily.temperature_2m_max[index] ?? 0,
      tempMin: res.daily.temperature_2m_min[index] ?? 0,
      rain: res.daily.precipitation_probability_max[index] ?? 0,
      wind: res.daily.windspeed_10m_max[index] ?? 0,
      condition: mapped.condition,
      label: mapped.label,
    };
  });
}

export default function WeatherSection({
  locationName = "Your activity location",
  latitude,
  longitude,
  startAt,
  endAt,
  onStartAtChange,
  onEndAtChange,
  capacity,
  onCapacityChange,
  meetingPoint,
  onMeetingPointChange,
  sessionNote,
  onSessionNoteChange,
}: WeatherSectionProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forecast, setForecast] = useState<ForecastDay[]>([]);
  const [weekOffset, setWeekOffset] = useState(0);

  const hasCoordinates = latitude != null && longitude != null;

  useEffect(() => {
    if (!hasCoordinates) {
      setForecast([]);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const response = await getDailyForecast(latitude!, longitude!);
        if (!cancelled) {
          setForecast(buildForecast(response));
        }
      } catch (err) {
        if (!cancelled) {
          setForecast([]);
          setError(err instanceof Error ? err.message : "Failed to load weather forecast");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [hasCoordinates, latitude, longitude]);

  const todayDate = toDateOnly(startOfToday());
  const selectedStartDate = extractDateOnly(startAt);
  const selectedEndDate = extractDateOnly(endAt);
  const startTime = extractTime(startAt, "08:00");
  const endTime = extractTime(endAt, "17:00");

  useEffect(() => {
    setWeekOffset(0);
  }, [selectedStartDate]);

  const forecastStartDate = useMemo(() => {
    if (selectedStartDate) return selectedStartDate;
    const firstValid = forecast.find((item) => item.date >= todayDate);
    return firstValid?.date ?? todayDate;
  }, [forecast, selectedStartDate, todayDate]);

  const forecastStartIndex = useMemo(() => {
    const index = forecast.findIndex((item) => item.date === forecastStartDate);
    return index >= 0 ? index : 0;
  }, [forecast, forecastStartDate]);

  const durationDays = useMemo(() => {
    if (!selectedStartDate || !selectedEndDate || selectedEndDate < selectedStartDate) return 0;
    return diffDaysInclusive(selectedStartDate, selectedEndDate);
  }, [selectedStartDate, selectedEndDate]);

  const minWeeksToCoverRange = useMemo(() => {
    if (!durationDays) return 1;
    return Math.max(1, Math.ceil(durationDays / 7));
  }, [durationDays]);

  useEffect(() => {
    if (weekOffset < minWeeksToCoverRange - 1) {
      setWeekOffset(minWeeksToCoverRange - 1);
    }
  }, [minWeeksToCoverRange, weekOffset]);

  const maxWeekOffset = useMemo(() => {
    if (forecast.length <= forecastStartIndex) return 0;
    return Math.max(0, Math.ceil((forecast.length - forecastStartIndex) / 7) - 1);
  }, [forecast.length, forecastStartIndex]);

  const visibleDays = useMemo(() => {
    return forecast.slice(forecastStartIndex, forecastStartIndex + (weekOffset + 1) * 7);
  }, [forecast, forecastStartIndex, weekOffset]);

  const detailDay = useMemo(() => {
    const preferredDate = selectedEndDate || selectedStartDate || visibleDays[0]?.date;
    return visibleDays.find((item) => item.date === preferredDate) ?? visibleDays[0] ?? null;
  }, [visibleDays, selectedEndDate, selectedStartDate]);

  const rangeDays = useMemo(() => {
    if (!selectedStartDate || !selectedEndDate) return [];
    return forecast.filter((item) => item.date >= selectedStartDate && item.date <= selectedEndDate);
  }, [forecast, selectedEndDate, selectedStartDate]);

  const rangeSummary = useMemo(() => {
    if (!rangeDays.length) return null;
    const sunnyDays = rangeDays.filter((day) => ["sunny", "partly-cloudy"].includes(day.condition) && day.rain < 30).length;
    const rainyDays = rangeDays.filter((day) => day.rain >= 50 || day.condition === "stormy").length;
    const avgMax = Math.round(rangeDays.reduce((sum, day) => sum + day.tempMax, 0) / rangeDays.length);
    const bestDay = [...rangeDays].sort((a, b) => (a.rain - b.rain) || (b.tempMax - a.tempMax))[0] ?? null;
    return { sunnyDays, rainyDays, avgMax, bestDay };
  }, [rangeDays]);

  function applyStartDate(dateOnly: string) {
    const normalizedStart = dateOnly < todayDate ? todayDate : dateOnly;
    onStartAtChange(combineLocalDateAndTime(normalizedStart, startTime));

    if (!selectedEndDate || selectedEndDate < normalizedStart) {
      onEndAtChange(combineLocalDateAndTime(normalizedStart, endTime));
      return;
    }

    onEndAtChange(combineLocalDateAndTime(selectedEndDate, endTime));
  }

  function applyDuration(days: number) {
    if (!selectedStartDate) return;
    const computedEndDate = addDays(selectedStartDate, days - 1);
    onEndAtChange(combineLocalDateAndTime(computedEndDate, endTime));
  }

  function handleTimelineDayClick(dateOnly: string) {
    if (!selectedStartDate) {
      applyStartDate(dateOnly);
      return;
    }
    if (dateOnly < selectedStartDate) {
      applyStartDate(dateOnly);
      return;
    }
    onEndAtChange(combineLocalDateAndTime(dateOnly, endTime));
  }

  const canShowForecast = hasCoordinates && !loading && !error && forecast.length > 0;

  return (
    <div className="wx-shell">
      <style>{styles}</style>

      <div className="wx-card">
        <div className="wx-header">
          <div>
            <div className="wx-eyebrow">Plan around the forecast</div>
            <h2 className="wx-title">Weather-aware schedule</h2>
            <p className="wx-subtitle">
              Pick a start day first, then extend the trip by duration or by clicking an end day.
            </p>
          </div>
          <div className="wx-location-pill">📍 {locationName}</div>
        </div>

        <div className="wx-grid-two">
          <div className="wx-panel">
            <div className="wx-panel-head">
              <h3>Trip timing</h3>
              <span>Step 1 → choose the start day</span>
            </div>

            <div className="wx-input-grid">
              <label className="wx-field">
                <span>Start date</span>
                <input
                  type="date"
                  min={todayDate}
                  value={selectedStartDate}
                  onChange={(e) => applyStartDate(e.target.value)}
                />
              </label>

              <label className="wx-field">
                <span>Start time</span>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => {
                    const dateOnly = selectedStartDate || todayDate;
                    onStartAtChange(combineLocalDateAndTime(dateOnly, e.target.value));
                  }}
                />
              </label>

              <label className="wx-field">
                <span>End date</span>
                <input
                  type="date"
                  min={selectedStartDate || todayDate}
                  value={selectedEndDate}
                  onChange={(e) => {
                    const nextEnd = e.target.value;
                    if (!nextEnd) return;
                    onEndAtChange(combineLocalDateAndTime(nextEnd, endTime));
                  }}
                />
              </label>

              <label className="wx-field">
                <span>End time</span>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => {
                    const dateOnly = selectedEndDate || selectedStartDate || todayDate;
                    onEndAtChange(combineLocalDateAndTime(dateOnly, e.target.value));
                  }}
                />
              </label>
            </div>

            <div className="wx-duration-row">
              <div className="wx-duration-label">Step 2 → choose duration</div>
              <div className="wx-chips">
                {DURATION_OPTIONS.map((days) => {
                  const active = durationDays === days;
                  return (
                    <button
                      key={days}
                      type="button"
                      className={`wx-chip ${active ? "is-active" : ""}`}
                      disabled={!selectedStartDate}
                      onClick={() => applyDuration(days)}
                    >
                      {days} day{days > 1 ? "s" : ""}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="wx-summary-strip">
              <div className="wx-summary-item">
                <span>Selected range</span>
                <strong>
                  {selectedStartDate ? formatDateHeading(selectedStartDate) : "No start day yet"}
                  {selectedEndDate && selectedEndDate !== selectedStartDate ? ` → ${formatDateHeading(selectedEndDate)}` : ""}
                </strong>
              </div>
              <div className="wx-summary-item">
                <span>Duration</span>
                <strong>{durationDays ? `${durationDays} day${durationDays > 1 ? "s" : ""}` : "—"}</strong>
              </div>
            </div>
          </div>

          <div className="wx-panel">
            <div className="wx-panel-head">
              <h3>Session details</h3>
              <span>Required to publish</span>
            </div>

            <div className="wx-input-grid wx-input-grid--single">
              <label className="wx-field">
                <span>Capacity</span>
                <input
                  type="number"
                  min={3}
                  value={capacity}
                  onChange={(e) => onCapacityChange(clampCapacity(Number(e.target.value)))}
                />
              </label>

              <label className="wx-field">
                <span>Meeting point</span>
                <input
                  type="text"
                  value={meetingPoint}
                  onChange={(e) => onMeetingPointChange(e.target.value)}
                  placeholder="Parking, café, trailhead..."
                />
              </label>

              <label className="wx-field wx-field--full">
                <span>Session note</span>
                <textarea
                  rows={4}
                  value={sessionNote}
                  onChange={(e) => onSessionNoteChange(e.target.value)}
                  placeholder="What should participants know before the session starts?"
                />
              </label>
            </div>
          </div>
        </div>

        {!hasCoordinates && (
          <div className="wx-empty-state">
            Select a location first to unlock the forecast-based planner.
          </div>
        )}

        {hasCoordinates && loading && <div className="wx-empty-state">Loading forecast…</div>}
        {hasCoordinates && error && <div className="wx-empty-state wx-empty-state--error">{error}</div>}

        {canShowForecast && (
          <>
            <div className="wx-forecast-head">
              <div>
                <div className="wx-duration-label">Forecast starts from your selected start day</div>
                <h3>
                  {selectedStartDate ? formatDateHeading(selectedStartDate) : "Choose a start date to begin"}
                </h3>
              </div>
              <div className="wx-nav-row">
                <button
                  type="button"
                  className="wx-nav-btn"
                  onClick={() => setWeekOffset((prev) => Math.max(0, prev - 1))}
                  disabled={weekOffset === 0}
                >
                  ← less
                </button>
                <button
                  type="button"
                  className="wx-nav-btn"
                  onClick={() => setWeekOffset((prev) => Math.min(maxWeekOffset, prev + 1))}
                  disabled={weekOffset >= maxWeekOffset}
                >
                  more →
                </button>
              </div>
            </div>

            <div className="wx-day-grid">
              {visibleDays.map((day) => {
                const { dow, dayMonth } = formatCardDay(day.date);
                const isStart = day.date === selectedStartDate;
                const isEnd = day.date === selectedEndDate;
                const inRange = !!selectedStartDate && !!selectedEndDate && day.date >= selectedStartDate && day.date <= selectedEndDate;
                const badge = getBadge(day);

                return (
                  <button
                    key={day.date}
                    type="button"
                    className={`wx-day-card ${isStart || isEnd ? "is-strong" : ""} ${inRange ? "is-range" : ""}`}
                    onClick={() => handleTimelineDayClick(day.date)}
                  >
                    {badge && <span className={`wx-badge ${badge.tone}`}>{badge.text}</span>}
                    <div className="wx-day-top">{isStart ? "START" : isEnd ? "END" : dow}</div>
                    <div className="wx-day-date">{dayMonth}</div>
                    <div className="wx-day-icon"><WeatherIcon condition={day.condition} size={30} /></div>
                    <div className="wx-day-temp">{Math.round(day.tempMax)}° <small>{Math.round(day.tempMin)}°</small></div>
                    <div className="wx-day-meta">💧 {day.rain}%</div>
                  </button>
                );
              })}
            </div>

            {detailDay && (
              <div className="wx-detail-card">
                <div className="wx-detail-head">
                  <div className="wx-detail-title">
                    <WeatherIcon condition={detailDay.condition} size={34} />
                    <div>
                      <h3>{formatDateHeading(detailDay.date)}</h3>
                      <p>{detailDay.label}</p>
                    </div>
                  </div>
                  <div className="wx-detail-temp">
                    <strong>{Math.round(detailDay.tempMax)}°</strong>
                    <span>/{Math.round(detailDay.tempMin)}°C</span>
                  </div>
                </div>

                <div className="wx-stats">
                  <div className="wx-stat"><span>Rain chance</span><strong>{detailDay.rain}%</strong></div>
                  <div className="wx-stat"><span>Wind</span><strong>{detailDay.wind} km/h</strong></div>
                  <div className="wx-stat"><span>Condition</span><strong>{detailDay.label}</strong></div>
                </div>
              </div>
            )}

            {rangeSummary && (
              <div className="wx-range-card">
                <div>
                  <div className="wx-duration-label">Range overview</div>
                  <h3>
                    {formatDateHeading(selectedStartDate)}
                    {selectedEndDate && ` → ${formatDateHeading(selectedEndDate)}`}
                  </h3>
                </div>
                <div className="wx-range-metrics">
                  <div className="wx-range-metric"><span>Avg max</span><strong>{rangeSummary.avgMax}°C</strong></div>
                  <div className="wx-range-metric"><span>Good days</span><strong>{rangeSummary.sunnyDays}</strong></div>
                  <div className="wx-range-metric"><span>Risk days</span><strong>{rangeSummary.rainyDays}</strong></div>
                  <div className="wx-range-metric wx-range-metric--wide">
                    <span>Best visible day</span>
                    <strong>{rangeSummary.bestDay ? formatDateHeading(rangeSummary.bestDay.date) : "—"}</strong>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const styles = `
.wx-shell {
  width: 100%;
}

.wx-card {
  background: #f6f1ea;
  border: 1px solid #e5ddd2;
  border-radius: 28px;
  padding: 24px;
  box-shadow: 0 10px 40px rgba(34, 65, 44, 0.06);
}

.wx-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
  flex-wrap: wrap;
  margin-bottom: 18px;
}

.wx-eyebrow,
.wx-duration-label {
  font-size: 12px;
  color: #6b8b70;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 700;
}

.wx-title {
  margin: 6px 0 4px;
  font-family: Georgia, serif;
  color: #16331d;
  font-size: 2rem;
}

.wx-subtitle {
  margin: 0;
  color: #708170;
  font-size: 0.98rem;
  max-width: 680px;
}

.wx-location-pill {
  background: #ece7df;
  color: #607262;
  border: 1px solid #ddd4c8;
  padding: 10px 14px;
  border-radius: 999px;
  font-size: 0.92rem;
  white-space: nowrap;
}

.wx-grid-two {
  display: grid;
  grid-template-columns: 1.2fr 0.95fr;
  gap: 16px;
  margin-bottom: 20px;
}

.wx-panel,
.wx-detail-card,
.wx-range-card {
  background: #fbf8f4;
  border: 1px solid #e5ddd2;
  border-radius: 20px;
  padding: 18px;
}

.wx-panel-head,
.wx-detail-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}

.wx-panel-head h3,
.wx-forecast-head h3,
.wx-detail-title h3,
.wx-range-card h3 {
  margin: 0;
  color: #16331d;
  font-family: Georgia, serif;
}

.wx-panel-head span,
.wx-detail-title p {
  color: #7d8f7b;
  font-size: 0.92rem;
  margin: 4px 0 0;
}

.wx-input-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.wx-input-grid--single {
  grid-template-columns: 1fr;
}

.wx-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.wx-field--full {
  grid-column: 1 / -1;
}

.wx-field span {
  color: #34513d;
  font-size: 0.9rem;
  font-weight: 700;
}

.wx-field input,
.wx-field textarea {
  width: 100%;
  border: 1px solid #d9d0c3;
  background: #fff;
  border-radius: 14px;
  padding: 12px 14px;
  font-size: 0.97rem;
  color: #1a2e1e;
  outline: none;
  box-sizing: border-box;
}

.wx-field input:focus,
.wx-field textarea:focus {
  border-color: #f97316;
  box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.12);
}

.wx-duration-row {
  margin-top: 16px;
}

.wx-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.wx-chip,
.wx-nav-btn,
.wx-day-card {
  transition: all 0.18s ease;
}

.wx-chip {
  border: 1px solid #ddd4c8;
  background: #fff;
  color: #34513d;
  border-radius: 999px;
  padding: 9px 12px;
  font-weight: 700;
  cursor: pointer;
}

.wx-chip.is-active,
.wx-chip:hover:not(:disabled) {
  border-color: #f97316;
  color: #f97316;
  background: #fff7f1;
}

.wx-chip:disabled,
.wx-nav-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.wx-summary-strip {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 16px;
}

.wx-summary-item {
  background: #fff;
  border: 1px solid #e5ddd2;
  border-radius: 14px;
  padding: 12px 14px;
}

.wx-summary-item span,
.wx-stat span,
.wx-range-metric span {
  display: block;
  color: #7d8f7b;
  font-size: 0.82rem;
  margin-bottom: 4px;
}

.wx-summary-item strong,
.wx-stat strong,
.wx-range-metric strong {
  color: #16331d;
  font-size: 1rem;
}

.wx-empty-state {
  margin-top: 12px;
  background: #fbf8f4;
  border: 1px dashed #d5cabd;
  border-radius: 18px;
  padding: 18px;
  color: #6c7f6d;
}

.wx-empty-state--error {
  color: #b42318;
  border-color: #efc0bc;
  background: #fff7f6;
}

.wx-forecast-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 12px;
  flex-wrap: wrap;
  margin: 22px 0 14px;
}

.wx-nav-row {
  display: flex;
  gap: 8px;
}

.wx-nav-btn {
  border: 1px solid #ddd4c8;
  background: #fff;
  border-radius: 999px;
  padding: 9px 12px;
  color: #34513d;
  font-weight: 700;
  cursor: pointer;
}

.wx-nav-btn:hover:not(:disabled) {
  border-color: #16331d;
}

.wx-day-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(112px, 1fr));
  gap: 10px;
}

.wx-day-card {
  position: relative;
  border: 1px solid #ded5c9;
  background: #fff;
  border-radius: 18px;
  padding: 14px 10px 12px;
  text-align: center;
  cursor: pointer;
  min-height: 156px;
}

.wx-day-card:hover {
  transform: translateY(-1px);
  border-color: #f97316;
}

.wx-day-card.is-range {
  background: linear-gradient(180deg, #fff9f3 0%, #fff 100%);
  border-color: #f3bc8d;
}

.wx-day-card.is-strong {
  border-color: #f97316;
  box-shadow: inset 0 0 0 1px #f97316;
}

.wx-badge {
  position: absolute;
  top: -9px;
  left: 10px;
  border-radius: 999px;
  padding: 4px 8px;
  font-size: 0.7rem;
  font-weight: 800;
}

.wx-badge.good { background: #dff3e4; color: #197a35; }
.wx-badge.warn { background: #ffe3e0; color: #c4322a; }
.wx-badge.info { background: #e1f0ff; color: #2161b6; }

.wx-day-top {
  color: #6b8b70;
  font-size: 0.8rem;
  font-weight: 800;
  letter-spacing: 0.05em;
}

.wx-day-date {
  margin-top: 4px;
  color: #16331d;
  font-weight: 700;
}

.wx-day-icon {
  display: flex;
  justify-content: center;
  margin: 12px 0 10px;
}

.wx-day-temp {
  font-size: 1.25rem;
  font-weight: 800;
  color: #16331d;
}

.wx-day-temp small {
  font-size: 0.88rem;
  color: #7d8f7b;
}

.wx-day-meta {
  margin-top: 6px;
  color: #5c7397;
  font-size: 0.86rem;
  font-weight: 700;
}

.wx-detail-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.wx-detail-temp strong {
  color: #f97316;
  font-size: 2rem;
  font-family: Georgia, serif;
}

.wx-detail-temp span {
  color: #7d8f7b;
  font-size: 1.1rem;
}

.wx-stats,
.wx-range-metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.wx-stat,
.wx-range-metric {
  background: #fff;
  border: 1px solid #e5ddd2;
  border-radius: 14px;
  padding: 12px 14px;
}

.wx-range-card {
  margin-top: 14px;
}

.wx-range-metrics {
  margin-top: 14px;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.wx-range-metric--wide {
  grid-column: span 1;
}

@media (max-width: 980px) {
  .wx-grid-two,
  .wx-input-grid,
  .wx-summary-strip,
  .wx-stats,
  .wx-range-metrics {
    grid-template-columns: 1fr;
  }

  .wx-card {
    padding: 18px;
    border-radius: 22px;
  }
}
`;
