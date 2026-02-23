import { useState } from "react";
import { UserPlus2, Trash2 } from "lucide-react";
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

interface User {
    id: number;
    name: string;
    email: string;
}

export default function FacilityDetail({ users }: { users: User[] }) {
    const [isOpen, setIsOpen] = useState(false);
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [email, setEmail] = useState("");

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        router.post(route("accounts.store"), {
            name: username,
            email,
            password,
        }, {
            onSuccess: () => {
                setIsOpen(false);
                setUsername("");
                setEmail("");
                setPassword("");
            }
        });
    };

    const handleDelete = (id: number) => {
        router.delete(route("accounts.destroy", id));
    };

    return (
        <DefaultLayout>
            <h1 className='font-bold text-xl'>Account Management</h1>

            <div className="mt-6 w-full max-w-sm">
                <Button
                    variant="outline"
                    className="flex items-center gap-2"
                    onClick={() => setIsOpen(!isOpen)}
                >
                    <UserPlus2 className="h-4 w-4" />
                    Add User
                </Button>

                {isOpen && (
                    <form onSubmit={handleSubmit} className="mt-2 flex flex-col gap-4 rounded-md border p-4">
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="username">Username</Label>
                            <Input
                                id="username"
                                type="text"
                                placeholder="Enter username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                            />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="Enter email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="password">Password</Label>
                            <Input
                                id="password"
                                type="password"
                                placeholder="Enter password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>

                        <Button type="submit" className="w-full">
                            Save Credentials
                        </Button>
                    </form>
                )}
            </div>

            <div className="mt-6">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead className="w-[50px]" />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {users.map((user) => (
                            <TableRow key={user.id}>
                                <TableCell>{user.name}</TableCell>
                                <TableCell>{user.email}</TableCell>
                                <TableCell>
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