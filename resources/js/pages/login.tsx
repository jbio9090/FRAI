import { LoginForm } from "@/components/login-form"

export default function LoginPage() {
    return (
        <div className="relative min-h-svh overflow-hidden bg-radial from-[#1A41CC] from-28% to-primary to-75%">
            <div className="flex flex-col min-h-svh p-6 md:p-10">
                <div className="flex flex-1 items-center justify-center w-full md:w-fit mx-auto md:px-20 md:py-6">
                    <div className="w-full md:min-w-md max-w-md content border px-12 pt-10 pb-14 rounded-sm bg-white">
                        <LoginForm />
                    </div>
                </div>
            </div>
        </div>
    )
}