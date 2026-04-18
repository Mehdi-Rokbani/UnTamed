export function getWeatherLabel(code: number): string {
  if (code === 0) return "Clear";
  if ([1, 2, 3].includes(code)) return "Partly cloudy";
  if ([45, 48].includes(code)) return "Fog";
  if ([51, 53, 55, 56, 57].includes(code)) return "Drizzle";
  if ([61, 63, 65, 66, 67].includes(code)) return "Rain";
  if ([71, 73, 75, 77].includes(code)) return "Snow";
  if ([80, 81, 82].includes(code)) return "Rain showers";
  if ([85, 86].includes(code)) return "Snow showers";
  if ([95, 96, 99].includes(code)) return "Thunderstorm";
  return "Unknown";
}

export function getWeatherMood(
  rainChance: number,
  windSpeed: number,
  weatherCode: number
): "great" | "okay" | "risky" {
  if ([95, 96, 99].includes(weatherCode)) return "risky";
  if (rainChance >= 60 || windSpeed >= 35) return "risky";
  if (rainChance >= 30 || windSpeed >= 20) return "okay";
  return "great";
}

export function formatDateOnly(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}