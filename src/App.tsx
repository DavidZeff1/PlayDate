import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppProvider } from './state/AppContext';
import { I18nProvider } from './i18n';
import { ToastProvider } from './components/ui';
import { SiteLayout } from './components/layout/SiteLayout';
import { AppLayout } from './components/layout/AppLayout';

import { Landing } from './pages/public/Landing';
import { HowItWorks, PrivacyPage, SafetyPage } from './pages/public/Content';
import { Login } from './pages/public/Login';
import { Onboarding } from './pages/public/Onboarding';

import { Dashboard } from './pages/app/Dashboard';
import { MyFamily } from './pages/app/MyFamily';
import { MyChildren } from './pages/app/MyChildren';
import { Discover } from './pages/app/Discover';
import { Requests } from './pages/app/Requests';
import { Messages } from './pages/app/Messages';
import { PlayDates } from './pages/app/PlayDates';
import { Settings } from './pages/app/Settings';
import { Verification } from './pages/app/Verification';
import { Matches, Notifications, SafetyCentre } from './pages/app/Misc';

import { Admin } from './pages/admin/Admin';

/**
 * Routing.
 *
 * Route guards here are a UX affordance — they keep a parent from landing on a page
 * that would confuse them. They are NOT the security boundary: every authorisation
 * decision is made in the service layer (`services/security/guards.ts`), so a
 * hand-crafted navigation cannot reach data the viewer is not entitled to.
 */
export function App() {
  return (
    <BrowserRouter>
      <I18nProvider>
        <AppProvider>
          <ToastProvider>
          <Routes>
            {/* Public */}
            <Route element={<SiteLayout />}>
              <Route path="/" element={<Landing />} />
              <Route path="/how-it-works" element={<HowItWorks />} />
              <Route path="/safety" element={<SafetyPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
            </Route>

            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Onboarding />} />
            <Route path="/onboarding" element={<Onboarding />} />

            {/* Authenticated parent */}
            <Route path="/app" element={<AppLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="family" element={<MyFamily />} />
              <Route path="children" element={<MyChildren />} />
              <Route path="discover" element={<Discover />} />
              <Route path="matches" element={<Matches />} />
              <Route path="requests" element={<Requests />} />
              <Route path="messages" element={<Messages />} />
              <Route path="playdates" element={<PlayDates />} />
              <Route path="notifications" element={<Notifications />} />
              <Route path="safety" element={<SafetyCentre />} />
              <Route path="settings" element={<Settings />} />
              <Route path="verification" element={<Verification />} />
            </Route>

            {/* Staff tooling — a separate application in production */}
            <Route path="/admin" element={<Admin />} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </ToastProvider>
        </AppProvider>
      </I18nProvider>
    </BrowserRouter>
  );
}
