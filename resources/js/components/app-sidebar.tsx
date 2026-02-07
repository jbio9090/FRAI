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
import {
  LayoutGrid,
  FileText,
  LogOut,
  CirclePlus,
  FileCheck,
  FileX,
  BookOpen,
  Box,
} from "lucide-react"
import { Link, router, usePage } from "@inertiajs/react"


const data = {
  topNav: [
    {
      title: "Dashboard",
      url: route("dashboard"),
      icon: LayoutGrid,
    },
    {
      title: "Rules",
      url: route("rules"),
      icon: BookOpen,
    },
    {
      title: "Facilities",
      url: route("facilities"),
      icon: Box,
    },
  ],
  navMenu: [
    {
      title: "Pending",
      url: route("requests.index"),
      icon: FileText
    },
    {
      title: "Approved",
      url: route("requests.approved"),
      icon: FileCheck
    },
    {
      title: "Denied",
      url: route("requests.denied"),
      icon: FileX
    }
  ]
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { url } = usePage();
  const handleLogout = (e: React.MouseEvent) => {
    e.preventDefault();
    router.post(route("logout"));
  };

  const checkRoute = (path: string) => {
    return url === path || url.startsWith(path)
  }

  return (
    <Sidebar {...props}>
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

          <SidebarMenuItem key="create-request" className="my-2 px-4">
            <SidebarMenuButton asChild className="bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer hover:text-primary-foreground">
              <Link href={route("request.create")}>
                <CirclePlus className="h-4 w-4" />
                <span>Create Request</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>

          {data.topNav.map((item) => (
            <SidebarMenuItem key={item.title} className="px-4">
              <SidebarMenuButton asChild isActive={checkRoute(item.url)}>
                <Link href={item.url}>
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
              <SidebarMenuButton asChild isActive={checkRoute(item.url)}>
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
        <SidebarMenu>
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
    </Sidebar>
  )
}