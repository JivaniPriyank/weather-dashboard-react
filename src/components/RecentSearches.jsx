import { History } from 'lucide-react'
import './RecentSearches.css'

function RecentSearches({ cities, currentCity, onSelect }) {
  if (cities.length === 0) return null      // nothing searched yet → show nothing

  return (
    <div className="recent-searches">
      <span className="recent-label">
        <History size={14} />
        Recent
      </span>

      {cities.map((name) => (
        <button
          key={name}
          type="button"
          className={name === currentCity ? 'recent-chip active' : 'recent-chip'}
          onClick={() => onSelect(name)}
        >
          {name}
        </button>
      ))}
    </div>
  )
}

export default RecentSearches