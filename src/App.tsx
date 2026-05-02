import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import type { ReactElement } from "react"
import { AuthProvider } from "@/contexts/auth-context"
import { useAuth } from "@/contexts/auth-context"
import { LoginPage } from "@/pages/login-page"
import { GuildPage } from "@/pages/guild-page"
import { GuildLayout } from "@/components/guild-layout"
import { GuildOverviewPage } from "@/pages/guild/overview-page"
import { GuildTemplatesPage } from "@/pages/guild/templates-page"
import { GuildLogsPage } from "@/pages/guild/logs-page"
import { GuildReactionRolesPage } from "@/pages/guild/reaction-roles-page"
import { GuildInstallTemplatePage } from "@/pages/guild/install-template-page"
import { GuildServerMessagesPage } from "@/pages/guild/server-messages-page"
import { GuildAutoRolesPage } from "@/pages/guild/auto-roles-page"
import { ServerTemplatesListPage } from "@/pages/server-templates-list-page"
import { ServerTemplateEditorPage } from "@/pages/server-template-editor-page"
import { StorePage } from "@/pages/store-page"
import { MyTemplatesPage } from "@/pages/my-templates-page"
import { MyPurchasesPage } from "@/pages/my-purchases-page"
import { InstallWizardPage } from "@/pages/install-wizard-page"
import { AdminStorePage } from "@/pages/admin-store-page"
import { AdminTemplateAccessPage } from "@/pages/admin-template-access-page"
import { MyGuildsPage } from "@/pages/my-guilds-page"

function RequireRole({ role, children }: { role: "admin" | "customer"; children: ReactElement }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== role) return <Navigate to="/" replace />
  return children
}

function HomeRedirect() {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  if (user.role === "customer") return <Navigate to="/store" replace />
  return <Navigate to="/server-templates" replace />
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<HomeRedirect />} />

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
            path="/store"
            element={
              <RequireRole role="customer">
                <StorePage />
              </RequireRole>
            }
          />
          <Route
            path="/my-templates"
            element={
              <RequireRole role="customer">
                <MyTemplatesPage />
              </RequireRole>
            }
          />
          <Route
            path="/my-purchases"
            element={
              <RequireRole role="customer">
                <MyPurchasesPage />
              </RequireRole>
            }
          />
          <Route
            path="/install/:templateId"
            element={
              <RequireRole role="customer">
                <InstallWizardPage />
              </RequireRole>
            }
          />
          <Route
            path="/my-servers"
            element={
              <RequireRole role="customer">
                <MyGuildsPage />
              </RequireRole>
            }
          />

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
              <Route path="reaction-roles" element={<GuildReactionRolesPage />} />
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
