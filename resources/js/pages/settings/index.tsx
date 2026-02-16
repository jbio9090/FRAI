import PushNotifications from '@/components/notification/pushNotification';
import { usePermission } from '@/hooks/use-permission';
import DefaultLayout from '@/layout.tsx/default.';
import { usePage } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

export default function Settings() {
    const [theme, setTheme] = useState(localStorage.theme);

    useEffect(() => {
        document.documentElement.classList.toggle(
            "dark",
            localStorage.getItem("theme") === "dark" ||
            (!("theme" in localStorage) && window.matchMedia("(prefers-color-scheme: dark)").matches),
        );
        console.log("Theme Changed");
    }, [theme]);

    const onThemeChange = (value: string) => {
        if (value === "system") {
            localStorage.removeItem("theme");
            return;
        }

        setTheme(value);
        localStorage.setItem("theme", value);
    }

    return (
        <DefaultLayout>
            <div className="flex flex-col mx-auto max-w-2xl gap-8 w-full">
                <h1 className='text-lg font-semibold mb-2'>Settings</h1>
                
                <PushNotifications />

                <div className="flex justify-between items-center">
                    <span className='text-sm font-semibold'>Theme</span>
                    <Select defaultValue='system' onValueChange={(value) => onThemeChange(value)}>
                        <SelectTrigger className="w-full text-sm max-w-36">
                            <SelectValue placeholder="Select a fruit" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectGroup className='text-sm'>
                                <SelectItem value="system">System</SelectItem>
                                <SelectItem value="dark">Dark</SelectItem>
                                <SelectItem value="light">Light</SelectItem>
                            </SelectGroup>
                        </SelectContent>
                    </Select>
                </div>


            </div>
        </DefaultLayout >
    );
}
