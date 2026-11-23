import { Sun, Cloud, CloudSun, CloudRain, CloudLightning, CloudSnow, CloudFog } from 'lucide-react'
import './DailyForecast.css'

// Shown only while the real forecast is loading
const pretendDays = [
  { name: 'Today', Icon: CloudSun, rain: 5, low: 14, high: 20 },
  { name: 'Sat', Icon: Sun, rain: 0, low: 14, high: 19 },
  { name: 'Sun', Icon: Cloud, rain: 20, low: 13, high: 18 },
  { name: 'Mon', Icon: CloudRain, rain: 60, low: 13, high: 17 },
  { name: 'Tue', Icon: CloudSun, rain: 10, low: 12, high: 18 },
]

// Picks an icon for a weather word
function iconFor(weatherWord) {
  if (weatherWord === 'Clear') return Sun
  if (weatherWord === 'Clouds') return Cloud
  if (weatherWord === 'Rain' || weatherWord === 'Drizzle') return CloudRain
  if (weatherWord === 'Thunderstorm') return CloudLightning
  if (weatherWord === 'Snow') return CloudSnow
  return CloudFog
}

// Turns a date like "2026-10-27" into "Tue" or "Oct 27"
function formatDate(date, options) {
  return new Date(`${date}T12:00`).toLocaleDateString('en-US', options)
}

// Loops over the forecast's 3-hour steps and makes one summary per day
function toDays(forecast) {
  const days = []

  for (const step of forecast.list) {
    const date = step.dt_txt.slice(0, 10)            // "2026-10-27 15:00:00" → "2026-10-27"
    let day = days.find((d) => d.date === date)      // do we already have this day?

    if (!day) {                                      // no → start a new day
      day = { date, low: step.main.temp_min, high: step.main.temp_max, rain: 0, weatherWord: step.weather[0].main }
      days.push(day)
    }

    day.low = Math.min(day.low, step.main.temp_min)  // keep the coldest
    day.high = Math.max(day.high, step.main.temp_max) // keep the warmest
    day.rain = Math.max(day.rain, step.pop)          // keep the highest rain chance
    if (step.dt_txt.includes('12:00')) {
      day.weatherWord = step.weather[0].main         // the midday weather describes the day best
    }
  }

  return days.slice(0, 5).map((day, index) => ({
    date: day.date,
    name: index === 0 ? 'Today' : formatDate(day.date, { weekday: 'short' }),
    Icon: iconFor(day.weatherWord),
    rain: Math.round(day.rain * 100),
    low: Math.round(day.low),
    high: Math.round(day.high),
  }))
}

function DailyForecast({ forecast }) {
  const days = forecast ? toDays(forecast) : pretendDays

  const dateRange = forecast
    ? `${formatDate(days[0].date, { month: 'short', day: 'numeric' })} – ${formatDate(days[days.length - 1].date, { day: 'numeric' })}`
    : 'Oct 23 – 27'

  // The coldest and warmest temperature of the whole week
  const weekLow = Math.min(...days.map((day) => day.low))
  const weekHigh = Math.max(...days.map((day) => day.high))
  const weekRange = Math.max(1, weekHigh - weekLow)
  
  // Find the rainiest day with a loop, and write a sentence about it
  let rainiest = days[0]
  for (const day of days) {
    if (day.rain > rainiest.rain) {
      rainiest = day
    }
  }
  const summary = rainiest.rain >= 50
    ? `Rain likely on ${rainiest.name === 'Today' ? 'today' : rainiest.name}, up to ${rainiest.rain}%.`
    : 'A mostly dry few days ahead.'

  return (
    <section className="daily-forecast">
      <div className="forecast-heading">
        <h2 className="forecast-title">5-day forecast</h2>
        <p className="forecast-dates">{dateRange}</p>
      </div>

      <ul className="forecast-list">
        {days.map(({ name, Icon, rain, low, high }) => (
          <li key={name} className="forecast-row">
            <span className="forecast-day">{name}</span>
            <Icon
              size={22}
              strokeWidth={1.5}
              className={Icon === Sun ? 'icon-sun' : 'icon-cloud'}
            />
            <span className={rain >= 50 ? 'forecast-rain wet' : 'forecast-rain'}>
              {rain}%
            </span>
            <span className="forecast-low">{low}°</span>
            <span className="forecast-bar">
              <span
                className="forecast-fill"
                style={{
                  left: `${((low - weekLow) / weekRange) * 100}%`,
                  width: `${((high - low) / weekRange) * 100}%`,
                }}
              />
            </span>
            <span className="forecast-high">{high}°</span>
          </li>
        ))}
      </ul>

      <p className="forecast-summary">{summary}</p>
          </section>
  )
}

export default DailyForecast