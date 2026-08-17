import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { startLogin } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import {
  Activity,
  Bot,
  Cable,
  ChevronDown,
  Clock3,
  Command,
  FolderKanban,
  LayoutDashboard,
  ListTree,
  LogOut,
  PanelLeft,
  Settings2,
  Workflow,
} from "lucide-react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";

const menuItems = [
  { icon: LayoutDashboard, label: "Overview", path: "/" },
  { icon: Bot, label: "AI Agents", path: "/agents" },
  { icon: Workflow, label: "Workflows", path: "/workflows" },
  { icon: FolderKanban, label: "Projects", path: "/projects" },
  { icon: Cable, label: "Integrations", path: "/integrations" },
  { icon: ListTree, label: "Execution logs", path: "/runs" },
  { icon: Clock3, label: "Scheduled jobs", path: "/schedules" },
  { icon: Settings2, label: "Settings", path: "/settings" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { loading, user } = useAuth();
  if (loading) return <DashboardLayoutSkeleton />;
  if (!user) {
    return (
      <main className="aurora-grid flex min-h-screen items-center justify-center px-5">
        <section className="glass-panel w-full max-w-md p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[0_16px_40px_rgba(114,92,255,.26)]">
            <Command className="h-6 w-6" />
          </div>
          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-primary">AstraFlow</p>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">Your operations center is ready.</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">Sign in to securely manage agents, workflows, integrations, and scheduled work.</p>
          <Button onClick={() => startLogin()} className="mt-7 h-11 w-full">Sign in to AstraFlow</Button>
        </section>
      </main>
    );
  }
  return <DashboardLayoutContent>{children}</DashboardLayoutContent>;
}

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const isMobile = useIsMobile();
  const active = menuItems.find(item => item.path === location)?.label ?? "AstraFlow";

  return (
    <SidebarProvider defaultOpen>
      <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar/85 backdrop-blur-xl">
        <SidebarHeader className="h-[76px] px-3 py-3">
          <div className="flex items-center gap-3 px-2">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-[0_8px_22px_rgba(114,92,255,.3)]">
              <Command className="h-4 w-4" />
            </div>
            <div className="min-w-0 group-data-[collapsible=icon]:hidden">
              <p className="font-display text-sm font-semibold tracking-tight">AstraFlow</p>
              <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground">AI Operations</p>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent className="px-3 pt-4">
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground group-data-[collapsible=icon]:hidden">Workspace</p>
          <SidebarMenu className="gap-1">
            {menuItems.map(item => (
              <SidebarMenuItem key={item.path}>
                <SidebarMenuButton
                  isActive={location === item.path}
                  onClick={() => setLocation(item.path)}
                  tooltip={item.label}
                  className="h-10 rounded-lg px-3 text-[13px] font-medium transition-all duration-150 data-[active=true]:bg-primary/12 data-[active=true]:text-primary hover:bg-accent/70"
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter className="p-3">
          <div className="mb-3 rounded-xl border border-sidebar-border bg-background/40 px-3 py-2.5 group-data-[collapsible=icon]:hidden">
            <div className="flex items-center gap-2 text-xs font-medium text-emerald-400"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_currentColor]" />Platform online</div>
            <p className="mt-1 text-[11px] text-muted-foreground">Secure workspace session</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition-colors hover:bg-accent/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <Avatar className="h-8 w-8 border border-border"><AvatarFallback className="bg-primary/15 text-xs text-primary">{user?.name?.slice(0, 1).toUpperCase() ?? "U"}</AvatarFallback></Avatar>
                <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden"><p className="truncate text-xs font-medium">{user?.name ?? "Workspace user"}</p><p className="mt-0.5 truncate text-[10px] text-muted-foreground">{user?.email ?? "Authenticated workspace"}</p></div>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground group-data-[collapsible=icon]:hidden" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={logout} className="cursor-pointer text-destructive focus:text-destructive"><LogOut className="mr-2 h-4 w-4" />Sign out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="aurora-grid min-h-screen bg-background">
        <header className="flex h-[76px] shrink-0 items-center justify-between border-b border-border/70 bg-background/65 px-5 backdrop-blur-xl sm:px-8">
          <div className="flex items-center gap-3"><SidebarTrigger className="h-9 w-9 rounded-lg hover:bg-accent" /><div><p className="font-display text-sm font-semibold">{isMobile ? active : "Operations workspace"}</p><p className="hidden text-xs text-muted-foreground sm:block">Visibility and control across your AI system</p></div></div>
          <div className="flex items-center gap-2 rounded-full border border-border/80 bg-card/60 px-3 py-1.5 text-xs text-muted-foreground"><Activity className="h-3.5 w-3.5 text-emerald-400" />All systems monitored</div>
        </header>
        <main className="flex-1 p-5 sm:p-8">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
