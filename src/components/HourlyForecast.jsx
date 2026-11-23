import {
  Sun, Moon, Cloud, CloudSun, CloudRain, CloudLightning, CloudSnow, CloudFog, Droplet,
} from 'lucide-react'
import './HourlyForecast.css'

// Shown only while the real forecast is loading
const pretendHours = [
  { time: '11 AM', Icon: CloudSun, temp: 18, rain: 5 },
  { time: '12 PM', Icon: CloudSun, temp: 19, rain: 5 },
  { time: '1 PM', Icon: Sun, temp: 20, rain: 0 },
  { time: '2 PM', Icon: Sun, temp: 20, rain: 0 },
  { time: '3 PM', Icon: Sun, temp: 19, rain: 0 },
  { time: '4 PM', Icon: CloudSun, temp: 18, rain: 5 },
  { time: '5 PM', Icon: CloudSun, temp: 17, rain: 5 },
  { time: '6 PM', Icon: CloudSun, temp: 16, rain: 10 },
]

// Picks an icon for one forecast report (a moon for clear nights)
function iconFor(step) {
  const weatherWord = step.weather[0].main
  const isNight = step.weather[0].icon.endsWith('n')

  if (weatherWord === 'Clear') return isNight ? Moon : Sun
  if (weatherWord === 'Clouds') return Cloud
  if (weatherWord === 'Rain' || weatherWord === 'Drizzle') return CloudRain
  if (weatherWord === 'Thunderstorm') return CloudLightning
  if (weatherWord === 'Snow') return CloudSnow
  return CloudFog
}

// Turns the next 8 forecast reports into 8 columns
function toHours(forecast) {
  return forecast.list.slice(0, 8).map((step) => ({
    time: new Date(step.dt * 1000).toLocaleTimeString('en-US', { hour: 'numeric' }),
    Icon: iconFor(step),
    temp: Math.round(step.main.temp),
    rain: Math.round(step.pop * 100),
  }))
}

function HourlyForecast({ forecast }) {
  const hours = forecast ? toHours(forecast) : pretendHours

  // Find the warmest hour with a loop
  let warmest = hours[0]
  for (const hour of hours) {
    if (hour.temp > warmest.temp) {
      warmest = hour
    }
  }

  return (
    <section className="hourly-forecast">
      <div className="hourly-heading">
        <h2 className="hourly-title">The day ahead</h2>
        <p className="hourly-subtitle">{forecast ? 'Next 24 hours' : 'Next 8 hours'}</p>
      </div>

      <ul className="hourly-list">
        {hours.map(({ time, Icon, temp, rain }) => (
          <li key={time} className="hour">
            <span className="hour-time">{time}</span>
            <Icon
              size={27}
              strokeWidth={1.5}
              className={Icon === Sun ? 'icon-sun' : 'icon-cloud'}
            />
            <span className="hour-temp">{temp}°</span>
            <span className="hour-rain">
              <Droplet size={10} /> {rain}%
            </span>
          </li>
        ))}
      </ul>

      <p className="hourly-summary">
        <Sun size={14} className="icon-sun" />
        Warmest at {warmest.time}, reaching {warmest.temp}°.
      </p>
    </section>
  )
}

export default HourlyForecast