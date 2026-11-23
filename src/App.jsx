import { useState, useEffect } from 'react'
import Navbar from './components/Navbar.jsx'
import LoadingIndicator from './components/LoadingIndicator.jsx'
import ErrorMessage from './components/ErrorMessage.jsx'
import RecentSearches from './components/RecentSearches.jsx'
import LocationHeader from './components/LocationHeader.jsx'
import CurrentWeather from './components/CurrentWeather.jsx'
import HourlyForecast from './components/HourlyForecast.jsx'
import DailyForecast from './components/DailyForecast.jsx'
import {
  getCurrentWeather,
  getForecast,
  getCurrentWeatherByCoords,
  getForecastByCoords,
} from './api/weather.js'
import './App.css'

const HISTORY_KEY = 'searchHistory'   // the name of our page in the browser's notebook

// Turns the weather website's word into one of our backdrop names
function toBackdrop(weatherWord) {
  if (weatherWord === 'Clear') return 'clear'
  if (weatherWord === 'Clouds') return 'clouds'
  if (weatherWord === 'Rain' || weatherWord === 'Drizzle') return 'rain'
  if (weatherWord === 'Thunderstorm') return 'storm'
  if (weatherWord === 'Snow') return 'snow'
  return 'mist'
}

// Turns a computer error into a sentence a human understands
function toFriendlyMessage(error, city) {
  if (error.message.includes('404')) {
    return `We couldn't find "${city}". Check the spelling and try again.`
  }
  if (error.message.includes('401')) {
    return 'The weather service did not accept our key. Please try again later.'
  }
  if (error.message.includes('Failed to fetch')) {
    return 'No internet connection. Check your Wi-Fi and try again.'
  }
  return 'Something went wrong while loading the weather. Please try again.'
}

// Reads the saved cities from the browser's notebook (or an empty list)
function loadHistory() {
  try {
    const saved = localStorage.getItem(HISTORY_KEY)
    return saved ? JSON.parse(saved) : []
  } catch {
    return []
  }
}

function App() {
  // Where to show the weather: either { city: 'Paris' } or { lat: 51.4, lon: 6.7 }
  const [place, setPlace] = useState({ city: 'Berlin' })   // Berlin = the backup plan 🛟
  const [condition, setCondition] = useState('clouds')
  const [weather, setWeather] = useState(null)
  const [forecast, setForecast] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [history, setHistory] = useState(loadHistory)

  // Typed a city or clicked a Recent button → show that city
  function showCity(name) {
    setPlace({ city: name })
  }

  // Location found → show that exact spot on the map
  function showSpot(lat, lon) {
    setPlace({ lat: lat, lon: lon })
  }

  // When the page opens: try to find where the user is (only once)
  useEffect(() => {
    if (!('geolocation' in navigator)) return        // no location tool → stay on Berlin

    navigator.geolocation.getCurrentPosition(
      (position) => {
        showSpot(position.coords.latitude, position.coords.longitude)   // ✅ found you
      },
      (error) => {
        console.log('Location not available, showing Berlin:', error.message)   // ❌ stay on Berlin
      }
    )
  }, [])

  // Every time the history changes, write it into the notebook
  useEffect(() => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
  }, [history])

  // Every time the place changes, load its weather
  useEffect(() => {
    async function loadWeather() {
      setLoading(true)
      setError(null)
      try {
        // A city name? Ask by name. Otherwise ask by coordinates.
        const [current, forecastData] = place.city
          ? await Promise.all([getCurrentWeather(place.city), getForecast(place.city)])
          : await Promise.all([
              getCurrentWeatherByCoords(place.lat, place.lon),
              getForecastByCoords(place.lat, place.lon),
            ])

        setWeather(current)
        setForecast(forecastData)
        setCondition(toBackdrop(current.weather[0].main))

        // Success → add the city to the front of the history (no doubles, max 5)
        setHistory((oldHistory) => {
          const others = oldHistory.filter(
            (name) => name.toLowerCase() !== current.name.toLowerCase()
          )
          return [current.name, ...others].slice(0, 5)
        })
      } catch (error) {
        console.error('Could not load the weather:', error.message)
        setError(toFriendlyMessage(error, place.city || 'your location'))
      } finally {
        setLoading(false)
      }
    }

    loadWeather()
  }, [place])

  return (
    <>
      <Navbar onSearch={showCity} onLocate={showSpot} />
      {loading && <LoadingIndicator />}
      <main className="page">
        {error && <ErrorMessage message={error} />}
        <LocationHeader weather={weather} />
        <RecentSearches
          cities={history}
          currentCity={weather ? weather.name : null}
          onSelect={showCity}
        />
        <CurrentWeather condition={condition} weather={weather} forecast={forecast} />
        <div className="forecasts">
          <HourlyForecast forecast={forecast} />
          <DailyForecast forecast={forecast} />
        </div>
      </main>
    </>
  )
}

export default App