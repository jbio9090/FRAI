import { usePage } from "@inertiajs/react";
import { router } from "@inertiajs/react";
import { UserPlus2, Trash2, Pencil, UserPen, Check, Copy, AlertTriangle, Key, Upload, Download, Users, FileText, CircleAlert, CircleCheck, Loader2, Search, ArrowDownUp } from "lucide-react";
import SmartPagination from '@/components/SmartPagination';
import { useState, useRef, useEffect, useMemo } from "react";
import AvatarWithInitials from "@/components/avatar-with-initials";
import { Button } from "@/components/ui/button";
import { usePermission } from '@/hooks/use-permission';
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

interface PaginatedUsers {
    data: User[];
    links?: { url: string | null; label: string; active: boolean }[];
    current_page: number;
    last_page: number;
    per_page?: number;
    total?: number;
}

interface Props {
    users: PaginatedUsers | User[];
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
        };
        batch_results?: {
            created: { name: string; email: string; temp_password: string }[];
            failed: { row: number; name: string; email: string; reason: string }[];
        };
    };
}

interface CsvRow {
    name: string;
    email: string;
    role: string;
    status: 'pending' | 'valid' | 'warning' | 'error';
    error?: string;
}

const emptyForm: UserForm = { username: "", email: "", role: "", profile: null };

const CSV_HEADERS = ['name', 'email', 'role'];
const CSV_TEMPLATE = `name,email,role\nJohn Doe,johndoe@example.com,admin\nJane Smith,janesmith@example.com,staff`;

