import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { ToastProvider } from '@/context/ToastContext';
import { ToastRenderer } from '@/components/shared/Toast';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { AppLayout } from '@/components/layout/AppLayout';
import { Dashboard } from '@/pages/Dashboard';
import { Login } from '@/pages/Login';
import { UserManagement } from '@/pages/UserManagement';
import { Categories } from '@/pages/Categories';
import { TemplateList } from '@/pages/TemplateList';
import { TemplateBuilder } from '@/pages/TemplateBuilder';
import { EventDashboard } from '@/pages/EventDashboard';
import { EventCreate } from '@/pages/EventCreate';
import { Questionnaire } from '@/pages/Questionnaire';
import { Results } from '@/pages/Results';
import { Gaps } from '@/pages/Gaps';
import { Recommendations } from '@/pages/Recommendations';
import { Roadmap } from '@/pages/Roadmap';
import { Compare } from '@/pages/Compare';
import { Reports } from '@/pages/Reports';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <ToastRenderer />
          <ErrorBoundary label="Application">
            <Routes>
              {/* Public */}
              <Route path="/login" element={<Login />} />

              {/* Auth guard — redirects to /login if no session */}
              <Route element={<ProtectedRoute />}>
                {/* Full-page routes — no sidebar */}
                <Route path="events/:id/questionnaire" element={<Questionnaire />} />

                {/* App shell — sidebar + main content */}
                <Route element={<AppLayout />}>
                  <Route index element={<Dashboard />} />
                  <Route path="categories" element={<Categories />} />
                  <Route path="categories/:id/templates" element={<TemplateList />} />
                  <Route path="templates/:id/builder" element={<TemplateBuilder />} />
                  <Route path="events/new" element={<EventCreate />} />
                  <Route path="events/:id" element={<EventDashboard />} />
                  <Route path="events/:id/results" element={<Results />} />
                  <Route path="events/:id/gaps" element={<Gaps />} />
                  <Route path="events/:id/recommendations" element={<Recommendations />} />
                  <Route path="events/:id/roadmap" element={<Roadmap />} />
                  <Route path="events/:id/compare" element={<Compare />} />
                  <Route path="reports" element={<Reports />} />

                  {/* Admin-only */}
                  <Route element={<ProtectedRoute requiredRole="admin" />}>
                    <Route path="users" element={<UserManagement />} />
                  </Route>

                  <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
              </Route>
            </Routes>
          </ErrorBoundary>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
