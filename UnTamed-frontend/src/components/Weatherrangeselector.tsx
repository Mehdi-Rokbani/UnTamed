import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type JSX,
} from "react";
import { getDailyForecast } from "../api/weather.api";
import LocationPicker from "./LocationPicker";
import type { MeetingPointLocation } from "../types/activity";
import type { AddressResponse } from "../types/geo";
import styles from "../style/WeatherRangeSelector.module.css";

/* ─── Types ──────────────────────────────────────────────────────────────────── */
type WeatherCondition =
  | "sunny"
  | "partly-cloudy"
  | "cloudy"
  | "rainy"
  | "stormy"
  | "snowy"
  | "foggy";

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

export interface WeatherRangeSelectorProps {
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
  meetingPointLocation?: MeetingPointLocation | null;
  onMeetingPointLocationChange?: (value: MeetingPointLocation | null) => void;
  sessionNote: string;
  onSessionNoteChange: (value: string) => void;
}

/* ─── Constants ───────────────────────────────────────────────────────────────── */
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_SHORT = [
  "Jan","Feb","Mar","Apr","May","Jun",
  "Jul","Aug","Sep","Oct","Nov","Dec",
];
const DURATION_OPTIONS = [1, 2, 3, 5, 7, 10, 14];
/** open-meteo free tier max */
const FORECAST_DAYS = 16;

/* ─── Date helpers ────────────────────────────────────────────────────────────── */
function startOfToday(): Date {
  const d = new Date(); d.setHours(0, 0, 0, 0); return d;
}
function toDateOnly(d: Date): string {
  return `${d.getFullYear()}-${`${d.getMonth()+1}`.padStart(2,"0")}-${`${d.getDate()}`.padStart(2,"0")}`;
}
function parseDateOnly(v: string): Date {
  const [y,m,d] = v.split("-").map(Number);
  return new Date(y,(m||1)-1,d||1,0,0,0,0);
}
function addDays(v: string, n: number): string {
  const d = parseDateOnly(v); d.setDate(d.getDate()+n); return toDateOnly(d);
}
function diffDaysInclusive(start: string, end: string): number {
  return Math.floor((parseDateOnly(end).getTime()-parseDateOnly(start).getTime())/86400000)+1;
}
function combine(dateOnly: string, time: string): string { return `${dateOnly}T${time}`; }
function extractDate(dt: string): string { return dt ? dt.slice(0,10) : ""; }
function extractTime(dt: string, fallback: string): string {
  if (!dt || !dt.includes("T")) return fallback; return dt.slice(11,16)||fallback;
}
function meetingPointToAddress(value?: MeetingPointLocation | null): AddressResponse | null {
  if (!value) return null;

  return {
    id: value.placeId ?? `${value.latitude}:${value.longitude}`,
    provider: "locationiq",
    providerPlaceId: value.placeId ?? `${value.latitude}:${value.longitude}`,
    displayName: value.address || value.label,
    governorate: null,
    delegation: null,
    locality: null,
    latitude: value.latitude,
    longitude: value.longitude,
    usesCount: null,
  };
}
function addressToMeetingPoint(value: AddressResponse): MeetingPointLocation {
  return {
    label: value.displayName,
    address: value.displayName,
    latitude: value.latitude,
    longitude: value.longitude,
    placeId: value.providerPlaceId ?? value.id ?? null,
    source: "LOCATIONIQ",
  };
}
function formatLabel(dateStr: string): string {
  const d = parseDateOnly(dateStr);
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;
}
function formatCard(dateStr: string) {
  const d = parseDateOnly(dateStr);
  return { dow: DAY_NAMES[d.getDay()], day: d.getDate(), month: MONTH_SHORT[d.getMonth()] };
}

/* ─── Weather mapping ─────────────────────────────────────────────────────────── */
function mapCode(code: number): { condition: WeatherCondition; label: string } {
  if (code === 0) return { condition: "sunny", label: "Clear sky" };
  if ([1,2].includes(code)) return { condition: "partly-cloudy", label: "Partly cloudy" };
  if (code === 3) return { condition: "cloudy", label: "Overcast" };
  if ([45,48].includes(code)) return { condition: "foggy", label: "Foggy" };
  if ([95,96,99].includes(code)) return { condition: "stormy", label: "Thunderstorm" };
  if ([71,73,75,77,85,86].includes(code)) return { condition: "snowy", label: "Snow" };
  if ([51,53,55,56,57,61,63,65,66,67,80,81,82].includes(code)) return { condition: "rainy", label: "Rain" };
  return { condition: "cloudy", label: "Variable" };
}

