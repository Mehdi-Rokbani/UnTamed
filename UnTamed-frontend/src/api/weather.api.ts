export type DailyWeather = {
  time: string[];
  weathercode: number[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  precipitation_probability_max: number[];
  windspeed_10m_max: number[];
};

export type WeatherForecastResponse = {
  daily: DailyWeather;
};

function toDateOnly(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Fetch a 16-day daily forecast from open-meteo.
 * The window is always anchored to today (regardless of user selection),
 * so the timeline always shows today → today+15.
 *
 * open-meteo free tier supports up to 16 forecast days.
 */
export async function getDailyForecast(lat: number, lon: number, days = 16) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const endDate = new Date(today);
  endDate.setDate(today.getDate() + Math.min(days, 16) - 1);

  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    daily: [
      "weathercode",
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_probability_max",
      "windspeed_10m_max",
    ].join(","),
    start_date: toDateOnly(today),
    end_date: toDateOnly(endDate),
    timezone: "auto",
  });

  const res = await fetch(
    `https://api.open-meteo.com/v1/forecast?${params.toString()}`
  );

  if (!res.ok) {
    throw new Error("Failed to load weather forecast");
  }

  return (await res.json()) as WeatherForecastResponse;
}