export default function AccountsPage({ users, roles }: Props) {
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [isBatchOpen, setIsBatchOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [addForm, setAddForm] = useState<UserForm>(emptyForm);
    const [editForm, setEditForm] = useState<UserForm>(emptyForm);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const csvInputRef = useRef<HTMLInputElement>(null);
    const { errors } = usePage<PageProps>().props;
    const { flash } = usePage<PageProps>().props;
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [showBatchResultsModal, setShowBatchResultsModal] = useState(false);
    const [copied, setCopied] = useState(false);
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

    // Batch state
    const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
    const [csvFileName, setCsvFileName] = useState<string>('');
    const [isBatchSubmitting, setIsBatchSubmitting] = useState(false);
    const [batchParseError, setBatchParseError] = useState<string>('');

    // Server-side listing helpers
    const userList: User[] = Array.isArray(users) ? users : ((users as any)?.data ?? []);
    const [searchQuery, setSearchQuery] = useState('');
    const [sort, setSort] = useState('');
    const isMounted = useRef(false);

    const { user, hasRole } = usePermission();
    const isAdmin = (user?.roles ?? []).some(r => (r ?? '').toLowerCase() === 'admin');
    const isSuperAdmin = (user?.roles ?? []).some(r => (r ?? '').toLowerCase() === 'super admin' || (r ?? '').toLowerCase() === 'superadmin');

    // Roles available when creating new accounts (remove Super Admin always)
    const addRoleOptions = useMemo(() => {
        let available = roles.filter(r => r !== 'super admin');
        if (isAdmin) return available.filter(r => r === 'department head');
        if (isSuperAdmin) return available.filter(r => ['admin', 'department head'].includes(r));
        return available;
    }, [roles, isAdmin, isSuperAdmin]);

    // Roles available when editing: disallow Super Admin
    const editRoleOptions = roles.filter(r => r !== 'super admin');

    useEffect(() => {
        if (!isMounted.current) {
            isMounted.current = true;
            return;
        }

        const timeout = setTimeout(() => {
            router.get(route('accounts.index'), { search: searchQuery, sort: sort === 'none' ? '' : sort }, {
                preserveState: true,
                preserveScroll: true,
            });
        }, 400);

        return () => clearTimeout(timeout);
    }, [searchQuery]);

    const handleSortChange = (value: string) => {
        setSort(value);
        router.get(route('accounts.index'), { sort: value === 'none' ? '' : value }, { preserveState: true, preserveScroll: true });
    };

    useEffect(() => {
        if (flash?.temp_password_reset) {
            setShowPasswordModal(true);
            setCopied(false);
        }
    }, [flash?.temp_password_reset]);

    useEffect(() => {
        if (flash?.batch_results) {
            setIsBatchOpen(false);
            setShowBatchResultsModal(true);
            setCsvRows([]);
            setCsvFileName('');
        }
    }, [flash?.batch_results]);

    const copyToClipboard = async () => {
        if (flash?.temp_password_reset) {
            await navigator.clipboard.writeText(flash.temp_password_reset.temp_password);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const copyBatchPassword = async (password: string, index: number) => {
        await navigator.clipboard.writeText(password);
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(null), 2000);
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
            role: (user.role ?? '').toString().toLowerCase(),
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

    const downloadBatchPasswordsCsv = () => {
        if (!flash?.batch_results?.created) return;

        const headers = ['Name', 'Email', 'Temporary Password'];
        const rows = flash.batch_results.created.map(acc => [
            `"${acc.name}"`, // Quote strings to handle names with commas
            `"${acc.email}"`,
            `"${acc.temp_password}"`
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(e => e.join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `batch_credentials_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const exportCsvTemplate = () => {
        const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'accounts_template.csv';
        a.click();
        URL.revokeObjectURL(url);
    };

    const validateRow = (row: Record<string, string>, index: number): CsvRow => {
        const name = row['name']?.trim() ?? '';
        const email = row['email']?.trim() ?? '';
        const role = row['role']?.trim() ?? '';
        const roleFromCsv = row['role']?.trim().toLowerCase() ?? '';
        const isValidRole = addRoleOptions.includes(roleFromCsv);

        if (!roleFromCsv || !isValidRole)
            return {
                name, email, role,
                status: 'error',
                error: `Invalid role. Valid options: ${addRoleOptions.join(', ')}`
            };
        if (!name) return { name, email, role, status: 'error', error: `Row ${index + 1}: Name is required` };
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
            return { name, email, role, status: 'error', error: `Row ${index + 1}: Invalid email address` };
        if (!role || !addRoleOptions.map(r => r.toLowerCase()).includes(role.toLowerCase()))
            return { name, email, role, status: 'error', error: `Row ${index + 1}: Role "${role}" is not valid` };

        // If the email already exists in the system, mark as a warning
        const emailLower = email.toLowerCase();
        const existsInSystem = userList.some(u => (u.email ?? '').toLowerCase() === emailLower);
        if (existsInSystem) {
            return { name, email, role, status: 'warning', error: `Email already exists in system: ${email}` };
        }

        return { name, email, role, status: 'valid' };
    };

    const parseCsv = (text: string): CsvRow[] => {
        const lines = text.trim().split('\n').map(l => l.replace(/\r$/, ''));
        if (lines.length < 2) return [];

        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        const missingHeaders = CSV_HEADERS.filter(h => !headers.includes(h));
        if (missingHeaders.length > 0) {
            setBatchParseError(`CSV is missing required columns: ${missingHeaders.join(', ')}`);
            return [];
        }

        // First pass: parse and validate rows
        const parsed = lines.slice(1).filter(l => l.trim()).map((line, i) => {
            const values = line.split(',').map(v => v.trim());
            const row: Record<string, string> = {};
            headers.forEach((h, idx) => { row[h] = values[idx] ?? ''; });
            return validateRow(row, i);
        });

        // Detect duplicate emails within the CSV and mark them as warnings
        const emailCounts = parsed.reduce((acc: Record<string, number>, r) => {
            const e = (r.email ?? '').toLowerCase().trim();
            if (!e) return acc;
            acc[e] = (acc[e] || 0) + 1;
            return acc;
        }, {});

        return parsed.map(r => {
            const e = (r.email ?? '').toLowerCase().trim();
            if (e && (emailCounts[e] ?? 0) > 1 && r.status !== 'error') {
                return { ...r, status: 'warning', error: `Duplicate email in CSV: ${r.email}` };
            }
            return r;
        });
    };

    const handleCsvFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setBatchParseError('');
        setCsvFileName(file.name);

        const reader = new FileReader();
        reader.onload = (evt) => {
            const text = evt.target?.result as string;
            const rows = parseCsv(text);
            setCsvRows(rows);
        };
        reader.readAsText(file);

        // Reset input so same file can be re-selected
        e.target.value = '';
    };

    const handleBatchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const validRows = csvRows.filter(r => r.status === 'valid');
        if (validRows.length === 0) return;

        setIsBatchSubmitting(true);
        router.post(route("accounts.batch-store"), {
            accounts: validRows.map(r => ({ name: r.name, email: r.email, role: r.role })),
        }, {
            onFinish: () => setIsBatchSubmitting(false),
        });
    };

    const validCount = csvRows.filter(r => r.status === 'valid').length;
    const errorCount = csvRows.filter(r => r.status === 'error').length;
    const warningCount = csvRows.filter(r => r.status === 'warning').length;

    const existingWarningCount = csvRows.filter(r => r.status === 'warning' && r.error?.startsWith('Email already exists in system')).length;
    const duplicateWarningCount = csvRows.filter(r => r.status === 'warning' && r.error?.startsWith('Duplicate email in CSV')).length;

    const warningSummary = (() => {
        if (warningCount === 0) return '';
        if (existingWarningCount > 0 && duplicateWarningCount === 0) {
            return `${existingWarningCount} email${existingWarningCount !== 1 ? 's' : ''} already exist in the system`;
        }
        if (duplicateWarningCount > 0 && existingWarningCount === 0) {
            return `${duplicateWarningCount} duplicate email${duplicateWarningCount !== 1 ? 's' : ''} in CSV`;
        }
        return `${warningCount} emails: ${existingWarningCount} already in system, ${duplicateWarningCount} duplicates in CSV`;
    })();

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
                            {(isEdit ? editRoleOptions : addRoleOptions).map((r) => (
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

            
            <div className="mt-6 flex items-center w-full gap-3 mb-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search accounts…"
                        className="pl-9"
                    />
                </div>

                <div className="w-44">
                    <Select value={sort} onValueChange={handleSortChange}>
                        <SelectTrigger>
                            <SelectValue placeholder="Sort" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            <SelectItem value="name-asc">Name (A → Z)</SelectItem>
                            <SelectItem value="name-desc">Name (Z → A)</SelectItem>
                            <SelectItem value="email-asc">Email (A → Z)</SelectItem>
                            <SelectItem value="email-desc">Email (Z → A)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <Button
                    variant="outline"
                    className="flex items-center gap-2 ml-auto"
                    onClick={() => setIsAddOpen(true)}
                >
                    <UserPlus2 className="h-4 w-4" />
                    Add User
                </Button>

                <Button
                    variant="default"
                    className="flex items-center gap-2 mr-0"
                    onClick={() => setIsBatchOpen(true)}
                >
                    <Users className="h-4 w-4" />
                    Batch Import
                </Button>
            </div>

            {/* ── Temp Password Modal ───────────────────────────────────────── */}
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

            {/* ── Batch Results Modal ───────────────────────────────────────── */}
            <Dialog open={showBatchResultsModal} onOpenChange={setShowBatchResultsModal}>
                <DialogContent className="sm:max-w-2xl border-t-4 border-t-primary max-h-[90vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Users className="h-5 w-5 text-primary" />
                            Batch Import Results
                        </DialogTitle>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto flex flex-col gap-4 py-2">
                        {/* Summary */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="flex items-center gap-3 rounded-lg border bg-green-50 dark:bg-green-950/20 p-3">
                                <CircleCheck className="h-5 w-5 text-green-600 shrink-0" />
                                <div>
                                    <p className="text-sm font-medium text-green-700 dark:text-green-400">Successfully Created</p>
                                    <p className="text-2xl font-bold text-green-700 dark:text-green-400">{flash?.batch_results?.created.length ?? 0}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 rounded-lg border bg-red-50 dark:bg-red-950/20 p-3">
                                <CircleAlert className="h-5 w-5 text-red-600 shrink-0" />
                                <div>
                                    <p className="text-sm font-medium text-red-700 dark:text-red-400">Failed</p>
                                    <p className="text-2xl font-bold text-red-700 dark:text-red-400">{flash?.batch_results?.failed.length ?? 0}</p>
                                </div>
                            </div>
                        </div>

                        {/* Created accounts */}
                        {(flash?.batch_results?.created.length ?? 0) > 0 && (
                            <div className="flex flex-col gap-2">
                                <p className="text-sm font-semibold text-foreground">Created Accounts & Temporary Passwords</p>
                                <p className="text-xs text-muted-foreground -mt-1">Copy each password and share it securely. Users must change it on first login.</p>
                                <div className="rounded-md border divide-y overflow-hidden">
                                    {flash?.batch_results?.created.map((acc, i) => (
                                        <div key={i} className="flex items-center gap-3 px-3 py-2.5 bg-background">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium truncate">{acc.name}</p>
                                                <p className="text-xs text-muted-foreground truncate">{acc.email}</p>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <code className="text-sm font-mono bg-muted px-2 py-1 rounded tracking-wider">{acc.temp_password}</code>
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-7 w-7"
                                                    onClick={() => copyBatchPassword(acc.temp_password, i)}
                                                >
                                                    {copiedIndex === i
                                                        ? <Check className="h-3.5 w-3.5 text-green-500" />
                                                        : <Copy className="h-3.5 w-3.5" />}
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Failed rows */}
                        {(flash?.batch_results?.failed.length ?? 0) > 0 && (
                            <div className="flex flex-col gap-2">
                                <p className="text-sm font-semibold text-foreground">Failed Rows</p>
                                <div className="rounded-md border divide-y overflow-hidden">
                                    {flash?.batch_results?.failed.map((f, i) => (
                                        <div key={i} className="flex items-start gap-3 px-3 py-2.5 bg-red-50/50 dark:bg-red-950/10">
                                            <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium">{f.name || '(empty)'} — {f.email || '(empty)'}</p>
                                                <p className="text-xs text-red-600 dark:text-red-400">{f.reason}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <DialogFooter className="pt-2 border-t">
                        <Button className="w-full" onClick={() => setShowBatchResultsModal(false)}>
                            Done
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Add Dialog ───────────────────────────────────────────────── */}
            <Dialog open={isAddOpen} onOpenChange={(open) => {
                setIsAddOpen(open);
                if (!open) setAddForm(emptyForm);
            }}>
                <DialogContent className="w-[calc(100vw-2rem)] max-w-lg max-h-[85dvh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <UserPlus2 />
                            Add User
                        </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleAdd} className="flex flex-col gap-4 mb-8">
                        <FormFields form={addForm} onChange={setAddForm} />
                        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
                            <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => setIsAddOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" className="w-full sm:w-auto">Save Credentials</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* ── Edit Dialog ──────────────────────────────────────────────── */}
            <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
                <DialogContent className="w-[calc(100vw-2rem)] max-w-lg max-h-[85dvh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <UserPen className="h-5 w-5" />
                            Edit User Profile
                        </DialogTitle>
                    </DialogHeader>

                    <form onSubmit={handleEdit} className="space-y-6">
                        <FormFields form={editForm} onChange={setEditForm} isEdit />

                        <div className="pt-4 border-t">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-lg bg-muted/50 border border-dashed">
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

                        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
                            <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => setEditingUser(null)}>
                                Cancel
                            </Button>
                            <Button type="submit" className="w-full sm:w-auto">Save Changes</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* ── Batch Import Dialog ──────────────────────────────────────── */}
            <Dialog open={isBatchOpen} onOpenChange={(open) => {
                if (!open) { setCsvRows([]); setCsvFileName(''); setBatchParseError(''); }
                setIsBatchOpen(open);
            }}>
                <DialogContent className="flex flex-col w-[calc(100vw-2rem)] max-w-2xl max-h-[85dvh] overflow-hidden p-4 sm:p-6">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Users className="h-5 w-5" />
                            Batch Import Accounts
                        </DialogTitle>
                    </DialogHeader>

                    <form onSubmit={handleBatchSubmit} className="flex flex-col gap-4 flex-1 overflow-y-auto min-h-0">

                        {/* Instructions + action buttons */}
                        <div className="rounded-lg border bg-muted/40 p-4 flex flex-col gap-3">
                            <div className="flex items-start gap-3">
                                <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    Upload a <strong className="text-foreground">.csv</strong> file with columns: <code className="bg-muted px-1 rounded text-xs">name</code>, <code className="bg-muted px-1 rounded text-xs">email</code>, <code className="bg-muted px-1 rounded text-xs">role</code>. Each account will receive a random temporary password that must be changed on first login.
                                </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="gap-2"
                                    onClick={exportCsvTemplate}
                                >
                                    <Download className="h-4 w-4" />
                                    Export CSV Template
                                </Button>

                                <Button
                                    type="button"
                                    variant="default"
                                    size="sm"
                                    className="gap-2"
                                    onClick={() => csvInputRef.current?.click()}
                                >
                                    <Upload className="h-4 w-4" />
                                    {csvFileName ? 'Replace CSV' : 'Import CSV'}
                                </Button>

                                <input
                                    ref={csvInputRef}
                                    type="file"
                                    accept=".csv,text/csv"
                                    className="hidden"
                                    onChange={handleCsvFile}
                                />

                                {csvFileName && (
                                    <span className="text-xs text-muted-foreground truncate max-w-[160px]" title={csvFileName}>
                                        {csvFileName}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Parse error */}
                        {batchParseError && (
                            <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                                <AlertTriangle className="h-4 w-4 shrink-0" />
                                {batchParseError}
                            </div>
                        )}

                        {/* Preview table */}
                        {csvRows.length > 0 && (
                            <div className="flex flex-col gap-2 flex-1 overflow-hidden">
                                <div className="flex items-center justify-between">
                                    <p className="text-sm font-medium">Preview</p>
                                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                        {validCount > 0 && (
                                            <span className="flex items-center gap-1 text-green-600">
                                                <CircleCheck className="h-3.5 w-3.5" />
                                                {validCount} valid
                                            </span>
                                        )}

                                        {warningCount > 0 && (
                                            <span className="flex items-center gap-1 text-amber-600">
                                                <CircleAlert className="h-3.5 w-3.5" />
                                                {warningCount} warnings
                                            </span>
                                        )}

                                        {errorCount > 0 && (
                                            <span className="flex items-center gap-1 text-destructive">
                                                <CircleAlert className="h-3.5 w-3.5" />
                                                {errorCount} with errors
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="rounded-md border overflow-auto flex-1 max-h-64">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-8">#</TableHead>
                                                <TableHead>Name</TableHead>
                                                <TableHead className="hidden sm:table-cell">Email</TableHead>
                                                <TableHead>Role</TableHead>
                                                <TableHead className="w-6"></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {csvRows.map((row, i) => (
                                                    <TableRow key={i} className={row.status === 'error' ? 'bg-destructive/5' : row.status === 'warning' ? 'bg-yellow-50 dark:bg-yellow-950/10' : ''}>
                                                    <TableCell className="text-muted-foreground text-xs">{i + 1}</TableCell>
                                                    <TableCell className="font-medium">{row.name || <span className="text-muted-foreground italic">empty</span>}</TableCell>
                                                    <TableCell className="hidden sm:table-cell">{row.email || <span className="text-muted-foreground italic">empty</span>}</TableCell>
                                                    <TableCell className="capitalize">{row.role || <span className="text-muted-foreground italic">empty</span>}</TableCell>
                                                    <TableCell>
                                                            {row.status === 'valid' ? (
                                                                <CircleCheck className="h-4 w-4 text-green-500" />
                                                            ) : row.status === 'warning' ? (
                                                                <span title={row.error}>
                                                                    <CircleAlert className="h-4 w-4 text-amber-500" />
                                                                </span>
                                                            ) : (
                                                                <span title={row.error}>
                                                                    <CircleAlert className="h-4 w-4 text-destructive" />
                                                                </span>
                                                            )}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>

                                {warningCount > 0 && (
                                    <div className="flex flex-col gap-1">
                                        <p className="text-xs text-amber-700 flex items-center gap-1.5">
                                            <AlertTriangle className="h-3 w-3 shrink-0 text-amber-600" />
                                            {warningSummary}
                                        </p>
                                    </div>
                                )}

                                {errorCount > 0 && (
                                    <div className="flex flex-col gap-1">
                                        {csvRows.filter(r => r.status === 'error').map((r, i) => (
                                            <p key={i} className="text-xs text-destructive flex items-center gap-1.5">
                                                <AlertTriangle className="h-3 w-3 shrink-0" />
                                                {r.error}
                                            </p>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Empty state */}
                        {csvRows.length === 0 && !batchParseError && (
                            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-10 text-center gap-2">
                                <Upload className="h-8 w-8 text-muted-foreground/50" />
                                <p className="text-sm text-muted-foreground">No CSV file imported yet</p>
                                <p className="text-xs text-muted-foreground/70">Download the template above to get started</p>
                            </div>
                        )}

                        <DialogFooter className="border-t pt-4 mt-auto flex-col-reverse sm:flex-row gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsBatchOpen(false)}
                                disabled={isBatchSubmitting}
                                className="w-full sm:w-auto"
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={validCount === 0 || isBatchSubmitting}
                                className="gap-2 w-full sm:w-auto"
                            >
                                {isBatchSubmitting
                                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating Accounts…</>
                                    : <><Users className="h-4 w-4" /> Create {validCount > 0 ? validCount : ''} Account{validCount !== 1 ? 's' : ''}</>
                                }
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* ── Users Table ──────────────────────────────────────────────── */}
            <div className="mt-6">
                {!Array.isArray(users) && (users as any).last_page > 1 && (
                    <SmartPagination
                        currentPage={(users as any).current_page}
                        lastPage={(users as any).last_page}
                        onPageChange={(page) =>
                            router.get(route('accounts.index'), { page, search: searchQuery, sort: sort === 'none' ? '' : sort }, { preserveState: true, preserveScroll: true })
                        }
                        className={'my-4 px-4 py-0 md:px-8'}
                    />
                )}

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
                        {userList.map((user) => (
                            <TableRow key={user.id}>
                                <TableCell>
                                    <AvatarWithInitials
                                        username={user.name}
                                        avatarSrc={(user as any).profile}
                                        size="sm"
                                    />
                                </TableCell>
                                <TableCell className="font-medium">{(user as any).name}</TableCell>
                                <TableCell>{(user as any).email}</TableCell>
                                <TableCell className="capitalize">{(user as any).role}</TableCell>
                                <TableCell className="flex gap-1">

                                    {hasRole("Super Admin") && (<Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleResetPassword(user)}
                                        title="Force Password Reset"
                                    >
                                        <Key className="h-4 w-4 text-muted-foreground" />
                                    </Button>)}

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
                                        onClick={() => handleDelete((user as any).id)}
                                    >
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>

                {!Array.isArray(users) && (users as any).last_page > 1 && (
                    <SmartPagination
                        currentPage={(users as any).current_page}
                        lastPage={(users as any).last_page}
                        onPageChange={(page) =>
                            router.get(route('accounts.index'), { page, search: searchQuery, sort: sort === 'none' ? '' : sort }, { preserveState: true, preserveScroll: true })
                        }
                        className={'my-5 px-4 md:px-8'}
                    />
                )}
            </div>
        </DefaultLayout>
    );
}