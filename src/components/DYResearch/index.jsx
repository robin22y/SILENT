import { useState } from 'react'
import { Link } from 'react-router-dom'
import { DecisionButtons } from './DecisionButtons'
import { ChartLink } from './ChartLink'
import { ResearchQuestions } from './ResearchQuestions'
import { PDFGenerator } from './PDFGenerator'
import { UserNameInput } from './UserNameInput'

export function DYResearch({ ticker, stock, user }) {
  if (!user) {
    return (
      <div className="mt-8 bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
        <h2 className="text-xl font-bold mb-2">D.Y. Research System</h2>
        <p className="text-gray-600 mb-4">
          Sign in to access the research questionnaire and track your investment decisions
        </p>
        <Link to="/auth" className="inline-block bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700">
          Sign In / Create Account
        </Link>
      </div>
    )
  }

  const [userDisplayName, setUserDisplayName] = useState(user.user_metadata?.display_name || user.email?.split('@')[0] || 'User')

  return (
    <div className="mt-8 space-y-6">
      {/* User Name Input */}
      <UserNameInput userId={user.id} onNameChange={setUserDisplayName} />

      {/* Decision Buttons */}
      <DecisionButtons ticker={ticker} userId={user.id} />

      {/* Chart Link */}
      <ChartLink ticker={ticker} userId={user.id} />

      {/* Research Questions */}
      <ResearchQuestions ticker={ticker} userId={user.id} stock={stock} />

      {/* PDF Generator */}
      <PDFGenerator
        ticker={ticker}
        userId={user.id}
        userName={userDisplayName}
        stock={stock}
      />
    </div>
  )
}

