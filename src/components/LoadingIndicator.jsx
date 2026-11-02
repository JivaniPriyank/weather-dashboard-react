import { LoaderCircle } from 'lucide-react'
import './LoadingIndicator.css'

function LoadingIndicator() {
  return (
    <div className="loading-indicator" role="status">
      <LoaderCircle size={16} className="loading-spinner" />
      <span>Loading weather…</span>
    </div>
  )
}

export default LoadingIndicator