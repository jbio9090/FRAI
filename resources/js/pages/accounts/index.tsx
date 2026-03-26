import { useState } from "react";
import { usePage } from "@inertiajs/react";
import { UserPlus2, Trash2, Pencil, UserPen } from "lucide-react";
import DefaultLayout from "@/layout.tsx/default.";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { router } from "@inertiajs/react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";

interface User {
    id: number;
    name: string;
    email: string;
    role: string;
}

interface Props {
    users: User[];
    roles: string[];
}

interface UserForm {
    username: string;
    email: string;
    password: string;
    role: string;
}

interface AccountForm {
    username: string;
    email: string;
    password: string;
}

interface PageProps {
    errors: Partial<Record<keyof AccountForm, string>>;
    [key: string]: unknown;
}

const emptyForm: UserForm = { username: "", email: "", password: "", role: "" };

export default function AccountsPage({ users, roles }: Props) {
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [addForm, setAddForm] = useState<UserForm>(emptyForm);
    const [editForm, setEditForm] = useState<UserForm>(emptyForm);
    const { errors } = usePage<PageProps>().props;
    console.log(users);

    const handleAdd = (e: React.FormEvent) => {
        e.preventDefault();
        router.post(route("accounts.store"), {
            name: addForm.username,
            email: addForm.email,
            password: addForm.password,
            role: addForm.role,
        }, {
            onSuccess: () => {
                setIsAddOpen(false);
                setAddForm(emptyForm);
            },
        });
    };

    const openEdit = (user: User) => {
        setEditingUser(user);
        setEditForm({ username: user.name, email: user.email, password: "", role: user.role });
    };

    const handleEdit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingUser) return;
        router.put(route("accounts.update", editingUser.id), {
            name: editForm.username,
            email: editForm.email,
            password: editForm.password || undefined,
            role: editForm.role,
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
            <div className="flex flex-col gap-1.5">
                <Label>
                    <span>
                        Username
                    </span>
                </Label>
                <Input
                    type="text"
                    placeholder="Enter username"
                    value={form.username}
                    className={errors.name ? "border-destructive focus-visible:ring-destructive" : ""}
                    onChange={(e) => onChange({ ...form, username: e.target.value })}
                />
                {errors.username && (
                    <p className="text-sm text-destructive">{errors.name}</p>
                )}
            </div>
            <div className="flex flex-col gap-1.5">
                <Label>Email</Label>
                <Input
                    type="email"
                    placeholder="Enter email"
                    value={form.email}
                    className={errors.name ? "border-destructive focus-visible:ring-destructive" : ""}
                    onChange={(e) => onChange({ ...form, email: e.target.value })}
                />
                {errors.email && (
                    <p className="text-sm text-destructive">{errors.name}</p>
                )}
            </div>
            <div className="flex flex-col gap-1.5">
                <Label>{isEdit ? "New Password" : "Password"}</Label>
                <Input
                    type="password"
                    placeholder={isEdit ? "Leave blank to keep current" : "Enter password"}
                    value={form.password}
                    className={errors.name ? "border-destructive focus-visible:ring-destructive" : ""}
                    onChange={(e) => onChange({ ...form, password: e.target.value })}
                />
                {errors.password && (
                    <p className="text-sm text-destructive">{errors.name}</p>
                )}
            </div>
            <div className="flex flex-col gap-1.5">
                <Label>Role</Label>
                <Select
                    value={form.role}
                    onValueChange={(v) =>
                        onChange({ ...form, role: v })}
                >
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
            <Dialog open={!!editingUser} onOpenChange={(open) => {
                if (!open) setEditingUser(null);
            }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 mb-8">
                            <UserPen />
                            Edit User
                        </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleEdit} className="flex flex-col gap-4">
                        <FormFields form={editForm} onChange={setEditForm} isEdit />
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setEditingUser(null)}>
                                Cancel
                            </Button>
                            <Button type="submit">Update</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Users Table */}
            <div className="mt-6">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead className="w-[80px]" />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {users.map((user) => (
                            <TableRow key={user.id}>
                                <TableCell>{user.name}</TableCell>
                                <TableCell>{user.email}</TableCell>
                                <TableCell className="capitalize">{user.role}</TableCell>
                                <TableCell className="flex gap-1">
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