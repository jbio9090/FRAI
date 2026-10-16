import { useForm } from "@inertiajs/react";
import { AlertCircle, Eye, EyeOff } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForcePasswordReset() {
    const { data, setData, post, processing, errors } = useForm({
        password: "",
        password_confirmation: "",
    });
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const submit = (e: FormEvent) => {
        e.preventDefault();
        post(route("password.force.update"));
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <div className="w-full max-w-md space-y-6 bg-card p-8 rounded-xl shadow-sm border">
                <div className="flex flex-col items-center space-y-2 text-center">
                    <div className="bg-destructive/10 p-3 rounded-full mb-2">
                        <AlertCircle className="h-6 w-6 text-destructive" />
                    </div>
                    <h1 className="text-2xl font-semibold tracking-tight">Update Required</h1>
                    <p className="text-sm text-muted-foreground">
                        Your password has been reset by an administrator. For security reasons, you must establish a new password before continuing.
                    </p>
                </div>

                <form onSubmit={submit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="password">New Password</Label>
                        <div className="relative">
                            <Input
                                id="password"
                                type={showPassword ? "text" : "password"}
                                value={data.password}
                                onChange={(e) => setData("password", e.target.value)}
                                className={`pr-10 ${errors.password ? "border-destructive focus-visible:ring-destructive" : ""}`}
                                required
                            />
                            <Button
                                type="button"
                                onClick={() => setShowPassword(prev => !prev)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                aria-label={showPassword ? "Hide password" : "Show password"}
                                variant="ghost"
                                size="icon-sm"
                            >
                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </Button>
                        </div>
                        {errors.password && (
                            <p className="text-sm text-destructive">{errors.password}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="password_confirmation">Confirm Password</Label>
                        <div className="relative">
                            <Input
                                id="password_confirmation"
                                type={showConfirmPassword ? "text" : "password"}
                                value={data.password_confirmation}
                                onChange={(e) => setData("password_confirmation", e.target.value)}
                                className="pr-10"
                                required
                            />
                            <Button
                                type="button"
                                onClick={() => setShowConfirmPassword(prev => !prev)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                                variant="ghost"
                                size="icon-sm"
                            >
                                {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </Button>
                        </div>
                    </div>

                    <Button className="w-full" type="submit" disabled={processing}>
                        Update Password
                    </Button>
                </form>
            </div>
        </div>
    );
}