function buildForecast(res: Awaited<ReturnType<typeof getDailyForecast>>|null): ForecastDay[] {
  if (!res?.daily?.time?.length) return [];
  return res.daily.time.map((date,i) => {
    const code = res.daily.weathercode[i]??0;
    const {condition,label} = mapCode(code);
    return {
      date, code, condition, label,
      tempMax: res.daily.temperature_2m_max[i]??0,
      tempMin: res.daily.temperature_2m_min[i]??0,
      rain: res.daily.precipitation_probability_max[i]??0,
      wind: res.daily.windspeed_10m_max[i]??0,
    };
  });
}

function isBad(day: ForecastDay): boolean { return day.rain >= 60 || day.condition === "stormy"; }
function isGood(day: ForecastDay): boolean { return day.rain < 20 && ["sunny","partly-cloudy"].includes(day.condition); }

/* ─── Weather icons ───────────────────────────────────────────────────────────── */
const WeatherIcon = ({
  condition, size = 32, inverted = false,
}: { condition: WeatherCondition; size?: number; inverted?: boolean }) => {
  const s = size;
  const sun = inverted ? "#FDE68A" : "#F59E0B";
  const cloud = inverted ? "rgba(255,255,255,0.9)" : "#94A3B8";
  const rain = inverted ? "#BAE6FD" : "#60A5FA";
  const storm = inverted ? "rgba(255,255,255,0.7)" : "#64748B";
  const snow = inverted ? "rgba(255,255,255,0.8)" : "#CBD5E1";
  const fog = inverted ? "rgba(255,255,255,0.7)" : "#94A3B8";
  const lightning = inverted ? "#FDE68A" : "#FCD34D";

  const map: Record<WeatherCondition, JSX.Element> = {
    sunny: (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="4.2" fill={sun}/>
        {[0,45,90,135,180,225,270,315].map(deg=>(
          <line key={deg}
            x1={12+Math.cos(deg*Math.PI/180)*6.8} y1={12+Math.sin(deg*Math.PI/180)*6.8}
            x2={12+Math.cos(deg*Math.PI/180)*9.2} y2={12+Math.sin(deg*Math.PI/180)*9.2}
            stroke={sun} strokeWidth="1.8" strokeLinecap="round"/>
        ))}
      </svg>
    ),
    "partly-cloudy": (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <circle cx="9.5" cy="9" r="3.5" fill={sun} opacity="0.9"/>
        <path d="M7.5 17.5a5 5 0 1 1 0-10 3.5 3.5 0 0 1 6.83-.5A3 3 0 1 1 17.5 17.5z" fill={cloud}/>
      </svg>
    ),
    cloudy: (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <path d="M4.5 18.5a5.5 5.5 0 1 1 0-11 4 4 0 0 1 7.74-.5A3.5 3.5 0 1 1 18 18.5z" fill={cloud}/>
      </svg>
    ),
    rainy: (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <path d="M4.5 13a5.5 5.5 0 1 1 0-11 4 4 0 0 1 7.74-.5A3.5 3.5 0 1 1 18 13z" fill={cloud}/>
        <line x1="8" y1="16" x2="6.5" y2="20.5" stroke={rain} strokeWidth="1.8" strokeLinecap="round"/>
        <line x1="12" y1="16" x2="10.5" y2="20.5" stroke={rain} strokeWidth="1.8" strokeLinecap="round"/>
        <line x1="16" y1="16" x2="14.5" y2="20.5" stroke={rain} strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    ),
    stormy: (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <path d="M3.5 13a5.5 5.5 0 1 1 0-11 4 4 0 0 1 7.74-.5A3.5 3.5 0 1 1 17 13z" fill={storm}/>
        <polyline points="13,15 10,19 13,19 10,23" stroke={lightning} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      </svg>
    ),
    snowy: (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <path d="M4.5 13a5.5 5.5 0 1 1 0-11 4 4 0 0 1 7.74-.5A3.5 3.5 0 1 1 18 13z" fill={snow}/>
        <circle cx="8" cy="17.5" r="1.3" fill={rain}/><circle cx="12" cy="19.5" r="1.3" fill={rain}/><circle cx="16" cy="17.5" r="1.3" fill={rain}/>
      </svg>
    ),
    foggy: (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <line x1="3" y1="8" x2="21" y2="8" stroke={fog} strokeWidth="1.8" strokeLinecap="round"/>
        <line x1="3" y1="12" x2="21" y2="12" stroke={fog} strokeWidth="1.8" strokeLinecap="round"/>
        <line x1="5" y1="16" x2="19" y2="16" stroke={fog} strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
    ),
  };
  return map[condition]??map["cloudy"];
};

