import { useRef } from 'react';
import AvatarWithInitials from '@/components/avatar-with-initials';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import type { AccountFormErrors, UserForm } from '@/pages/accounts/types';

interface AccountFormFieldsProps {
    form: UserForm;
    onChange: (form: UserForm) => void;
    errors: AccountFormErrors;
    roleOptions: string[];
    avatarSrc?: string;
    isEdit?: boolean;
}

/**
 * Fields shared by the Add User and Edit User dialogs.
 *
 * This must stay a module-scope component. Declaring it inside the page body
 * creates a new component type on every parent render, so React unmounts and
 * remounts the inputs mid-keystroke and focus is lost after one character.
 * All parent state is passed in as props rather than captured in a closure.
 */
export default function AccountFormFields({
    form,
    onChange,
    errors,
    roleOptions,
    avatarSrc,
    isEdit = false,
}: AccountFormFieldsProps) {
    // Per-instance ref: each dialog owns its own hidden file input, so picking
    // a photo in one dialog can never leak into the other one's form.
    const fileInputRef = useRef<HTMLInputElement>(null);

    const nameError = errors.name ?? errors.username;

    const handleFileSelect = (file: File | undefined) => {
        if (!file) return;
        if (form.preview) URL.revokeObjectURL(form.preview);
        onChange({ ...form, profile: file, preview: URL.createObjectURL(file) });
    };

    return (
        <>
            <div className="flex flex-col items-center gap-4 mb-4">
                <AvatarWithInitials
                    username={form.username || "User"}
                    avatarSrc={avatarSrc}
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
                        handleFileSelect(e.target.files?.[0]);
                        e.target.value = '';
                    }}
                />
            </div>

            <div className="space-y-4">
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="account-username">Username</Label>
                    <Input
                        id="account-username"
                        type="text"
                        placeholder="Enter username"
                        value={form.username}
                        className={nameError ? "border-destructive" : ""}
                        onChange={(e) => onChange({ ...form, username: e.target.value })}
                    />
                    {nameError && <p className="text-sm text-destructive">{nameError}</p>}
                </div>

                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="account-email">Email</Label>
                    <Input
                        id="account-email"
                        type="email"
                        placeholder="Enter email"
                        value={form.email}
                        className={errors.email ? "border-destructive" : ""}
                        onChange={(e) => onChange({ ...form, email: e.target.value })}
                    />
                    {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                </div>

                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="account-position">Position</Label>
                    <Input
                        id="account-position"
                        type="text"
                        placeholder="Enter position"
                        value={form.position}
                        className={errors.position ? "border-destructive" : ""}
                        onChange={(e) => onChange({ ...form, position: e.target.value })}
                    />
                    {errors.position && <p className="text-sm text-destructive">{errors.position}</p>}
                </div>

                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="account-role">Role</Label>
                    <Select value={form.role} onValueChange={(v) => onChange({ ...form, role: v })}>
                        <SelectTrigger id="account-role" className={errors.role ? "border-destructive" : ""}>
                            <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                            {roleOptions.map((r) => (
                                <SelectItem key={r} value={r}>
                                    {r[0].toUpperCase() + r.slice(1)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {errors.role && <p className="text-sm text-destructive">{errors.role}</p>}
                </div>

                {!isEdit && (
                    <div className="flex flex-col gap-1.5 mb-3 mt-2">
                        <p className="text-center text-sm text-muted-foreground">A random password will appear once the account has been created. Copy it and send to the user</p>
                    </div>
                )}
            </div>
        </>
    );
}
