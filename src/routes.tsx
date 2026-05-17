import { Routes, Route } from 'react-router-dom'
import Inbox from './pages/Inbox'
import Settings from './pages/Settings'

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Inbox />} />
      <Route path="/brief/:id" element={<Inbox />} />
      <Route path="/settings" element={<Settings />} />
    </Routes>
  )
}
