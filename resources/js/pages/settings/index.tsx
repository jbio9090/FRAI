import PushNotifications from '@/components/notification/pushNotification';
import DefaultLayout from '@/layout.tsx/default.';
import { useEffect, useRef, useState } from 'react';
import { useForm, usePage } from '@inertiajs/react';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Avatar,
    AvatarFallback,
    AvatarImage,
} from "@/components/ui/avatar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import AvatarWithInitials from '@/components/avatar-with-initials';

interface PageProps {
    auth: {
        user: {
            id: number;
            name: string;
            profile: string;
            roles: string;
        };
    };
}

export default function Settings() {
    const { auth } = usePage<PageProps>().props;
    const [theme, setTheme] = useState(localStorage.theme);
    const [preview, setPreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const { data, setData, post, processing, errors, reset } = useForm<{ profile: File | null }>({
        profile: null,
    });

    const { delete: destroy, processing: removing } = useForm();

    useEffect(() => {
        document.documentElement.classList.toggle(
            "dark",
            localStorage.getItem("theme") === "dark" ||
            (!("theme" in localStorage) && window.matchMedia("(prefers-color-scheme: dark)").matches),
        );
    }, [theme]);

    const onThemeChange = (value: string) => {
        if (value === "system") {
            localStorage.removeItem("theme");
            return;
        }
        setTheme(value);
        localStorage.setItem("theme", value);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setData('profile', file);
        const reader = new FileReader();
        reader.onload = () => setPreview(reader.result as string);
        reader.readAsDataURL(file);
    };

    const handleSubmit = () => {
        if (!data.profile) return;
        post(route('settings.profile-picture'), {
            forceFormData: true,
            onSuccess: () => { reset(); setPreview(null); },
        });
    };

    const handleCancel = () => {
        setPreview(null);
        setData('profile', null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleRemove = () => {
        destroy(route('settings.profile-picture.remove'));
    };

    const hasCustomPicture = auth.user.profile !== 'default.png';

    const avatarSrc = preview
        ?? (hasCustomPicture ? `/storage/profiles/${auth.user.profile}` : undefined);

    return (
        <DefaultLayout>
            <div className="flex flex-col mx-auto max-w-2xl gap-6 w-full">
                <h1 className="text-lg font-semibold">Settings</h1>

                <div className="flex items-center gap-3">
                    <AvatarWithInitials
                        username={auth.user.name}
                        avatarSrc={auth.user.profile}
                        previewSrc={preview}
                        size={"lg"}
                    />

                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleFileChange}
                    />

                    <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="text-sm font-semibold leading-none truncate">{auth.user.name}</span>
                        <span className="text-xs text-muted-foreground capitalize">{auth.user.roles}</span>
                    </div>

                    <div className="ml-auto flex items-center gap-2 shrink-0">
                        {errors.profile && (
                            <span className="text-xs text-destructive">{errors.profile}</span>
                        )}
                        {preview ? (
                            <>
                                <button
                                    onClick={handleSubmit}
                                    disabled={processing}
                                    className="text-xs px-3 py-1 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                                    type="button"
                                >
                                    {processing ? 'Saving…' : 'Save'}
                                </button>
                                <button
                                    onClick={handleCancel}
                                    disabled={processing}
                                    className="text-xs px-3 py-1 rounded-md border border-border hover:bg-muted transition-colors"
                                    type="button"
                                >
                                    Cancel
                                </button>
                            </>
                        ) : (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <button
                                        className="text-xs px-3 py-1 rounded-md border border-border hover:bg-muted transition-colors"
                                        type="button"
                                    >
                                        Edit
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                        Upload photo
                                    </DropdownMenuItem>
                                    {hasCustomPicture && (
                                        <DropdownMenuItem
                                            onClick={handleRemove}
                                            disabled={removing}
                                            className="text-destructive focus:text-destructive"
                                        >
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                            {removing ? 'Removing…' : 'Remove photo'}
                                        </DropdownMenuItem>
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                    </div>
                </div>

                <PushNotifications />

                <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold">Theme</span>
                    <Select defaultValue="system" onValueChange={onThemeChange}>
                        <SelectTrigger className="w-36 text-sm">
                            <SelectValue placeholder="Select theme" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectGroup className="text-sm">
                                <SelectItem value="system">System</SelectItem>
                                <SelectItem value="dark">Dark</SelectItem>
                                <SelectItem value="light">Light</SelectItem>
                            </SelectGroup>
                        </SelectContent>
                    </Select>
                </div>
            </div>
        </DefaultLayout>
    );
}