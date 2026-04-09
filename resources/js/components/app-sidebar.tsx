import { Link, router } from "@inertiajs/react"
import {
  LayoutGrid,
  FileClock,
  LogOut,
  CirclePlus,
  CheckLine,
  X,
  BookOpen,
  Box,
  Settings,
  Check,
  User,
  Sparkles,
  Cable,
  IterationCw,
} from "lucide-react"
import * as React from "react"
import {
  Sidebar,
  SidebarContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarFooter,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import { usePermission } from "@/hooks/use-permission"
import ChatbotSessionModal from "@/components/ChatbotSessionModal"


export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { hasPermission } = usePermission();
  const [isChatbotModalOpen, setIsChatbotModalOpen] = React.useState(false);
  const data = {
    topNav: [
      {
        title: "Dashboard",
        url: "dashboard",
        icon: LayoutGrid,
      },
      {
        title: "Rules",
        url: "rules",
        icon: BookOpen,
      },
      {
        title: "Facilities",
        url: "facilities",
        icon: Box,
      },
      {
        title: "Equipments",
        url: "equipments",
        icon: Cable,
      },
      ...(hasPermission("manage users")
        ? [{
          title: "Accounts",
          url: "accounts.index",
          icon: User,
        }]
        : [])
    ],
    navMenu: [
      {
        title: "Pending",
        url: route("requests.index", { status: "pending" }),
        status: "pending",
        icon: FileClock
      },
      {
        title: "For Reschedule",
        url: route("requests.index", { status: "for_reschedule" }),
        status: "for reschedule",
        icon: IterationCw
      },
      {
        title: "Approved",
        url: route("requests.index", { status: "approved" }),
        status: "approved",
        icon: Check
      },
      {
        title: "Conditionally Approved",
        url: route("requests.index", { status: "conditionally_approved" }),
        status: "conditionally_approved",
        icon: CheckLine
      },
      {
        title: "Denied",
        url: route("requests.index", { status: "denied" }),
        status: "denied",
        icon: X
      },
    ]
  }

  const handleLogout = (e: React.MouseEvent) => {
    e.preventDefault();
    router.post(route("logout"));
  };

  const checkRoute = (routeName: string) => {
    return route().current(routeName);
  }

  const currentStatus = route().params?.status || new URLSearchParams(window.location.search).get("status");

  return (
    <Sidebar {...props} className="[&_[data-slot=sidebar-container]]:z-[100]">
      <SidebarHeader>
        <SidebarMenu>
          <div className="w-full flex flex-col items-center px-4 my-2">
            <h1 className="text-left w-full text-lg font-black">PLV - GSO</h1>
            <h2 className="text-left w-full text-sm">Facility Request System</h2>
          </div>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>

          <SidebarMenuItem key="create-request" className="mt-2 px-4">
            <SidebarMenuButton asChild className="bg-primary text-primary-foreground dark:text-foreground hover:text-primary-foreground hover:bg-primary/90 cursor-pointer">
              <Link href={route("request.create")}>
                <CirclePlus className="h-4 w-4" />
                <span>Create Request</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem key="chatbot" className="px-4">
            <SidebarMenuButton className="bg-primary text-primary-foreground dark:text-foreground hover:text-primary-foreground hover:bg-primary/80 cursor-pointer" onClick={() => setIsChatbotModalOpen(true)}>
              <Sparkles className="h-4 w-4" />
              <span>Chatbot</span>
            </SidebarMenuButton>
          </SidebarMenuItem>

          {data.topNav.map((item) => (
            <SidebarMenuItem key={item.title} className="px-4">
              <SidebarMenuButton asChild isActive={checkRoute(item.url)}>
                <Link href={route(item.url)}>
                  <item.icon className="h-4 w-4" />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}

          <SidebarMenuItem className="px-4 mt-4">
            <SidebarGroupLabel>
              Requests
            </SidebarGroupLabel>
          </SidebarMenuItem>

          {data.navMenu.map((item) => (
            <SidebarMenuItem key={item.title} className="px-4">
              <SidebarMenuButton asChild
                isActive={
                  route().current("requests.index") &&
                  currentStatus === item.status
                }>
                <Link href={item.url}>
                  <item.icon className="h-4 w-4" />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter>
        <SidebarSeparator />
        <SidebarMenu className="pb-4">
          <SidebarMenuItem className="px-4">
            <SidebarMenuButton asChild>
              <Link href={route("settings")} className="w-full cursor-pointer">
                <Settings className="h-4 w-4" />
                <span>Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem className="px-4">
            <SidebarMenuButton asChild>
              <button onClick={handleLogout} className="w-full cursor-pointer">
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </button>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
      <ChatbotSessionModal
        isOpen={isChatbotModalOpen}
        onClose={() => setIsChatbotModalOpen(false)}
      />
    </Sidebar>
  )
}