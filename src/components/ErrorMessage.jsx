import { CircleAlert } from 'lucide-react'
import './ErrorMessage.css'

function ErrorMessage({ message }) {
  return (
    <div className="error-message" role="alert">
      <CircleAlert size={18} />
      <span>{message}</span>
    </div>
  )
}

export default ErrorMessage