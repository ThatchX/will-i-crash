import { Navigate } from 'react-router-dom'

export default function LegacyHomeRedirect() {
  return <Navigate to="/" replace />
}
