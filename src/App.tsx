import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import type { ReactElement } from "react"
import { AuthProvider } from "@/contexts/auth-context"
import { useAuth } from "@/contexts/auth-context"
import { LandingPage } from "@/pages/landing-page"
import { ComingSoonPage } from "@/pages/coming-soon-page"
import { PrivacyPage, RefundPage, TermsPage } from "@/pages/legal-pages"
import { LoginPage } from "@/pages/login-page"
import { GuildPage } from "@/pages/guild-page"
import { GuildLayout } from "@/components/guild-layout"
import { GuildOverviewPage } from "@/pages/guild/overview-page"
import { GuildTemplatesPage } from "@/pages/guild/templates-page"
import { GuildLogsPage } from "@/pages/guild/logs-page"
import { GuildInstallTemplatePage } from "@/pages/guild/install-template-page"
import { GuildServerMessagesPage } from "@/pages/guild/server-messages-page"
import { GuildAutoRolesPage } from "@/pages/guild/auto-roles-page"
import { WelcomePage } from "@/pages/guild/welcome-page"
import { LevelingPage } from "@/pages/guild/leveling-page"
import { TwitchPage } from "@/pages/guild/twitch-page"
import { ServerTemplatesListPage } from "@/pages/server-templates-list-page"
import { ServerTemplateEditorPage } from "@/pages/server-template-editor-page"
import { StorePage } from "@/pages/store-page"
import { StoreProductPage } from "@/pages/store-product-page"
import { MyPurchasesPage } from "@/pages/my-purchases-page"
import { InstallWizardPage } from "@/pages/install-wizard-page"
import { AdminStorePage } from "@/pages/admin-store-page"
import { AdminTemplateAccessPage } from "@/pages/admin-template-access-page"
import { AdminSubscriptionsPage } from "@/pages/admin-subscriptions-page"
import { AdminLayout } from "@/components/admin-layout"
import { ServerLogsPage } from "@/pages/server-logs-page"
import { PersonalizationPage } from "@/pages/guild/personalization-page"
import { PremiumSuccessPage, PricingPage } from "@/pages/pricing-page"

/**
 * Role guard. On mismatch we send the user to `/` (the landing), where the
 * "Open dashboard" CTA in the public nav routes them back to their real home.
 * That's deliberate: it works for guests, customers, admins all the same.
 */
function RequireRole({ role, children }: { role: ("admin" | "customer")[] | "admin" | "customer"; children: ReactElement }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  const allowed = Array.isArray(role) ? role : [role]
  if (!user.role || !allowed.includes(user.role)) return <Navigate to="/" replace />
  return children
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public surface — no login required. Lives outside the AdminLayout
              so guests don't trigger /api/auth/me, the active-guild context,
              or any other dashboard-shaped infrastructure. */}
          <Route path="/" element={<LandingPage />} />
          {/* Shop is a stub until launch (TZ §1): nav + hero button land here. */}
          <Route path="/shop" element={<ComingSoonPage />} />
          <Route path="/shop/:id" element={<ComingSoonPage />} />
          {/* Legal documents (TZ §11). */}
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/refund" element={<RefundPage />} />
          <Route path="/login" element={<LoginPage />} />

          <Route
            path="/server-templates"
            element={
              <RequireRole role="admin">
                <ServerTemplatesListPage />
              </RequireRole>
            }
          />
          <Route
            path="/server-templates/:id"
            element={
              <RequireRole role="admin">
                <ServerTemplateEditorPage />
              </RequireRole>
            }
          />
          <Route
            path="/admin/store"
            element={
              <RequireRole role="admin">
                <AdminStorePage />
              </RequireRole>
            }
          />
          <Route
            path="/admin/template-access"
            element={
              <RequireRole role="admin">
                <AdminTemplateAccessPage />
              </RequireRole>
            }
          />
          <Route
            path="/admin/subscriptions"
            element={
              <RequireRole role="admin">
                <AdminSubscriptionsPage />
              </RequireRole>
            }
          />

          {/* Customer pages — shared AdminLayout (sidebar + active server) */}
          <Route
            element={
              <RequireRole role="customer">
                <AdminLayout />
              </RequireRole>
            }
          >
            <Route path="/store" element={<StorePage />} />
            <Route path="/store/:id" element={<StoreProductPage />} />
            <Route path="/my-purchases" element={<MyPurchasesPage />} />
            <Route path="/server-messages" element={<GuildServerMessagesPage />} />
            <Route path="/welcome" element={<WelcomePage />} />
            <Route path="/leveling" element={<LevelingPage />} />
            <Route path="/twitch" element={<TwitchPage />} />
            <Route path="/reaction-roles" element={<GuildAutoRolesPage />} />
            <Route path="/server-logs" element={<ServerLogsPage />} />
            <Route path="/personalization" element={<PersonalizationPage />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/premium/success" element={<PremiumSuccessPage />} />
          </Route>

          {/* Standalone install wizard (no admin shell). Admins can run it too —
              that's how the owner installs templates onto test servers (TZ §14). */}
          <Route
            path="/install/:templateId"
            element={
              <RequireRole role={["customer", "admin"]}>
                <InstallWizardPage />
              </RequireRole>
            }
          />

          {/* Legacy /guild/:guildId pages — kept for now, will be migrated in next iteration */}
          <Route
            path="/guild/:guildId"
            element={
              <RequireRole role="customer">
                <GuildPage />
              </RequireRole>
            }
          >
            <Route element={<GuildLayout />}>
              <Route index element={<GuildOverviewPage />} />
              <Route path="templates" element={<GuildTemplatesPage />} />
              <Route path="logs" element={<GuildLogsPage />} />
              <Route path="install-template" element={<GuildInstallTemplatePage />} />
              <Route path="server-messages" element={<GuildServerMessagesPage />} />
              <Route path="auto-roles" element={<GuildAutoRolesPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