/* ─── SkeletonCard ────────────────────────────────────────────────────────────── */
function SkeletonCard({ index }: { index: number }) {
  return (
    <div className={styles.skeletonCard} style={{ animationDelay: `${index*60}ms` }}>
      <div className={styles.skeletonPill} style={{ width:"44%",height:9 }}/>
      <div className={styles.skeletonPill} style={{ width:"60%",height:20,marginTop:4 }}/>
      <div className={styles.skeletonCircle}/>
      <div className={styles.skeletonPill} style={{ width:"70%",height:18,marginTop:4 }}/>
      <div className={styles.skeletonPill} style={{ width:"50%",height:12,marginTop:5 }}/>
    </div>
  );
}

/* ─── DayCard ─────────────────────────────────────────────────────────────────── */
interface DayCardProps {
  day: ForecastDay;
  isToday: boolean;
  isStart: boolean;
  isEnd: boolean;
  isSingle: boolean;
  inRange: boolean;
  inPreview: boolean;
  isPotentialEnd: boolean;
  isBestDay: boolean;
  animIndex: number;
  onClick: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  cardRef: (el: HTMLButtonElement|null) => void;
}

function DayCard({
  day, isToday, isStart, isEnd, isSingle, inRange, inPreview,
  isPotentialEnd, isBestDay, animIndex, onClick, onMouseEnter, onMouseLeave, cardRef,
}: DayCardProps) {
  const { dow, day: dayNum, month } = formatCard(day.date);
  const isSelected = isStart || isEnd;
  const hasBadWeather = isBad(day);

  const cls = [
    styles.dayCard,
    isSelected ? styles.dayCardSelected : "",
    isStart && !isSingle ? styles.dayCardStart : "",
    isEnd && !isSingle ? styles.dayCardEnd : "",
    isSingle && isSelected ? styles.dayCardSingle : "",
    inRange ? styles.dayCardRange : "",
    inPreview ? styles.dayCardPreview : "",
    isPotentialEnd ? styles.dayCardPotentialEnd : "",
    isToday && !isSelected ? styles.dayCardToday : "",
    hasBadWeather && !isSelected ? styles.dayCardBad : "",
  ].filter(Boolean).join(" ");

  const dowLabel = isStart ? (isSingle?"PICK":"START →") : isEnd ? ("→ END") : dow;

  return (
    <button
      ref={cardRef}
      type="button"
      className={cls}
      style={{ animationDelay:`${animIndex*35}ms` }}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      aria-label={`${dow} ${dayNum} ${month}: ${day.label}, ${Math.round(day.tempMax)}°/${Math.round(day.tempMin)}°, rain ${day.rain}%`}
      aria-pressed={isSelected}
    >
      {hasBadWeather && !isSelected && (
        <span className={styles.badgeBad} aria-hidden="true" title="Bad weather">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </span>
      )}
      {isBestDay && !hasBadWeather && !isSelected && (
        <span className={styles.badgeBest} aria-label="Best day">★</span>
      )}
      {isToday && !isSelected && (
        <span className={styles.todayLabel} aria-hidden="true">Today</span>
      )}

      <span className={styles.cardDow}>{dowLabel}</span>
      <span className={styles.cardDayNum}>{dayNum}</span>
      <span className={styles.cardMonth}>{month}</span>

      <span className={styles.cardIconWrap}>
        <WeatherIcon condition={day.condition} size={30} inverted={isSelected}/>
      </span>

      <span className={styles.cardTemps}>
        <span className={styles.cardTempMax}>{Math.round(day.tempMax)}°</span>
        <span className={styles.cardTempMin}>{Math.round(day.tempMin)}°</span>
      </span>

      <span className={styles.cardRain} data-bad={day.rain >= 60}>
        <svg width="8" height="8" viewBox="0 0 12 14" fill="none" aria-hidden="true">
          <path d="M6 1L1 8a5 5 0 0 0 10 0L6 1z" fill="currentColor"/>
        </svg>
        {day.rain}%
      </span>
    </button>
  );
}

