export type DailyWeather = {
  time: string[];
  weathercode: number[];
  weather_code?: number[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  precipitation_probability_max: number[];
  windspeed_10m_max: number[];
  wind_speed_10m_max?: number[];
};

export type WeatherForecastResponse = {
  daily: DailyWeather;
};

/**
 * Fetch a 16-day daily forecast from open-meteo.
 * The window is always anchored to today (regardless of user selection),
 * so the timeline always shows today → today+15.
 *
 * open-meteo free tier supports up to 16 forecast days.
 */
export async function getDailyForecast(lat: number, lon: number, days = 16) {
  const safeDays = Math.min(Math.max(Math.trunc(days) || 16, 1), 16);

  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    daily: [
      "weather_code",
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_probability_max",
      "wind_speed_10m_max",
    ].join(","),
    forecast_days: String(safeDays),
    timezone: "auto",
  });

  const res = await fetch(
    `https://api.open-meteo.com/v1/forecast?${params.toString()}`
  );

  if (!res.ok) {
    throw new Error("Failed to load weather forecast");
  }

  const data = (await res.json()) as WeatherForecastResponse;
  const daily = data.daily;

  return {
    ...data,
    daily: {
      ...daily,
      weathercode: daily.weathercode ?? daily.weather_code ?? [],
      windspeed_10m_max: daily.windspeed_10m_max ?? daily.wind_speed_10m_max ?? [],
    },
  };
}
