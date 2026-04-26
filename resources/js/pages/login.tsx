import { LoginForm } from "@/components/login-form"

export default function LoginPage() {
    return (
        <div className="relative min-h-svh overflow-hidden bg-primary">
            <div className="flex flex-col min-h-svh p-6 md:p-10">
                <div className="flex flex-1 items-center justify-center w-fit mx-auto px-20 py-6 bg-radial from-[#1A41CC] from-43% to-primary to-70%">
                    <div className="w-full min-w-md max-w-md content border px-12 pt-10 pb-14 rounded-sm bg-white">
                        <LoginForm />
                    </div>
                </div>
            </div>
        </div>
    )
}