import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import { AuthProvider } from "@/contexts/auth-context"
import { LoginPage } from "@/pages/login-page"
import { DashboardPage } from "@/pages/dashboard-page"
import { GuildPage } from "@/pages/guild-page"
import { GuildLayout } from "@/components/guild-layout"
import { GuildOverviewPage } from "@/pages/guild/overview-page"
import { GuildTemplatesPage } from "@/pages/guild/templates-page"
import { GuildLogsPage } from "@/pages/guild/logs-page"
import { GuildReactionRolesPage } from "@/pages/guild/reaction-roles-page"
import { GuildInstallTemplatePage } from "@/pages/guild/install-template-page"
import { ServerTemplatesListPage } from "@/pages/server-templates-list-page"
import { ServerTemplateEditorPage } from "@/pages/server-template-editor-page"

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<DashboardPage />} />
          <Route path="/server-templates" element={<ServerTemplatesListPage />} />
          <Route path="/server-templates/:id" element={<ServerTemplateEditorPage />} />
          <Route path="/guild/:guildId" element={<GuildPage />}>
            <Route element={<GuildLayout />}>
              <Route index element={<GuildOverviewPage />} />
              <Route path="templates" element={<GuildTemplatesPage />} />
              <Route path="logs" element={<GuildLogsPage />} />
              <Route path="reaction-roles" element={<GuildReactionRolesPage />} />
              <Route path="install-template" element={<GuildInstallTemplatePage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
