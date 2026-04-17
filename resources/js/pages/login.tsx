import { LoginForm } from "@/components/login-form"

export default function LoginPage() {
    return (
        <div className="relative min-h-svh overflow-hidden">
            <div className="flex flex-col min-h-svh p-6 md:p-10">
                <div className="flex justify-start px-4 my-2">
                    <div className="flex flex-col">
                        <h1 className="text-lg font-black">PLV - GSO</h1>
                        <h2 className="text-sm">Facility Request System</h2>
                    </div>
                </div>
                <div className="flex flex-1 items-center justify-center">
                    <div className="w-full max-w-xs">
                        <LoginForm />
                    </div>
                </div>
            </div>
        </div>
    )
}