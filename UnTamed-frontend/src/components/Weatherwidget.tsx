// WeatherWidget.tsx — Premium weather widget for Activity Details
// Drop-in replacement for the inline weather block inside the sidebar

import type { CSSProperties } from "react";

type SessionWeatherDay = {
  date: string;
  weatherCode: number;
  tempMax: number;
  tempMin: number;
  precipitationMax: number;
  windMax: number;
};

type SessionWeather = {
  mode: "single" | "range";
  days: SessionWeatherDay[];
};

// ─── helpers ───────────────────────────────────────────────────────────────

function weatherLabel(code: number) {
  if (code === 0) return "Clear sky";
  if ([1, 2, 3].includes(code)) return "Partly cloudy";
  if ([45, 48].includes(code)) return "Foggy";
  if ([51, 53, 55, 56, 57].includes(code)) return "Drizzle";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "Rain";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "Snow";
  if ([95, 96, 99].includes(code)) return "Thunderstorm";
  return "Partly cloudy";
}

function weatherGradient(code: number): [string, string] {
  if (code === 0) return ["#4a90d9", "#87c1f0"];         // clear — vivid sky blue
  if ([1, 2, 3].includes(code)) return ["#5b8fbf", "#8fb8d8"]; // partly cloudy — softer
  if ([45, 48].includes(code)) return ["#7a8fa6", "#a8b8c8"]; // fog — muted steel
  if ([51, 53, 55].includes(code)) return ["#4a7fa0", "#6da8c8"]; // drizzle
  if ([61, 63, 65, 80, 81, 82].includes(code)) return ["#3a6080", "#5a8aaa"]; // rain
  if ([71, 73, 75].includes(code)) return ["#6a8aa0", "#9bbbd0"]; // snow
  if ([95, 96, 99].includes(code)) return ["#2a3f52", "#4a5f72"]; // storm
  return ["#4a90d9", "#87c1f0"];
}

function WeatherIcon({ code, size = 28 }: { code: number; size?: number }) {
  const s = size;
  const strokeW = s < 20 ? 1.5 : 2;

  // Clear sun
  if (code === 0) return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="5" fill="rgba(255,220,80,0.95)" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
        <line key={deg} x1="12" y1="3.5" x2="12" y2="5.5"
          stroke="rgba(255,220,80,0.9)" strokeWidth={strokeW} strokeLinecap="round"
          transform={`rotate(${deg} 12 12)`} />
      ))}
    </svg>
  );

  // Partly cloudy
  if ([1, 2, 3].includes(code)) return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <circle cx="9" cy="9" r="3.5" fill="rgba(255,220,80,0.9)" />
      {[0, 60, 120, 180, 240, 300].map((deg) => (
        <line key={deg} x1="9" y1="2" x2="9" y2="3.5"
          stroke="rgba(255,220,80,0.85)" strokeWidth="1.5" strokeLinecap="round"
          transform={`rotate(${deg} 9 9)`} />
      ))}
      <rect x="4" y="13" width="16" height="6" rx="3" fill="rgba(255,255,255,0.85)" />
    </svg>
  );

  // Rain / drizzle
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="5" width="18" height="7" rx="3.5" fill="rgba(255,255,255,0.75)" />
      {[7, 11, 15, 19].map((x, i) => (
        <line key={x} x1={x} y1="15" x2={x - 2} y2="20"
          stroke="rgba(120,190,255,0.9)" strokeWidth="1.8" strokeLinecap="round"
          style={{ animationDelay: `${i * 0.15}s` }} />
      ))}
    </svg>
  );

  // Snow
  if ([71, 73, 75, 77].includes(code)) return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="4" width="18" height="7" rx="3.5" fill="rgba(255,255,255,0.8)" />
      {[7, 12, 17].map((x) => (
        <circle key={x} cx={x} cy="18" r="1.5" fill="rgba(200,230,255,0.95)" />
      ))}
    </svg>
  );

  // Fog
  if ([45, 48].includes(code)) return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      {[6, 10, 14, 18].map((y) => (
        <rect key={y} x="3" y={y} width="18" height="2" rx="1" fill="rgba(255,255,255,0.6)" />
      ))}
    </svg>
  );

  // Thunderstorm
  if ([95, 96, 99].includes(code)) return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <rect x="2" y="4" width="20" height="8" rx="4" fill="rgba(255,255,255,0.6)" />
      <polyline points="13,14 10,19 13,19 10,24" stroke="rgba(255,230,80,0.95)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );

  // Default
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="8" width="18" height="8" rx="4" fill="rgba(255,255,255,0.8)" />
    </svg>
  );
}

