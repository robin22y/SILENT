import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { StockList } from './components/StockList'
import { StockDetail } from './components/StockDetail'
import { JournalPage } from './pages/JournalPage'
import { AuthPage } from './pages/AuthPage'
import { AdminPage } from './pages/AdminPage'

function App() {
  return (
    <Router
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <div className="min-h-screen bg-gray-50">
        <Routes>
          <Route path="/" element={<StockList />} />
          <Route path="/stock/:ticker" element={<StockDetail />} />
          <Route path="/journal" element={<JournalPage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </div>
    </Router>
  )
}

export default App


