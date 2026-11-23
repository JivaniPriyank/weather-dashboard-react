import './LocationHeader.css'

// Turns a country code like "DE" into a full name like "Germany"
const countryNames = new Intl.DisplayNames(['en'], { type: 'region' })

function LocationHeader({ weather }) {
  // Turn the raw data into what we show (or a placeholder while it's loading)
  const city = weather ? weather.name : 'Loading…'
  const country = weather ? countryNames.of(weather.sys.country) : ''

  return (
    <section className="location-header">
      <div className="location">
        <p className="region">{country.toUpperCase()}</p>
        <h1 className="city">{city}</h1>
      </div>

      <div className="local-time">
        <p className="date">Friday, October 23, 2026</p>
        <p className="updated">
          <span className="status-dot">●</span>
          Updated at 10:42 AM PDT
        </p>
      </div>
    </section>
  )
}

export default LocationHeader