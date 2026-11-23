// Everything that talks to the weather website lives here

const API_KEY = import.meta.env.VITE_WEATHER_API_KEY
const BASE_URL = 'https://api.openweathermap.org/data/2.5'

// Asks the weather website about a city, and waits for the answer
export async function getCurrentWeather(city) {
  // 1. Build the address with the form filled in
  const url = `${BASE_URL}/weather?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=metric`

  // 2. Call the website and wait
  const response = await fetch(url)

  // 3. Check the answer is OK before opening it
  if (!response.ok) {
    throw new Error(`Weather request failed: ${response.status} ${response.statusText}`)
  }

  // 4. Open the box
  const data = await response.json()
  return data
}

// Asks for the 5-day forecast (one report every 3 hours = 40 reports)
export async function getForecast(city) {
  const url = `${BASE_URL}/forecast?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=metric`
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Forecast request failed: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

// NEW: asks for the current weather at an exact spot on the map (latitude + longitude)
export async function getCurrentWeatherByCoords(lat, lon) {
  const url = `${BASE_URL}/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Weather request failed: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

// NEW: asks for the 5-day forecast at an exact spot on the map
export async function getForecastByCoords(lat, lon) {
  const url = `${BASE_URL}/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Forecast request failed: ${response.status} ${response.statusText}`)
  }

  return response.json()
}