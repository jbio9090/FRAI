import { FormEvent } from "react";
import { useForm } from "@inertiajs/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle } from "lucide-react";

export default function ForcePasswordReset() {
    const { data, setData, post, processing, errors } = useForm({
        password: "",
        password_confirmation: "",
    });

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
                        <Input
                            id="password"
                            type="password"
                            value={data.password}
                            onChange={(e) => setData("password", e.target.value)}
                            className={errors.password ? "border-destructive focus-visible:ring-destructive" : ""}
                            required
                        />
                        {errors.password && (
                            <p className="text-sm text-destructive">{errors.password}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="password_confirmation">Confirm Password</Label>
                        <Input
                            id="password_confirmation"
                            type="password"
                            value={data.password_confirmation}
                            onChange={(e) => setData("password_confirmation", e.target.value)}
                            required
                        />
                    </div>

                    <Button className="w-full" type="submit" disabled={processing}>
                        Update Password
                    </Button>
                </form>
            </div>
        </div>
    );
}