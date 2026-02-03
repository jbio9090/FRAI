import { GalleryVerticalEnd } from "lucide-react"

import { LoginForm } from "@/components/login-form"

export default function LoginPage() {
    return (
        <div className="grid min-h-svh">
            <div className="flex flex-col p-6 md:p-10 relative">
                <div className="flex justify-center gap-2 md:justify-start absolute w-auto max-w-full">
                    <div className="w-full flex flex-col items-center px-4 my-2">
                        <h1 className="text-left w-full text-lg font-black">PLV - GSO</h1>
                        <h2 className="text-left w-full text-sm">Facility Request System</h2>
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
