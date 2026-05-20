import { Routes, Route } from 'react-router-dom'
import Inbox from './pages/Inbox'
import Settings from './pages/Settings'
import Atmaja from './pages/Atmaja'
import WorkMapDetail from './pages/WorkMapDetail'

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Inbox />} />
      <Route path="/brief/:id" element={<Inbox />} />
      <Route path="/workmap/:role/:lane" element={<WorkMapDetail />} />
      <Route path="/atmaja" element={<Atmaja />} />
      <Route path="/settings" element={<Settings />} />
    </Routes>
  )
}
