import * as React from "react"

import { Button } from "./ui/button"
import { SearchForm } from "@/components/search-form"
import { VersionSwitcher } from "@/components/version-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarFooter,
} from "@/components/ui/sidebar"

import {
  Home,
  FileText,
  Users,
  Settings,
  LogOut,
  CirclePlus,
} from "lucide-react"

import { Link, router } from "@inertiajs/react"

// This is sample data.
const data = {
  versions: ["1.0.1", "1.1.0-alpha", "2.0.0-beta1"],
  navMenu: [
    {
      title: "Dashboard",
      url: route("dashboard"),
      icon: Home
    },
    {
      title: "Requests",
      url: route("requests"),
      icon: FileText
    },
    {
      title: "Users",
      url: "/users",
      icon: Users
    },
    {
      title: "Settings",
      url: "/settings",
      icon: Settings
    }
  ]
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const handleLogout = (e: React.MouseEvent) => {
    e.preventDefault();
    router.post(route("logout"));
  };

  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <VersionSwitcher
          versions={data.versions}
          defaultVersion={data.versions[0]}
        />
        <SearchForm />
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

          {data.navMenu.map((item) => (
            <SidebarMenuItem key={item.title} className="px-4">
              <SidebarMenuButton asChild>
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