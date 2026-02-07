import React from 'react';
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
    labeledBreadcrumb: string | null;
}

interface PageProps {
    breadcrumbs: string[];
    labeledBreadcrumb: string;
}

export default function DefaultLayout({ children }: DashboardProps) {
    const { post } = useForm({
        rule: "",
    });
    const page = usePage<PageProps>();
    const breadcrumbs = page.props.breadcrumbs;
    const labeledBreadcrumb = page.props.labeledBreadcrumb;

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
                            {breadcrumbs && breadcrumbs.map((breadcrumb, index) => {
                                // Build the path up to this breadcrumb
                                const path = '/' + breadcrumbs.slice(0, index + 1).join('/');
                                const isLast = index === breadcrumbs.length - 1;

                                return (
                                    <React.Fragment key={breadcrumb + index}>
                                        <BreadcrumbItem>
                                            {(isLast && labeledBreadcrumb == null) ? (
                                                <BreadcrumbPage>
                                                    {breadcrumb.charAt(0).toUpperCase() + breadcrumb.slice(1)}
                                                </BreadcrumbPage>
                                            ) : (
                                                <BreadcrumbLink href={path}>
                                                    {breadcrumb.charAt(0).toUpperCase() + breadcrumb.slice(1)}
                                                </BreadcrumbLink>
                                            )}
                                        </BreadcrumbItem>
                                        {index < breadcrumbs.length - 1 && (
                                            <BreadcrumbSeparator />
                                        )}
                                    </React.Fragment>
                                );
                            })}

                            {(labeledBreadcrumb) && (
                                <React.Fragment key={labeledBreadcrumb}>
                                    <BreadcrumbSeparator />

                                    <BreadcrumbItem>
                                        <BreadcrumbPage>
                                            {labeledBreadcrumb}
                                        </BreadcrumbPage>
                                    </BreadcrumbItem>
                                </React.Fragment>
                            )}
                        </BreadcrumbList>
                    </Breadcrumb>
                </header>

                <div className="flex flex-1 flex-col gap-4 p-8 justify-start">
                    {children}
                </div>
            </SidebarInset>
        </SidebarProvider>
    )
}