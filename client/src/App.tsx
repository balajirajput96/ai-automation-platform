import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import DashboardLayout from "./components/DashboardLayout";
import { ThemeProvider } from "./contexts/ThemeContext";
import { platformRoutes } from "./lib/platformRoutes";
import {
  AgentsScreen,
  IntegrationsScreen,
  OverviewScreen,
  ProjectsScreen,
  RunsScreen,
  SchedulesScreen,
  SettingsScreen,
  WorkflowsScreen,
} from "./pages/OperationsPlatform";

function PlatformPage({ children }: { children: React.ReactNode }) {
  return <DashboardLayout>{children}</DashboardLayout>;
}

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={platformRoutes.overview}><PlatformPage><OverviewScreen /></PlatformPage></Route>
      <Route path={platformRoutes.agents}><PlatformPage><AgentsScreen /></PlatformPage></Route>
      <Route path={platformRoutes.workflows}><PlatformPage><WorkflowsScreen /></PlatformPage></Route>
      <Route path={platformRoutes.projects}><PlatformPage><ProjectsScreen /></PlatformPage></Route>
      <Route path={platformRoutes.integrations}><PlatformPage><IntegrationsScreen /></PlatformPage></Route>
      <Route path={platformRoutes.executionLogs}><PlatformPage><RunsScreen /></PlatformPage></Route>
      <Route path={platformRoutes.executionLogsAlias}><PlatformPage><RunsScreen /></PlatformPage></Route>
      <Route path={platformRoutes.schedules}><PlatformPage><SchedulesScreen /></PlatformPage></Route>
      <Route path={platformRoutes.settings}><PlatformPage><SettingsScreen /></PlatformPage></Route>
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="dark"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
