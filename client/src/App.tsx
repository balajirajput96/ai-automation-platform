import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import DashboardLayout from "./components/DashboardLayout";
import { ThemeProvider } from "./contexts/ThemeContext";
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
      <Route path={"/"}><PlatformPage><OverviewScreen /></PlatformPage></Route>
      <Route path={"/agents"}><PlatformPage><AgentsScreen /></PlatformPage></Route>
      <Route path={"/workflows"}><PlatformPage><WorkflowsScreen /></PlatformPage></Route>
      <Route path={"/projects"}><PlatformPage><ProjectsScreen /></PlatformPage></Route>
      <Route path={"/integrations"}><PlatformPage><IntegrationsScreen /></PlatformPage></Route>
      <Route path={"/runs"}><PlatformPage><RunsScreen /></PlatformPage></Route>
      <Route path={"/schedules"}><PlatformPage><SchedulesScreen /></PlatformPage></Route>
      <Route path={"/settings"}><PlatformPage><SettingsScreen /></PlatformPage></Route>
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
