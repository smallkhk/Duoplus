import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { MarketingLayout } from '@/components/MarketingLayout'
import { ConsoleLayout } from '@/components/ConsoleLayout'
import { ChatWidget } from '@/components/ChatWidget'
import { ToastHost } from '@/components/ui'
import { AuthProvider, RequireAuth } from '@/lib/auth'

import { Home } from '@/pages/marketing/Home'
import { Features } from '@/pages/marketing/Features'
import { Solutions } from '@/pages/marketing/Solutions'
import { Pricing } from '@/pages/marketing/Pricing'
import { Reseller } from '@/pages/marketing/Reseller'
import { Developers } from '@/pages/marketing/Developers'
import { Download } from '@/pages/marketing/Download'
import { Contact } from '@/pages/marketing/Contact'
import { Knowledge } from '@/pages/marketing/Knowledge'
import { Legal } from '@/pages/marketing/Legal'
import { NotFound } from '@/pages/marketing/NotFound'

import { Login, Register } from '@/pages/auth/Auth'

import { Overview } from '@/pages/console/Overview'
import { Phones } from '@/pages/console/Phones'
import { Store } from '@/pages/console/Store'
import { Groups } from '@/pages/console/Groups'
import { Proxies } from '@/pages/console/Proxies'
import { Apps } from '@/pages/console/Apps'
import { Files } from '@/pages/console/Files'
import { Numbers } from '@/pages/console/Numbers'
import { Automation } from '@/pages/console/Automation'
import { ApiKeys } from '@/pages/console/ApiKeys'
import { Team } from '@/pages/console/Team'
import { Resellers } from '@/pages/console/Resellers'
import { Billing } from '@/pages/console/Billing'
import { Settings } from '@/pages/console/Settings'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastHost>
          <Routes>
            <Route element={<MarketingLayout />}>
              <Route index element={<Home />} />
              <Route path="features" element={<Features />} />
              <Route path="solutions" element={<Solutions />} />
              <Route path="pricing" element={<Pricing />} />
              <Route path="reseller" element={<Reseller />} />
              <Route path="developers" element={<Developers />} />
              <Route path="knowledge" element={<Knowledge />} />
              <Route path="download" element={<Download />} />
              <Route path="contact" element={<Contact />} />
              <Route path="legal" element={<Navigate to="/legal/terms" replace />} />
              <Route path="legal/:doc" element={<Legal />} />
              <Route path="*" element={<NotFound />} />
            </Route>

            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            <Route path="/console" element={<RequireAuth><ConsoleLayout /></RequireAuth>}>
              <Route index element={<Overview />} />
              <Route path="phones" element={<Phones />} />
              <Route path="store" element={<Store />} />
              <Route path="groups" element={<Groups />} />
              <Route path="proxies" element={<Proxies />} />
              <Route path="apps" element={<Apps />} />
              <Route path="files" element={<Files />} />
              <Route path="numbers" element={<Numbers />} />
              <Route path="automation" element={<Automation />} />
              <Route path="api" element={<ApiKeys />} />
              <Route path="team" element={<Team />} />
              <Route path="resellers" element={<Resellers />} />
              <Route path="billing" element={<Billing />} />
              <Route path="settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/console" replace />} />
            </Route>
          </Routes>

          {/* Support is reachable from every page, signed in or not. */}
          <ChatWidget />
        </ToastHost>
      </AuthProvider>
    </BrowserRouter>
  )
}