/* ─── Detail Panel ────────────────────────────────────────────────────────────── */
function DayDetailPanel({ day, onClose }: { day: ForecastDay|null; onClose:()=>void }) {
  const isVisible = !!day;
  return (
    <div className={`${styles.detailPanel} ${isVisible ? styles.detailPanelVisible : ""}`} role="region" aria-label="Day details">
      {day && (
        <div className={styles.detailInner}>
          <button type="button" className={styles.detailClose} onClick={onClose} aria-label="Close detail panel">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>

          <div className={styles.detailHeader}>
            <WeatherIcon condition={day.condition} size={40} inverted={false}/>
            <div className={styles.detailHeaderText}>
              <div className={styles.detailDateLabel}>{formatLabel(day.date)}</div>
              <div className={styles.detailCondition}>{day.label}</div>
            </div>
            <div className={styles.detailTemps}>
              <span className={styles.detailTempHigh}>{Math.round(day.tempMax)}°</span>
              <span className={styles.detailTempLow}>{Math.round(day.tempMin)}°</span>
            </div>
          </div>

          <div className={styles.detailStats}>
            <div className={styles.detailStat}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a5 5 0 0 1 5 5v4a5 5 0 0 1-10 0V7a5 5 0 0 1 5-5z"/><path d="M8 18a7 7 0 0 0 8 0"/>
              </svg>
              <span className={styles.detailStatLabel}>Rain</span>
              <span className={styles.detailStatVal} data-warn={day.rain>=60}>{day.rain}%</span>
            </div>
            <div className={styles.detailStat}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2"/><path d="M9.6 4.6A2 2 0 1 1 11 8H2"/><path d="M12.6 19.4A2 2 0 1 0 14 16H2"/>
              </svg>
              <span className={styles.detailStatLabel}>Wind</span>
              <span className={styles.detailStatVal}>{Math.round(day.wind)} km/h</span>
            </div>
            <div className={styles.detailStat}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/>
              </svg>
              <span className={styles.detailStatLabel}>Feels like</span>
              <span className={styles.detailStatVal}>{Math.round(day.tempMax - 2)}°</span>
            </div>
            <div className={styles.detailStat}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
              </svg>
              <span className={styles.detailStatLabel}>Condition</span>
              <span className={styles.detailStatVal}>{day.label}</span>
            </div>
          </div>

          <div className={styles.detailBarGraph}>
            <div className={styles.detailBarLabel}>Temperature range</div>
            <div className={styles.detailBarTrack}>
              <div className={styles.detailBarRange}
                style={{
                  left: `${((day.tempMin + 10) / 50) * 100}%`,
                  width: `${((day.tempMax - day.tempMin) / 50) * 100}%`,
                }}
              />
              <span className={styles.detailBarMinLabel}>{Math.round(day.tempMin)}°</span>
              <span className={styles.detailBarMaxLabel}>{Math.round(day.tempMax)}°</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Range Summary ───────────────────────────────────────────────────────────── */
interface RangeSummaryData { goodDays:number; badDays:number; avgMax:number; bestDay:ForecastDay|null; }

function RangeSummaryBar({
  summary, startDate, endDate,
}: { summary:RangeSummaryData; startDate:string; endDate:string }) {
  return (
    <div className={styles.rangeOverview}>
      <div className={styles.rangeOverviewLabel}>
        Range overview · {formatLabel(startDate)} → {formatLabel(endDate)}
      </div>
      <div className={styles.rangeOverviewMetrics}>
        <div className={styles.overviewMetric}>
          <span className={styles.overviewMetricVal}>{summary.avgMax}°C</span>
          <span className={styles.overviewMetricKey}>avg high</span>
        </div>
        <div className={`${styles.overviewMetric} ${styles.overviewMetricGood}`}>
          <span className={styles.overviewMetricVal}>{summary.goodDays}</span>
          <span className={styles.overviewMetricKey}>good days</span>
        </div>
        <div className={`${styles.overviewMetric} ${summary.badDays > 0 ? styles.overviewMetricWarn : ""}`}>
          <span className={styles.overviewMetricVal}>{summary.badDays}</span>
          <span className={styles.overviewMetricKey}>risky days</span>
        </div>
        {summary.bestDay && (
          <div className={`${styles.overviewMetric} ${styles.overviewMetricBest}`}>
            <span className={styles.overviewMetricVal}>★ {formatLabel(summary.bestDay.date)}</span>
            <span className={styles.overviewMetricKey}>best pick</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Out-of-range weather notice ─────────────────────────────────────────────── */
function OutOfRangeNotice({ startDate, forecastEnd }: { startDate: string; forecastEnd: string }) {
  return (
    <div className={styles.outOfRangeNotice}>
      <div className={styles.oorIcon} aria-hidden="true">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9z"/>
          <line x1="12" y1="11" x2="12" y2="13"/><circle cx="12" cy="16" r="0.5" fill="currentColor"/>
        </svg>
      </div>
      <div className={styles.oorText}>
        <p className={styles.oorTitle}>Weather data unavailable for this date</p>
        <p className={styles.oorHint}>
          Forecasts are available up to <strong>{formatLabel(forecastEnd)}</strong>.
          Your selected start (<strong>{formatLabel(startDate)}</strong>) is beyond this window.
          Check back closer to your activity date for accurate conditions.
        </p>
      </div>
    </div>
  );
}

/* ─── Section header helper ───────────────────────────────────────────────────── */
function SectionLabel({ number, title, subtitle }: { number: string; title: string; subtitle?: string }) {
  return (
    <div className={styles.sectionLabel}>
      <span className={styles.sectionNum}>{number}</span>
      <div>
        <div className={styles.sectionTitle}>{title}</div>
        {subtitle && <div className={styles.sectionSubtitle}>{subtitle}</div>}
      </div>
    </div>
  );
}

/* ─── Main component ──────────────────────────────────────────────────────────── */
export default function WeatherRangeSelector({
  locationName = "Your activity location",
  latitude, longitude,
  startAt, endAt,
  onStartAtChange, onEndAtChange,
  capacity, onCapacityChange,
  meetingPoint, onMeetingPointChange,
  meetingPointLocation, onMeetingPointLocationChange,
  sessionNote, onSessionNoteChange,
}: WeatherRangeSelectorProps) {

  /* ── Data state ── */
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const [forecast, setForecast] = useState<ForecastDay[]>([]);

  /* ── Interaction state ── */
  const [hoverDate, setHoverDate] = useState<string|null>(null);
  const [focusedDay, setFocusedDay] = useState<ForecastDay|null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  /* ── Refs ── */
  const scrollRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  /* ── Derived ── */
  const hasCoords = latitude != null && longitude != null;
  const today = toDateOnly(startOfToday());

  /** Last date the forecast covers (today + 15 days, 0-indexed) */
  const forecastEnd = useMemo(() => addDays(today, FORECAST_DAYS - 1), [today]);

  const selStart = extractDate(startAt);
  const selEnd = extractDate(endAt);
  const t0 = extractTime(startAt, "08:00");
  const t1 = extractTime(endAt, "17:00");

  const phase: "none"|"start-only"|"range" =
    !selStart ? "none" : selStart === selEnd ? "start-only" : "range";

  const durationDays = useMemo(() => {
    if (!selStart || !selEnd || selEnd < selStart) return 0;
    return diffDaysInclusive(selStart, selEnd);
  }, [selStart, selEnd]);

  /**
   * True when the user has picked a start date that lies beyond the
   * 16-day forecast window. In this case we never render the timeline.
   */
  const startOutOfRange = !!selStart && selStart > forecastEnd;

  /* ── Best day computation ── */
  const bestDay = useMemo(() => {
    if (!forecast.length) return null;
    const futureDays = forecast.filter(d => d.date >= today);
    if (!futureDays.length) return null;
    return [...futureDays].sort((a,b) => a.rain - b.rain || b.tempMax - a.tempMax)[0];
  }, [forecast, today]);

  /* ── Load forecast ── */
  useEffect(() => {
    if (!hasCoords) { setForecast([]); setError(null); setLoading(false); return; }
    let cancelled = false;
    setLoading(true); setError(null);
    getDailyForecast(latitude!, longitude!)
      .then(res => { if (!cancelled) setForecast(buildForecast(res)); })
      .catch(err => { if (!cancelled) { setForecast([]); setError(err instanceof Error ? err.message : "Failed to load forecast"); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [hasCoords, latitude, longitude]);

  /* ── Scroll tracking ── */
  const syncScrollBtns = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    syncScrollBtns();
    el.addEventListener("scroll", syncScrollBtns, { passive: true });
    const ro = new ResizeObserver(syncScrollBtns);
    ro.observe(el);
    return () => { el.removeEventListener("scroll", syncScrollBtns); ro.disconnect(); };
  }, [forecast, syncScrollBtns]);

  /* ── Auto-scroll to start ── */
  useEffect(() => {
    if (!selStart) return;
    const card = cardRefs.current.get(selStart);
    const container = scrollRef.current;
    if (!card || !container) return;
    container.scrollTo({ left: Math.max(0, card.offsetLeft - 64), behavior: "smooth" });
  }, [selStart]);

  /* ── Scroll helpers ── */
  function scrollPage(dir: -1|1) {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  }

  /* ── Date setters ── */
  function applyStart(dateOnly: string) {
    const d = dateOnly < today ? today : dateOnly;
    onStartAtChange(combine(d, t0));
    onEndAtChange(combine(d, t1));
  }
  function applyDuration(days: number) {
    if (!selStart) return;
    onEndAtChange(combine(addDays(selStart, days-1), t1));
  }
  function clearSelection() {
    onStartAtChange(""); onEndAtChange(""); setHoverDate(null);
  }

  /* ── Timeline interaction ── */
  function handleDayClick(date: string) {
    if (!selStart || date < selStart) {
      applyStart(date);
    } else if (date === selStart && phase === "start-only") {
      // no-op
    } else {
      onEndAtChange(combine(date, t1));
      setHoverDate(null);
    }
  }

  function handleDayHover(day: ForecastDay) {
    setHoverDate(day.date);
  }

  /* ── Preview range ── */
  const previewEnd = phase === "start-only" && hoverDate && hoverDate > selStart ? hoverDate : null;

  const isInRange = useCallback(
    (date: string) => !!selStart && !!selEnd && date > selStart && date < selEnd,
    [selStart, selEnd]
  );
  const isInPreview = useCallback(
    (date: string) => !!previewEnd && !!selStart && date > selStart && date < previewEnd,
    [selStart, previewEnd]
  );

  /* ── Range analytics ── */
  const rangeDays = useMemo(() => {
    if (phase !== "range") return [];
    return forecast.filter(d => d.date >= selStart && d.date <= selEnd);
  }, [forecast, selStart, selEnd, phase]);

  const rangeSummary = useMemo((): RangeSummaryData|null => {
    if (!rangeDays.length) return null;
    const goodDays = rangeDays.filter(d => !isBad(d) && isGood(d)).length;
    const badDays = rangeDays.filter(isBad).length;
    const avgMax = Math.round(rangeDays.reduce((s,d) => s+d.tempMax,0)/rangeDays.length);
    const bestDayInRange = [...rangeDays].sort((a,b) => a.rain-b.rain||b.tempMax-a.tempMax)[0]??null;
    return { goodDays, badDays, avgMax, bestDay: bestDayInRange };
  }, [rangeDays]);

  const badInRange = rangeDays.filter(isBad);

  /* ── Card ref reg ── */
  function setCardRef(date: string) {
    return (el: HTMLButtonElement|null) => {
      if (el) cardRefs.current.set(date, el);
      else cardRefs.current.delete(date);
    };
  }

  const canShowForecast = hasCoords && !loading && !error && forecast.length > 0 && !startOutOfRange;

  /* ── Range bar text ── */
  const rangeBarContent = (() => {
    if (phase === "none") return "Pick a start date to see weather for your trip";
    if (phase === "start-only") {
      const h = hoverDate && hoverDate > selStart ? hoverDate : null;
      if (h) return `${formatLabel(selStart)} → ${formatLabel(h)} · ${diffDaysInclusive(selStart,h)} days`;
      return `Start: ${formatLabel(selStart)} — now pick your end date`;
    }
    return `${formatLabel(selStart)} → ${formatLabel(selEnd)} · ${durationDays} day${durationDays!==1?"s":""}`;
  })();

  /* ─────────────────────────────────────────────────────────────────────────────
     RENDER
     Layout: single vertical column — no sidebar, no collapsible panel.

     Section 1 · When  — date pickers + quick-duration chips
     Section 2 · Weather forecast — timeline (conditional: in-range, oor, no-location)
     Section 3 · Session details — capacity, meeting point, notes
  ───────────────────────────────────────────────────────────────────────────── */
  return (
    <div className={styles.shell}>

      {/* ── Page heading ────────────────────────────────────────────────────── */}
      <div className={styles.pageHead}>
        <div className={styles.pageHeadLeft}>
          <p className={styles.eyebrow}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
            </svg>
            {locationName}
          </p>
          <h2 className={styles.pageTitle}>Schedule your session</h2>
        </div>

        {/* Live selection badge — only when a range is active */}
        {phase === "range" && (
          <div className={styles.selectionBadge} aria-live="polite">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            <span>{rangeBarContent}</span>
            {badInRange.length > 0 && (
              <span className={styles.warnChip}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                {badInRange.length} risky
              </span>
            )}
            <button type="button" className={styles.clearBtn} onClick={clearSelection}>Clear</button>
          </div>
        )}
      </div>

      {/* ── Divider ─────────────────────────────────────────────────────────── */}
      <div className={styles.pageDivider} />

      {/* ════════════════════════════════════════════════════════════════════
          SECTION 1 — WHEN
      ═════════════════════════════════════════════════════════════════════ */}
      <section className={styles.section}>
        <SectionLabel number="1" title="When is your activity?" subtitle="Set the exact dates and times" />

        {/* Date + time row */}
        <div className={styles.dateTimeGrid}>
          {/* Start */}
          <div className={styles.dateBlock}>
            <span className={styles.dateBlockLabel}>Start</span>
            <div className={styles.dateBlockFields}>
              <label className={styles.fieldInline}>
                <span className={styles.fieldIcon}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                </span>
                <input
                  type="date" className={styles.inputDate}
                  min={today} value={selStart}
                  onChange={e => applyStart(e.target.value)}
                />
              </label>
              <label className={styles.fieldInline}>
                <span className={styles.fieldIcon}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                  </svg>
                </span>
                <input
                  type="time" className={styles.inputTime}
                  value={t0}
                  onChange={e => onStartAtChange(combine(selStart||today, e.target.value))}
                />
              </label>
            </div>
          </div>

          <div className={styles.dateArrow} aria-hidden="true">→</div>

          {/* End */}
          <div className={styles.dateBlock}>
            <span className={styles.dateBlockLabel}>End</span>
            <div className={styles.dateBlockFields}>
              <label className={styles.fieldInline}>
                <span className={styles.fieldIcon}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                </span>
                <input
                  type="date" className={styles.inputDate}
                  min={selStart||today} value={selEnd}
                  onChange={e => { if (e.target.value) onEndAtChange(combine(e.target.value, t1)); }}
                />
              </label>
              <label className={styles.fieldInline}>
                <span className={styles.fieldIcon}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                  </svg>
                </span>
                <input
                  type="time" className={styles.inputTime}
                  value={t1}
                  onChange={e => onEndAtChange(combine(selEnd||selStart||today, e.target.value))}
                />
              </label>
            </div>
          </div>
        </div>

        {/* Quick duration chips */}
        <div className={styles.durationRow}>
          <span className={styles.durationLabel}>Quick duration</span>
          <div className={styles.chips}>
            {DURATION_OPTIONS.map(days => (
              <button
                key={days} type="button"
                className={[styles.chip, durationDays===days ? styles.chipActive : ""].filter(Boolean).join(" ")}
                disabled={!selStart}
                onClick={() => applyDuration(days)}
              >
                {days===1 ? "1 day" : `${days}d`}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════
          SECTION 2 — WEATHER FORECAST
          Conditionally renders one of four states:
            a) No location set
            b) Loading
            c) Error
            d) Start date beyond forecast window → OutOfRangeNotice
            e) Forecast timeline
      ═════════════════════════════════════════════════════════════════════ */}
      <section className={styles.section}>
        <SectionLabel
          number="2"
          title="Check the forecast"
          subtitle={hasCoords ? "Tap any day to set as start, tap another to set end" : "Add a location first to see weather"}
        />

        {/* a) no coordinates */}
        {!hasCoords && (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}>🗺️</span>
            <p className={styles.emptyTitle}>No location set yet</p>
            <p className={styles.emptyHint}>Go back to Step 3 and pick a meeting point to unlock the weather forecast.</p>
          </div>
        )}

        {/* b) loading */}
        {hasCoords && loading && (
          <div className={styles.timelineWrap}>
            <div className={styles.timelineHeader}>
              <span className={styles.timelineTitle}>Loading forecast…</span>
            </div>
            <div className={styles.timeline}>
              {Array.from({length:10}).map((_,i) => <SkeletonCard key={i} index={i}/>)}
            </div>
          </div>
        )}

        {/* c) error */}
        {hasCoords && !loading && error && (
          <div className={`${styles.emptyState} ${styles.emptyStateError}`}>
            <p className={styles.emptyTitle}>Couldn't load forecast</p>
            <p className={styles.emptyHint}>{error}</p>
          </div>
        )}

        {/* d) start date is beyond the 16-day window */}
        {hasCoords && !loading && !error && startOutOfRange && selStart && (
          <OutOfRangeNotice startDate={selStart} forecastEnd={forecastEnd} />
        )}

        {/* e) normal forecast timeline */}
        {canShowForecast && (
          <div className={styles.timelineWrap}>
            <div className={styles.timelineHeader}>
              <div className={styles.timelineHeaderLeft}>
                <span className={styles.timelineTitle}>
                  {forecast.length}-day forecast
                </span>
                <span className={styles.timelineHint}>
                  {phase==="none"
                    ? "Tap a day to mark your start"
                    : phase==="start-only"
                    ? "Now tap to set your end date"
                    : `${durationDays} day${durationDays!==1?"s":""} selected — click to adjust`}
                </span>
              </div>
              <div className={styles.navGroup}>
                <button type="button" className={styles.navBtn}
                  onClick={() => scrollPage(-1)} disabled={!canScrollLeft} aria-label="Scroll left">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 18l-6-6 6-6"/>
                  </svg>
                </button>
                <button type="button" className={styles.navBtn}
                  onClick={() => scrollPage(1)} disabled={!canScrollRight} aria-label="Scroll right">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 18l6-6-6-6"/>
                  </svg>
                </button>
              </div>
            </div>

            <div className={styles.timelineScrollArea}>
              <div className={[styles.fadeEdge, styles.fadeLeft, canScrollLeft ? styles.fadeVisible : ""].filter(Boolean).join(" ")} aria-hidden="true" />
              <div ref={scrollRef} className={styles.timeline} onMouseLeave={() => setHoverDate(null)}>
                {forecast.map((day,i) => {
                  const isStart = day.date === selStart;
                  const isEnd   = day.date === selEnd;
                  const single  = selStart === selEnd && isStart;
                  return (
                    <DayCard
                      key={day.date}
                      day={day}
                      isToday={day.date === today}
                      isStart={isStart}
                      isEnd={isEnd}
                      isSingle={single}
                      inRange={isInRange(day.date)}
                      inPreview={isInPreview(day.date)}
                      isPotentialEnd={day.date === previewEnd}
                      isBestDay={bestDay?.date === day.date}
                      animIndex={i}
                      onClick={() => handleDayClick(day.date)}
                      onMouseEnter={() => { handleDayHover(day); setFocusedDay(day); }}
                      onMouseLeave={() => { setHoverDate(null); }}
                      cardRef={setCardRef(day.date)}
                    />
                  );
                })}
              </div>
              <div className={[styles.fadeEdge, styles.fadeRight, canScrollRight ? styles.fadeVisible : ""].filter(Boolean).join(" ")} aria-hidden="true" />
            </div>

            <DayDetailPanel day={focusedDay} onClose={() => setFocusedDay(null)}/>

            {rangeSummary && (
              <RangeSummaryBar summary={rangeSummary} startDate={selStart} endDate={selEnd}/>
            )}
          </div>
        )}
      </section>

      {/* ════════════════════════════════════════════════════════════════════
          SECTION 3 — SESSION DETAILS
          Capacity + meeting point + note — always visible, never collapsed.
      ═════════════════════════════════════════════════════════════════════ */}
      <section className={styles.section}>
        <SectionLabel number="3" title="Session details" subtitle="Logistics participants will need" />

        <div className={styles.detailsGrid}>
          {/* Capacity */}
          <label className={styles.detailField}>
            <span className={styles.detailFieldLabel}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              Max capacity
            </span>
            <div className={styles.capacityRow}>
              <input
                type="number" className={`${styles.inputField} ${styles.inputNarrow}`}
                min={3} value={capacity}
                onChange={e => { const v=Math.max(3,Math.floor(Number(e.target.value))); if(!isNaN(v)) onCapacityChange(v); }}
              />
              <span className={styles.capacityHint}>participants minimum 3</span>
            </div>
          </label>

          {/* Meeting point */}
          <div className={`${styles.detailField} ${styles.detailFieldFull}`}>
            <LocationPicker
              label="Session meeting point"
              value={meetingPointToAddress(meetingPointLocation)}
              onChange={(value) => {
                const next = value ? addressToMeetingPoint(value) : null;
                onMeetingPointLocationChange?.(next);
                onMeetingPointChange(next?.label ?? "");
              }}
              placeholder="Trailhead, café, parking lot…"
            />
            {meetingPoint && !meetingPointLocation && (
              <div className={styles.emptyHint}>
                Existing text meeting point: {meetingPoint}
              </div>
            )}
          </div>
        </div>

        {/* Session note — full width below the grid */}
        <label className={`${styles.detailField} ${styles.detailFieldFull}`}>
          <span className={styles.detailFieldLabel}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
            </svg>
            Session note
            <span className={styles.optionalTag}>optional</span>
          </span>
          <textarea
            className={`${styles.inputField} ${styles.inputTextarea}`}
            rows={3} value={sessionNote}
            onChange={e => onSessionNoteChange(e.target.value)}
            placeholder="What participants should know before arriving — gear needed, access codes, parking tips…"
          />
        </label>
      </section>

    </div>
  );
}
