import { router, useForm, usePage } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import AvatarWithInitials from '@/components/avatar-with-initials';
import PushNotifications from '@/components/notification/pushNotification';
import { Button } from '@/components/ui/button';
import { UserRoundPen, Mail } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogClose,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { usePermission } from '@/hooks/use-permission';
import DefaultLayout from '@/layout.tsx/default.';

interface PageProps extends Record<string, unknown> {
    auth: {
        user: {
            id: number;
            name: string;
            profile: string;
            roles: string[];
            email: string;
            admin_email_notifications_enabled: boolean;
        };
    };
}

export default function Settings() {
    const { auth } = usePage<PageProps>().props;
    const [theme, setTheme] = useState(localStorage.theme);
    const [preview, setPreview] = useState<string | null>(null);
    const [pwDialogOpen, setPwDialogOpen] = useState(false);
    const [emailNotificationProcessing, setEmailNotificationProcessing] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { hasRole } = usePermission();
    const [editDetailsDialogOpen, setEditDetailsDialogOpen] = useState(false);

    const {
        data: detailsData,
        setData: setDetailsData,
        post: postDetails,
        processing: detailsProcessing,
        errors: detailsErrors
    } = useForm({
        name: auth.user.name,
        email: auth.user.email,
    });

    const handleUpdateDetails = () => {
        postDetails(route('settings.update-details', auth.user.id), {
            onSuccess: () => setEditDetailsDialogOpen(false),
        });
    };

    const { data, setData, post, processing, errors, reset } = useForm<{ profile: File | null }>({
        profile: null,
    });

    const { data: pwData, setData: setPwData, post: postPw, processing: pwProcessing, errors: pwErrors, reset: resetPw } = useForm({
        current_password: '',
        password: '',
        password_confirmation: '',
    });

    const handlePasswordChange = () => {
        postPw(route('settings.change-password'), {
            onSuccess: () => {
                resetPw();
                setPwDialogOpen(false);
            },
        });
    };

    const handleDialogOpenChange = (open: boolean) => {
        if (!open) resetPw();
        setPwDialogOpen(open);
    };

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
    const isAdmin = hasRole('admin') || hasRole('Super Admin');

    const handleAdminEmailNotificationToggle = () => {
        router.post(
            route('settings.admin-email-notifications'),
            {
                subscribed: !auth.user.admin_email_notifications_enabled,
            },
            {
                preserveScroll: true,
                onStart: () => setEmailNotificationProcessing(true),
                onFinish: () => setEmailNotificationProcessing(false),
            },
        );
    };

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

                    <div className="flex flex-col gap-1 min-w-0">
                        <span className="text-md font-semibold leading-none truncate text-wrap">{auth.user.name}</span>
                        <span className="text-sm text-muted-foreground leading-none text-wrap flex gap-1 items-center"><Mail size={12}/>{auth.user.email}</span>
                        <span className="text-sm mt-1 text-muted-foreground capitalize text-wrap">{auth.user.roles.join(', ')}</span>
                    </div>

                    <div className="ml-auto flex items-center gap-2 shrink-0">
                        {errors.profile && (
                            <span className="text-sm text-destructive">{errors.profile}</span>
                        )}
                        {preview ? (
                            <>
                                <Button variant={"outline"} size={"sm"} onClick={handleSubmit} disabled={processing} type="button">
                                    {processing ? 'Saving…' : 'Save'}
                                </Button>
                                <Button variant={"outline"} onClick={handleCancel} size={"sm"} disabled={processing} type="button">
                                    Cancel
                                </Button>
                            </>
                        ) : (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant={"outline"} type="button" size={"sm"}>Edit</Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => fileInputRef.current?.click()} className='cursor-pointer'>
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                        Upload photo
                                    </DropdownMenuItem>

                                    <DropdownMenuItem  onClick={() => setEditDetailsDialogOpen(true)} className='cursor-pointer'>
                                        <UserRoundPen size={12}/>
                                        <span>Edit Details</span>
                                    </DropdownMenuItem>
            
                                    {hasCustomPicture && (
                                        <DropdownMenuItem onClick={handleRemove} disabled={removing} className="text-destructive focus:text-destructive cursor-pointer">
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

                {/* Change Password Row */}
                <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold">Password</span>
                    <Button variant="outline" size="sm" type="button" onClick={() => setPwDialogOpen(true)}>
                        Change Password
                    </Button>
                </div>

                {/* Change Password Dialog */}
                <Dialog open={pwDialogOpen} onOpenChange={handleDialogOpenChange}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>Change Password</DialogTitle>
                        </DialogHeader>

                        <div className="flex flex-col gap-3 py-2">
                            <div className="flex flex-col gap-1.5">
                                <Label className="text-sm">Current Password</Label>
                                <Input
                                    type="password"
                                    value={pwData.current_password}
                                    onChange={e => setPwData('current_password', e.target.value)}
                                    placeholder="Enter current password"
                                    disabled={pwProcessing}
                                />
                                {pwErrors.current_password && (
                                    <span className="text-xs text-destructive">{pwErrors.current_password}</span>
                                )}
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <Label className="text-sm">New Password</Label>
                                <Input
                                    type="password"
                                    value={pwData.password}
                                    onChange={e => setPwData('password', e.target.value)}
                                    placeholder="Enter new password"
                                    disabled={pwProcessing}
                                />
                                {pwErrors.password && (
                                    <span className="text-xs text-destructive">{pwErrors.password}</span>
                                )}
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <Label className="text-sm">Confirm New Password</Label>
                                <Input
                                    type="password"
                                    value={pwData.password_confirmation}
                                    onChange={e => setPwData('password_confirmation', e.target.value)}
                                    placeholder="Confirm new password"
                                    disabled={pwProcessing}
                                />
                                {pwErrors.password_confirmation && (
                                    <span className="text-xs text-destructive">{pwErrors.password_confirmation}</span>
                                )}
                            </div>
                        </div>

                        <DialogFooter className="gap-2">
                            <DialogClose asChild>
                                <Button variant="outline" size="sm" type="button" disabled={pwProcessing}>
                                    Cancel
                                </Button>
                            </DialogClose>
                            <Button
                                size="sm"
                                type="button"
                                onClick={handlePasswordChange}
                                disabled={pwProcessing || !pwData.current_password || !pwData.password || !pwData.password_confirmation}
                            >
                                {pwProcessing ? 'Saving…' : 'Save Password'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <Dialog open={editDetailsDialogOpen} onOpenChange={setEditDetailsDialogOpen}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>Edit Account Details</DialogTitle>
                        </DialogHeader>

                        <div className="flex flex-col gap-3 py-2">
                            <div className="flex flex-col gap-1.5">
                                <Label className="text-sm">Full Name</Label>
                                <Input
                                    value={detailsData.name}
                                    onChange={e => setDetailsData('name', e.target.value)}
                                    placeholder="Your name"
                                    disabled={detailsProcessing}
                                />
                                {detailsErrors.name && (
                                    <span className="text-xs text-destructive">{detailsErrors.name}</span>
                                )}
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <Label className="text-sm">Email Address</Label>
                                <Input
                                    type="email"
                                    value={detailsData.email}
                                    onChange={e => setDetailsData('email', e.target.value)}
                                    placeholder="Your email"
                                    disabled={detailsProcessing}
                                />
                                {detailsErrors.email && (
                                    <span className="text-xs text-destructive">{detailsErrors.email}</span>
                                )}
                            </div>
                        </div>

                        <DialogFooter className="gap-2">
                            <DialogClose asChild>
                                <Button variant="outline" size="sm" type="button" disabled={detailsProcessing}>
                                    Cancel
                                </Button>
                            </DialogClose>
                            <Button
                                size="sm"
                                type="button"
                                onClick={handleUpdateDetails}
                                disabled={detailsProcessing || !detailsData.name || !detailsData.email}
                            >
                                {detailsProcessing ? 'Saving…' : 'Save Changes'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <PushNotifications />

                {isAdmin && (
                    <div className="flex justify-between items-center gap-4">
                        <span className="text-sm font-semibold">Email Notifications</span>
                        <Button
                            variant="outline"
                            size="sm"
                            type="button"
                            onClick={handleAdminEmailNotificationToggle}
                            disabled={emailNotificationProcessing}
                        >
                            {emailNotificationProcessing
                                ? 'Saving...'
                                : auth.user.admin_email_notifications_enabled
                                    ? 'Unsubscribe'
                                    : 'Subscribe'}
                        </Button>
                    </div>
                )}

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
