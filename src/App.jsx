import { useState, useEffect } from 'react'
import Navbar from './components/Navbar.jsx'
import LoadingIndicator from './components/LoadingIndicator.jsx'
import ErrorMessage from './components/ErrorMessage.jsx'
import LocationHeader from './components/LocationHeader.jsx'
import CurrentWeather from './components/CurrentWeather.jsx'
import HourlyForecast from './components/HourlyForecast.jsx'
import DailyForecast from './components/DailyForecast.jsx'
import { getCurrentWeather, getForecast } from './api/weather.js'
import './App.css'

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

function App() {
  const [city, setCity] = useState('Berlin')
  const [condition, setCondition] = useState('clouds')
  const [weather, setWeather] = useState(null)
  const [forecast, setForecast] = useState(null)
  const [loading, setLoading] = useState(true)     // is the weather on its way? yes at the start
  const [error, setError] = useState(null)         // the friendly error text; null = no problem

  useEffect(() => {
    async function loadWeather() {
      setLoading(true)                              // show the pill
      setError(null)                                // new search: forget the old error
      try {
        const [current, forecastData] = await Promise.all([
          getCurrentWeather(city),
          getForecast(city),
        ])
        setWeather(current)
        setForecast(forecastData)
        setCondition(toBackdrop(current.weather[0].main))
      } catch (error) {
        console.error('Could not load the weather:', error.message)   // for us developers
        setError(toFriendlyMessage(error, city))                       // for the people using the app
      } finally {
        setLoading(false)                           // hide the pill, success or failure
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