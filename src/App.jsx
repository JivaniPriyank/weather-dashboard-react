import { useState, useEffect } from 'react'
import Navbar from './components/Navbar.jsx'
import LoadingIndicator from './components/LoadingIndicator.jsx'
import ErrorMessage from './components/ErrorMessage.jsx'
import LocationHeader from './components/LocationHeader.jsx'
import CurrentWeather from './components/CurrentWeather.jsx'
import HourlyForecast from './components/HourlyForecast.jsx'
import DailyForecast from './components/DailyForecast.jsx'
import { getCurrentWeather, getForecast } from './api/weather.js'
import RecentSearches from './components/RecentSearches.jsx'
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
    const saved = localStorage.getItem(HISTORY_KEY)   // text, or null if nothing saved yet
    return saved ? JSON.parse(saved) : []             // unpack the text back into a list
  } catch {
    return []                                         // notebook broken or blocked → start empty
  }
}

function App() {
  const [city, setCity] = useState('Berlin')
  const [condition, setCondition] = useState('clouds')
  const [weather, setWeather] = useState(null)
  const [forecast, setForecast] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [history, setHistory] = useState(loadHistory)   // last searched cities, read once at the start

  // Every time the history changes, write it into the notebook
  useEffect(() => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history))   // pack the list into text
  }, [history])

  useEffect(() => {
    async function loadWeather() {
      setLoading(true)
      setError(null)
      try {
        const [current, forecastData] = await Promise.all([
          getCurrentWeather(city),
          getForecast(city),
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
        setError(toFriendlyMessage(error, city))
      } finally {
        setLoading(false)
      }
    }

    loadWeather()
  }, [city])

  return (
    <>
      <Navbar onSearch={setCity} />
      {loading && <LoadingIndicator />}
      <main className="page">
        {error && <ErrorMessage message={error} />}
        <LocationHeader weather={weather} />
        <RecentSearches
          cities={history}
          currentCity={weather ? weather.name : null}
          onSelect={setCity}
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