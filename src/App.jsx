import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { StockList } from './components/StockList'
import { StockDetail } from './components/StockDetail'

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
        </Routes>
      </div>
    </Router>
  )
}

export default App


