import { useForm, usePage } from '@inertiajs/react';
import { AppSidebar } from "@/components/app-sidebar"
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import {
    SidebarInset,
    SidebarProvider,
    SidebarTrigger,
} from "@/components/ui/sidebar"

interface DashboardProps {
    children: React.ReactNode;
}

interface PageProps {
    breadcrumbs: string[];
}

export default function DefaultLayout({ children }: DashboardProps) {
    const { post } = useForm({});
    const { breadcrumbs } = usePage<PageProps>().props;

    console.log(breadcrumbs);

    function submit(e) {
        e.preventDefault();
        post(route('logout'));
    }

    return (
        <SidebarProvider>
            <AppSidebar />
            <SidebarInset>
                <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
                    <SidebarTrigger className="-ml-1" />
                    <Separator
                        orientation="vertical"
                        className="mr-2 data-[orientation=vertical]:h-4"
                    />
                    <Breadcrumb>
                        <BreadcrumbList>
                            {breadcrumbs.map((breadcrumb) => ( 
                                <>
                                    <BreadcrumbItem className="hidden md:block">
                                        {breadcrumb.charAt(0).toUpperCase() + breadcrumb.slice(1)}
                                    </BreadcrumbItem>

                                    <BreadcrumbSeparator className="hidden md:block" />
                                </>
                            ))}
                        </BreadcrumbList>
                    </Breadcrumb>
                </header>

                <div className="flex flex-1 flex-col gap-4 p-8">
                    {children}
                </div>
            </SidebarInset>
        </SidebarProvider>
    )
}