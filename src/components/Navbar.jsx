import { CloudSun, Search, LocateFixed } from 'lucide-react'
import './Navbar.css'
import { useState } from 'react'
function Navbar() {
  
    // Memory box for the text typed in the search box (starts empty)
  const [query, setQuery] = useState('')
  
  // Runs when the form is sent (Enter pressed in the search box)
     function handleSubmit(event) {
    event.preventDefault()             // don't reload the page

    const city = query.trim()          // remove extra spaces

    if (!city) {                       // empty text is "falsy" → nothing to search
      console.log('Please type a city first')
      return                           // stop here
    }

    console.log('Searching for:', city)
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

        <button type="button" className="locate-button" aria-label="Use my location">
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