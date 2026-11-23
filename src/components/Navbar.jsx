import { useState } from 'react'
import { CloudSun, Search, LocateFixed } from 'lucide-react'
import './Navbar.css'

function Navbar({ onSearch, onLocate }) {   // two remote-control buttons from App 📺
  // Memory box for the text typed in the search box (starts empty)
  const [query, setQuery] = useState('')

  // Does this browser have the "find my location" tool?
  const canLocate = 'geolocation' in navigator

  // Runs when the form is sent (Enter pressed in the search box)
  function handleSubmit(event) {
    event.preventDefault()                 // stop the browser from reloading the page

    const city = query.trim()              // clean up: remove spaces at the start and end

    if (!city) {                           // empty text is "falsy" → nothing to search
      console.log('Please type a city first')
      return                               // stop here, don't search
    }

    onSearch(city)                         // tell App: show this city
    setQuery('')                           // empty the search box, ready for the next city
  }

  // Runs when the ⊕ button is clicked
  function handleLocate() {
    if (!canLocate) {
      console.log('Sorry, this browser cannot find your location')
      return
    }

    // Ask the browser: "Where am I?"
    navigator.geolocation.getCurrentPosition(
      (position) => {
        // ✅ Plan A: found you → tell App to show this spot
        onLocate(position.coords.latitude, position.coords.longitude)
      },
      (error) => {
        // ❌ Plan B: blocked, or the location couldn't be found
        console.log('Could not get your location:', error.message)
      }
    )
  }

  return (
    <header className="navbar">
      <div className="brand">
        <CloudSun size={32} />
        <span className="brand-name">atmosphere</span>
      </div>

      <nav className="nav-links">
        <a href="#" className="nav-link active">Overview</a>
        <a href="#" className="nav-link">Weather maps</a>
        <a href="#" className="nav-link">Saved places</a>
      </nav>

      <div className="location-controls">
        <form className="search-form" id="search-form" onSubmit={handleSubmit}>
          <Search size={16} />
          <input
            type="text"
            id="city-input"
            className="search-input"
            placeholder="Search city or zip code"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <span className="shortcut">⌘ K</span>
        </form>

        <button
          type="button"
          className="locate-button"
          aria-label="Use my location"
          title={canLocate ? 'Use my location' : 'Your browser cannot find your location'}
          onClick={handleLocate}
          disabled={!canLocate}
        >
          <LocateFixed size={18} />
        </button>

        <div className="unit-toggle">
          <button type="button" className="unit active">°C</button>
          <button type="button" className="unit">°F</button>
        </div>
      </div>
    </header>
  )
}

export default Navbar