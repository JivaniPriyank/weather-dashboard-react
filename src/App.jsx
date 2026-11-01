import { useState, useEffect } from 'react'
import Navbar from './components/Navbar.jsx'
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

function App() {
  const [city, setCity] = useState('Berlin')       // which city to show; Berlin at the start
  const [condition, setCondition] = useState('clouds')
  const [weather, setWeather] = useState(null)
  const [forecast, setForecast] = useState(null)

  useEffect(() => {
    async function loadWeather() {
      try {
        const [current, forecastData] = await Promise.all([
          getCurrentWeather(city),
          getForecast(city),
        ])
        setWeather(current)
        setForecast(forecastData)
        setCondition(toBackdrop(current.weather[0].main))
      } catch (error) {
        console.error('Could not load the weather:', error.message)
      }
    }

    loadWeather()
  }, [city])   // run again every time the city changes

  return (
    <>
      <Navbar onSearch={setCity} />
      <main className="page">
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