import {
  MapPin, Bookmark, Thermometer, Wind, Droplets, CloudRain,
  Sun, Moon, Cloud, CloudSun, CloudLightning, CloudSnow, CloudFog,
} from 'lucide-react'
import './CurrentWeather.css'

// Turns wind degrees (0–360) into a compass word like "WNW"
function toCompass(degrees) {
  const directions = [
    'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
    'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW',
  ]
  return directions[Math.round(degrees / 22.5) % 16]
}

// Picks an icon for the current weather (a moon for clear nights)
function iconFor(current) {
  const isNight = current.icon.endsWith('n')
  if (current.main === 'Clear') return isNight ? Moon : Sun
  if (current.main === 'Clouds') return Cloud
  if (current.main === 'Rain' || current.main === 'Drizzle') return CloudRain
  if (current.main === 'Thunderstorm') return CloudLightning
  if (current.main === 'Snow') return CloudSnow
  return CloudFog
}

function CurrentWeather({ condition, weather, forecast }) {
  // From the current weather (or placeholders while it's still loading)
  const temperature = weather ? Math.round(weather.main.temp) : '--'
  const feelsLike = weather ? Math.round(weather.main.feels_like) : '--'
  const humidity = weather ? weather.main.humidity : '--'
  const windSpeed = weather ? Math.round(weather.wind.speed * 3.6) : '--'
  const windDirection = weather ? toCompass(weather.wind.deg) : ''
  const description = weather ? weather.weather[0].description : 'loading…'
  const conditionName = description.charAt(0).toUpperCase() + description.slice(1)
  const ConditionIcon = weather ? iconFor(weather.weather[0]) : CloudSun

  // From the forecast: the next 24 hours (8 reports of 3 hours)
  const next24 = forecast ? forecast.list.slice(0, 8) : []
  const high = forecast ? Math.round(Math.max(...next24.map((step) => step.main.temp_max))) : '--'
  const low = forecast ? Math.round(Math.min(...next24.map((step) => step.main.temp_min))) : '--'
  const rainChance = forecast ? Math.round(forecast.list[0].pop * 100) : '--'

  return (
    <section className={`current-weather ${condition}`}>
      <div className="weather-top">
        <div>
          <p className="weather-label">
            <MapPin size={13} /> CURRENT WEATHER
          </p>

          <div className="temperature-row">
            <p className="temperature">{temperature}°</p>
            <div className="condition">
              <ConditionIcon size={38} strokeWidth={1.5} />
              <p className="condition-name">{conditionName}</p>
              <p className="daily-range">High {high}°   /   Low {low}°</p>
            </div>
          </div>
        </div>

        <button type="button" className="save-button">
          <Bookmark size={14} /> Save location
        </button>
      </div>

      <div className="weather-bottom">
        <div className="observations">
          <div className="observation">
            <p className="observation-label"><Thermometer size={14} /> Feels like</p>
            <p className="observation-value">{feelsLike}°</p>
          </div>
          <div className="observation">
            <p className="observation-label"><Wind size={14} /> Wind</p>
            <p className="observation-value">{windDirection} {windSpeed} km/h</p>
          </div>
          <div className="observation">
            <p className="observation-label"><Droplets size={14} /> Humidity</p>
            <p className="observation-value">{humidity}%</p>
          </div>
          <div className="observation">
            <p className="observation-label"><CloudRain size={14} /> Chance of rain</p>
            <p className="observation-value">{rainChance}%</p>
          </div>
        </div>

        <div className="outlook">
          <p className="outlook-title">A little cloud. A lot of possibility.</p>
          <p className="outlook-text">
            A bright afternoon ahead, with a gentle ocean breeze.
            A good day to take the long way home.
          </p>
        </div>
      </div>
    </section>
  )
}

export default CurrentWeather