function formatDayShort(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function formatDayAbbr(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return "Today";
  return d.toLocaleDateString("en-US", { weekday: "short" });
}

// ─── Component ──────────────────────────────────────────────────────────────

interface WeatherWidgetProps {
  weather: SessionWeather;
  location?: string;
  activityDateLabel: string;
}

export function WeatherWidget({ weather, location = "Activity Location", activityDateLabel }: WeatherWidgetProps) {
  const primary = weather.days[0];
  if (!primary) return null;

  const [gradFrom, gradTo] = weatherGradient(primary.weatherCode);
  const avgMax = Math.round(weather.days.reduce((s, d) => s + d.tempMax, 0) / weather.days.length);
  const avgMin = Math.round(weather.days.reduce((s, d) => s + d.tempMin, 0) / weather.days.length);
  const maxRain = Math.round(Math.max(...weather.days.map((d) => d.precipitationMax)));
  const label = weatherLabel(primary.weatherCode);
  const isRange = weather.mode === "range" && weather.days.length > 1;

  return (
    <div style={outer}>
      {/* Gradient hero */}
      <div style={{ ...hero, background: `linear-gradient(145deg, ${gradFrom} 0%, ${gradTo} 100%)` }}>
        {/* Subtle light orb */}
        <div style={orb} />

        <div style={heroContent}>
          <div style={locationRow}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2" strokeLinecap="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" />
            </svg>
            <span style={locationText}>{location}</span>
          </div>

          <div style={tempRow}>
            <span style={bigTemp}>{Math.round(primary.tempMax)}°</span>
            <div style={iconWrap}>
              <WeatherIcon code={primary.weatherCode} size={48} />
            </div>
          </div>

          <div style={conditionRow}>
            <span style={conditionText}>{label}</span>
            {isRange && (
              <span style={rangePill}>{weather.days.length}-day trip</span>
            )}
          </div>
        </div>
      </div>

      {/* Stats strip */}
      <div style={statsStrip}>
        <StatPill icon="thermo" label="Range" value={`${avgMin}° – ${avgMax}°`} />
        <div style={statDivider} />
        <StatPill icon="drop" label="Rain" value={`${maxRain}%`} color={maxRain > 50 ? "#3b82f6" : undefined} />
        <div style={statDivider} />
        <StatPill icon="wind" label="Wind" value={`${Math.round(primary.windMax)} km/h`} />
      </div>

      {/* Day forecast (range only) */}
      {isRange && (
        <div style={forecastRow}>
          {weather.days.slice(0, 6).map((day) => (
            <DayPill key={day.date} day={day} />
          ))}
        </div>
      )}

      {/* Single day label */}
      {!isRange && (
        <p style={footNote}>Forecast for {activityDateLabel}. May change closer to the date.</p>
      )}
      {isRange && (
        <p style={footNote}>Forecast for {activityDateLabel}. May change closer to dates.</p>
      )}
    </div>
  );
}

function StatPill({ icon, label, value, color }: { icon: string; label: string; value: string; color?: string }) {
  return (
    <div style={statPill}>
      <div style={statIcon}>
        {icon === "thermo" && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6b7a70" strokeWidth="2" strokeLinecap="round">
            <path d="M14 14.76V3.5a2.5 2.5 0 00-5 0v11.26a4.5 4.5 0 105 0z" />
          </svg>
        )}
        {icon === "drop" && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color ?? "#6b7a70"} strokeWidth="2" strokeLinecap="round">
            <path d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z" />
          </svg>
        )}
        {icon === "wind" && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6b7a70" strokeWidth="2" strokeLinecap="round">
            <path d="M9.59 4.59A2 2 0 1111 8H2m10.59 11.41A2 2 0 1014 16H2m15.73-8.27A2.5 2.5 0 1119.5 12H2" />
          </svg>
        )}
      </div>
      <div>
        <div style={statLabel}>{label}</div>
        <div style={{ ...statValue, ...(color ? { color } : {}) }}>{value}</div>
      </div>
    </div>
  );
}

