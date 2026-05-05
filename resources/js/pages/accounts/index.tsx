import { usePage } from "@inertiajs/react";
import { router } from "@inertiajs/react";
import { UserPlus2, Trash2, Pencil, UserPen, Check, Copy, AlertTriangle, Key } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import AvatarWithInitials from "@/components/avatar-with-initials";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import DefaultLayout from "@/layout.tsx/default.";
import type { User } from "@/types";

interface Props {
    users: User[];
    roles: string[];
}

interface UserForm {
    username: string;
    email: string;
    role: string;
    profile: File | null;
    preview?: string;
}

interface AccountForm {
    username: string;
    email: string;
    password: string;
}

interface PageProps {
    errors: Partial<Record<keyof AccountForm, string>>;
    [key: string]: unknown;
    flash?: {
        success?: string;
        error?: string;
        temp_password_reset?: {
            temp_password: string;
            target_user: string;
            context: 'create' | 'reset';
        }
    };
}

const emptyForm: UserForm = { username: "", email: "", role: "", profile: null };

export default function AccountsPage({ users, roles }: Props) {
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [addForm, setAddForm] = useState<UserForm>(emptyForm);
    const [editForm, setEditForm] = useState<UserForm>(emptyForm);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { errors } = usePage<PageProps>().props;
    const { flash } = usePage<PageProps>().props;
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (flash?.temp_password_reset) {
            setShowPasswordModal(true);
            setCopied(false);
        }
    }, [flash?.temp_password_reset]);

    useEffect(() => {
        if (flash?.temp_password_reset) {
            setShowPasswordModal(true);
            setCopied(false);
        }
    }, [flash?.temp_password_reset]);


    const copyToClipboard = async () => {
        if (flash?.temp_password_reset) {
            await navigator.clipboard.writeText(flash.temp_password_reset.temp_password);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleResetPassword = (targetUser: User) => {
        if (window.confirm(`Are you sure you want to force a password reset for ${targetUser.name}?`)) {
            setEditingUser(null);

            router.post(route('accounts.reset-password', targetUser.id), {}, {
                preserveScroll: true,
            });
        }
    };

    const handleAdd = (e: React.FormEvent) => {
        e.preventDefault();
        router.post(route("accounts.store"), {
            ...addForm,
            name: addForm.username,
        }, {
            onSuccess: () => {
                setIsAddOpen(false);
                setAddForm(emptyForm);
            },
        });
    };

    const openEdit = (user: User) => {
        setEditingUser(user);
        setEditForm({
            username: user.name,
            email: user.email,
            role: user.role,
            profile: null,
            preview: undefined
        });
    };

    const handleEdit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingUser) return;

        router.post(route("accounts.update", editingUser.id), {
            _method: 'put',
            name: editForm.username,
            email: editForm.email,
            role: editForm.role,
            profile: editForm.profile,
        }, {
            onSuccess: () => setEditingUser(null),
        });
    };

    const handleDelete = (id: number) => {
        router.delete(route("accounts.destroy", id));
    };

    const FormFields = ({
        form,
        onChange,
        isEdit = false,
    }: {
        form: UserForm;
        onChange: (f: UserForm) => void;
        isEdit?: boolean;
    }) => (
        <>
            <div className="flex flex-col items-center gap-4 mb-4">
                <AvatarWithInitials
                    username={form.username || "User"}
                    avatarSrc={isEdit ? editingUser?.profile : undefined}
                    previewSrc={form.preview}
                    size="lg"
                />
                <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                >
                    Change Photo
                </Button>
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                            onChange({
                                ...form,
                                profile: file,
                                preview: URL.createObjectURL(file)
                            });
                        }
                    }}
                />
            </div>

            <div className="space-y-4">
                <div className="flex flex-col gap-1.5">
                    <Label>Username</Label>
                    <Input
                        type="text"
                        placeholder="Enter username"
                        value={form.username}
                        className={errors.username ? "border-destructive" : ""}
                        onChange={(e) => onChange({ ...form, username: e.target.value })}
                    />
                    {errors.username && <p className="text-sm text-destructive">{errors.username}</p>}
                </div>

                <div className="flex flex-col gap-1.5">
                    <Label>Email</Label>
                    <Input
                        type="email"
                        placeholder="Enter email"
                        value={form.email}
                        className={errors.email ? "border-destructive" : ""}
                        onChange={(e) => onChange({ ...form, email: e.target.value })}
                    />
                    {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                </div>

                <div className="flex flex-col gap-1.5">
                    <Label>Role</Label>
                    <Select value={form.role} onValueChange={(v) => onChange({ ...form, role: v })}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                            {roles.map((r) => (
                                <SelectItem key={r} value={r}>
                                    {r[0].toUpperCase() + r.slice(1)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {!isEdit && (
                    <div className="flex flex-col gap-1.5 mb-3 mt-2">
                        <p className="text-center text-sm text-muted-foreground">A random password will appear once the account has been created. Copy it and send to the user</p>
                    </div>
                )}
            </div>
        </>
    );

    return (
        <DefaultLayout>
            <h1 className="font-bold text-xl">Account Management</h1>

            <div className="mt-6">
                <Button
                    variant="outline"
                    className="flex items-center gap-2"
                    onClick={() => setIsAddOpen(true)}
                >
                    <UserPlus2 className="h-4 w-4" />
                    Add User
                </Button>
            </div>

            <Dialog open={showPasswordModal} onOpenChange={setShowPasswordModal}>
                <DialogContent className="sm:max-w-md border-t-4 border-t-primary">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Key className="h-5 w-5 text-primary" />
                            {flash?.temp_password_reset?.context === 'create'
                                ? "New Account Created"
                                : "Password Reset Successful"}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="flex flex-col gap-4 py-2">
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            {flash?.temp_password_reset?.context === 'create' ? (
                                <>
                                    The account for <strong className="text-foreground">{flash?.temp_password_reset?.target_user}</strong> has been successfully created. Copy the temporary password below and share it securely. The user must change it on their first login.
                                </>
                            ) : (
                                <>
                                    The password for <strong className="text-foreground">{flash?.temp_password_reset?.target_user}</strong> has been reset. Copy this and share it securely. The user must change it on their next login.
                                </>
                            )}
                        </p>

                        <div className="flex items-center space-x-2">
                            <div className="grid flex-1 gap-2">
                                <Input
                                    readOnly
                                    value={flash?.temp_password_reset?.temp_password || ""}
                                    className="font-mono text-lg text-center tracking-[0.3em] bg-muted h-12"
                                />
                            </div>
                            <Button
                                size="icon"
                                variant="secondary"
                                className="h-12 w-12"
                                onClick={copyToClipboard}
                            >
                                {copied ? <Check className="h-5 w-5 text-green-500" /> : <Copy className="h-5 w-5" />}
                            </Button>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button className="w-full" onClick={() => setShowPasswordModal(false)}>
                            I have saved the password
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Add Dialog */}
            <Dialog open={isAddOpen} onOpenChange={(open) => {
                setIsAddOpen(open);
                if (!open) setAddForm(emptyForm);
            }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <UserPlus2 />
                            Add User
                        </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleAdd} className="flex flex-col gap-4 mb-8">
                        <FormFields form={addForm} onChange={setAddForm} />
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit">Save Credentials</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Edit Dialog */}
            <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <UserPen className="h-5 w-5" />
                            Edit User Profile
                        </DialogTitle>
                    </DialogHeader>

                    <form onSubmit={handleEdit} className="space-y-6">
                        <FormFields form={editForm} onChange={setEditForm} isEdit />

                        {/* Password Reset Trigger inside Edit Dialog */}
                        <div className="pt-4 border-t">
                            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border border-dashed">
                                <div className="space-y-0.5">
                                    <Label className="text-sm font-medium">Account Security</Label>
                                    <p className="text-xs text-muted-foreground">
                                        Force a random password reset.
                                    </p>
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/10"
                                    onClick={() => editingUser && handleResetPassword(editingUser)}
                                >
                                    <Key className="h-3.5 w-3.5" />
                                    Reset Password
                                </Button>
                            </div>
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setEditingUser(null)}>
                                Cancel
                            </Button>
                            <Button type="submit">Save Changes</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Users Table */}
            <div className="mt-6">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[50px]"></TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead className="w-[80px]" />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {users.map((user) => (
                            <TableRow key={user.id}>
                                <TableCell>
                                    <AvatarWithInitials
                                        username={user.name}
                                        avatarSrc={user.profile}
                                        size="sm"
                                    />
                                </TableCell>
                                <TableCell className="font-medium">{user.name}</TableCell>
                                <TableCell>{user.email}</TableCell>
                                <TableCell className="capitalize">{user.role}</TableCell>
                                <TableCell className="flex gap-1">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleResetPassword(user)}
                                        title="Force Password Reset"
                                    >
                                        <Key className="h-4 w-4 text-muted-foreground" />
                                    </Button>

                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => openEdit(user)}
                                    >
                                        <Pencil className="h-4 w-4" />
                                    </Button>

                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleDelete(user.id)}
                                    >
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </DefaultLayout>
    );
}