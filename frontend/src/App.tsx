import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { HomeView } from './views/HomeView'
import { OrganizationView } from './views/OrganizationView'
import { AssessmentWizardView } from './views/AssessmentWizardView'
import { CandidateView } from './views/CandidateView'
import { ReviewerView } from './views/ReviewerView'
import { InvestigationView } from './views/InvestigationView'
import { SystemObservabilityView } from './views/SystemObservabilityView'
import { SystemLabView } from './views/SystemLabView'

export function App() {
  return (
    <BrowserRouter>
      <AppShell>
        <Routes>
          <Route path="/" element={<HomeView />} />
          <Route path="/org" element={<OrganizationView />} />
          <Route path="/org/assessments/new" element={<AssessmentWizardView />} />
          <Route path="/candidate/:sessionId" element={<CandidateView />} />
          <Route path="/reviewer/:sessionId" element={<ReviewerView />} />
          <Route path="/investigation/:sessionId" element={<InvestigationView />} />
          <Route path="/system" element={<SystemObservabilityView />} />
          <Route path="/lab" element={<SystemLabView />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  )
}

export default App
