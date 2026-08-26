import { useEffect } from "react";
import { LoginForm } from "@/components/login-form"

export default function LoginPage() {
    useEffect(() => {
        const applyTheme = () => {
            const theme = localStorage.getItem("theme");
            const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
            const isDark = theme === "dark" || (!theme && systemPrefersDark);
            document.documentElement.classList.toggle("dark", isDark);
        };

        applyTheme();

        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
        const handleChange = () => {
            if (!localStorage.getItem("theme")) applyTheme();
        };

        mediaQuery.addEventListener("change", handleChange);
        return () => mediaQuery.removeEventListener("change", handleChange);
    }, []);

    return (
        <div className="relative min-h-svh overflow-hidden bg-radial from-[#1A41CC] dark:from-[#0F0F0F] from-32% dark:from-22% to-primary dark:to-background to-85%">
            <div className="flex flex-col min-h-svh p-6 md:p-10">
                <div className="flex flex-1 items-center justify-center w-full md:w-fit mx-auto md:px-20 md:py-6">
                    <div className="w-full md:min-w-md max-w-md content border px-12 pt-10 pb-14 rounded-sm bg-background">
                        <LoginForm />
                    </div>
                </div>
            </div>
        </div>
    )
}