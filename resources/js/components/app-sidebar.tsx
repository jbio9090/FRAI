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
  SidebarSeparator,
} from "@/components/ui/sidebar"

import {
  Home,
  FileText,
  Users,
  Settings,
  LogOut,
  CirclePlus,
  FileCheck,
  FileX,
} from "lucide-react"

import { Link, router } from "@inertiajs/react"

// This is sample data.
const data = {
  versions: ["1.0.1", "1.1.0-alpha", "2.0.0-beta1"],
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
  const handleLogout = (e: React.MouseEvent) => {
    e.preventDefault();
    router.post(route("logout"));
  };

  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <div className="w-full flex flex-col items-center px-4 my-2">
            <h1 className="text-left w-full font-bold">PLV - GSO</h1>
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

          <SidebarMenuItem key="Dashboard" className="px-4">
            <SidebarMenuButton asChild>
              <Link href={route("dashboard")}>
                <Home className="h-4 w-4" />
                <span>Dashboard</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem className="px-4 mt-4">
            <SidebarGroupLabel>
              Requests
            </SidebarGroupLabel>
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