function DayPill({ day }: { day: SessionWeatherDay }) {
  return (
    <div style={dayPill}>
      <div style={dayAbbr}>{formatDayAbbr(day.date)}</div>
      <div style={dayIcon}><WeatherIcon code={day.weatherCode} size={20} /></div>
      <div style={dayTemp}>{Math.round(day.tempMax)}°</div>
      {day.precipitationMax > 20 && (
        <div style={dayRain}>{Math.round(day.precipitationMax)}%</div>
      )}
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const outer: CSSProperties = {
  borderRadius: 16,
  overflow: "hidden",
  border: "1px solid rgba(232,228,222,0.8)",
  background: "#fff",
  marginTop: 2,
};

const hero: CSSProperties = {
  position: "relative",
  padding: "20px 20px 18px",
  overflow: "hidden",
};

const orb: CSSProperties = {
  position: "absolute",
  top: -30,
  right: -30,
  width: 140,
  height: 140,
  borderRadius: "50%",
  background: "rgba(255,255,255,0.12)",
  pointerEvents: "none",
};

const heroContent: CSSProperties = {
  position: "relative",
  zIndex: 1,
};

const locationRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 5,
  marginBottom: 10,
};

const locationText: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: "rgba(255,255,255,0.8)",
  letterSpacing: "0.05em",
  textTransform: "uppercase",
};

const tempRow: CSSProperties = {
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "space-between",
  marginBottom: 6,
};

const bigTemp: CSSProperties = {
  fontSize: 52,
  fontWeight: 800,
  color: "#fff",
  lineHeight: 1,
  letterSpacing: "-0.03em",
};

const iconWrap: CSSProperties = {
  marginBottom: 4,
  filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.12))",
};

const conditionRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const conditionText: CSSProperties = {
  fontSize: 14,
  color: "rgba(255,255,255,0.9)",
  fontWeight: 500,
};

const rangePill: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  color: "rgba(255,255,255,0.8)",
  background: "rgba(255,255,255,0.18)",
  backdropFilter: "blur(8px)",
  padding: "2px 8px",
  borderRadius: 20,
  letterSpacing: "0.03em",
};

const statsStrip: CSSProperties = {
  display: "flex",
  alignItems: "center",
  padding: "12px 16px",
  background: "#fafaf9",
  borderBottom: "1px solid rgba(232,228,222,0.6)",
};

const statPill: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 7,
  flex: 1,
};

const statIcon: CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 8,
  background: "rgba(45,95,62,0.06)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const statDivider: CSSProperties = {
  width: 1,
  height: 28,
  background: "rgba(232,228,222,0.8)",
  margin: "0 10px",
};

const statLabel: CSSProperties = {
  fontSize: 9,
  fontWeight: 700,
  color: "#9aaa9f",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  marginBottom: 1,
};

const statValue: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: "#1a1a1a",
};

const forecastRow: CSSProperties = {
  display: "flex",
  gap: 6,
  padding: "12px 14px",
  overflowX: "auto",
  scrollbarWidth: "none",
  msOverflowStyle: "none",
};

const dayPill: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 4,
  minWidth: 48,
  padding: "8px 6px",
  borderRadius: 12,
  background: "#f7f5f0",
  border: "1px solid rgba(232,228,222,0.6)",
  flexShrink: 0,
};

const dayAbbr: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  color: "#6b7a70",
  letterSpacing: "0.02em",
};

const dayIcon: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const dayTemp: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: "#1a1a1a",
};

const dayRain: CSSProperties = {
  fontSize: 9,
  fontWeight: 700,
  color: "#3b82f6",
};

const footNote: CSSProperties = {
  fontSize: 10,
  color: "#9aaa9f",
  margin: "0",
  padding: "8px 16px 12px",
  lineHeight: 1.5,
};