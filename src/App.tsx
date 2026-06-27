import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { ToastProvider } from '@/context/ToastContext';
import { DirtyStateProvider } from '@/context/DirtyStateContext';
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
import { MaturityLevels } from '@/pages/MaturityLevels';
import { FrameworkList } from '@/pages/FrameworkList';
import { FrameworkCreate } from '@/pages/FrameworkCreate';
import { AllTasks } from '@/pages/AllTasks';

function KeyedTemplateBuilder() {
  const { id } = useParams();
  return <TemplateBuilder key={id} />;
}

function App() {
  return (
    <BrowserRouter basename="/gap2action-">
      <AuthProvider>
        <DirtyStateProvider>
        <ToastProvider>
          <ToastRenderer />
          <ErrorBoundary label="Application">
            <Routes>
              <Route path="/login" element={<Login />} />

              <Route element={<ProtectedRoute />}>
                <Route path="events/:id/questionnaire" element={<Questionnaire />} />

                <Route element={<AppLayout />}>
                  <Route index element={<Dashboard />} />
                  <Route path="maturity" element={<MaturityLevels />} />
                  <Route path="tasks" element={<AllTasks />} />

                  <Route element={<ProtectedRoute requiredRole={['assessor', 'admin']} />}>
                    <Route path="events/new" element={<EventCreate />} />
                    <Route path="events/:id" element={<EventDashboard />} />
                    <Route path="events/:id/results" element={<Results />} />
                    <Route path="events/:id/gaps" element={<Gaps />} />
                    <Route path="events/:id/recommendations" element={<Recommendations />} />
                    <Route path="events/:id/roadmap" element={<Roadmap />} />
                    <Route path="events/:id/compare" element={<Compare />} />
                    <Route path="reports" element={<Reports />} />
                    <Route path="categories" element={<Categories />} />
                    <Route path="categories/:id/templates" element={<TemplateList />} />
                  </Route>

                  <Route element={<ProtectedRoute requiredRole="admin" />}>
                    <Route path="templates/:id/builder" element={<KeyedTemplateBuilder />} />
                    <Route path="admin/frameworks" element={<FrameworkList />} />
                    <Route path="admin/frameworks/new" element={<FrameworkCreate />} />
                    <Route path="admin/frameworks/:id" element={<FrameworkCreate />} />
                    <Route path="users" element={<UserManagement />} />
                  </Route>

                  <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
              </Route>
            </Routes>
          </ErrorBoundary>
        </ToastProvider>
        </DirtyStateProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
