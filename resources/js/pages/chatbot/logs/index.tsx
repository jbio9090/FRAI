import { router } from '@inertiajs/react';
import { useMemo, useState } from 'react';
import SmartPagination from '@/components/SmartPagination';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import DefaultLayout from '@/layout.tsx/default.';

type LogUser = {
    id: number;
    name: string;
    email?: string;
};

type LogRequest = {
    id: number;
    title: string;
};

type ChatbotInteractionLog = {
    id: number;
    created_at: string;
    session_id: string | null;
    interaction_type: string | null;
    intent: string | null;
    user_message: string | null;
    assistant_message: string | null;
    context_data: Record<string, unknown> | null;
    generated_payload: Record<string, unknown> | null;
    validation_result: Record<string, unknown> | null;
    status: string;
    user: LogUser | null;
    facility_request?: LogRequest | null;
};

type PaginatedLogs = {
    data: ChatbotInteractionLog[];
    current_page: number;
    last_page: number;
    total: number;
};

type Option = string;

type Filters = {
    user: string;
    status: string;
    intent: string;
    date: string;
    search: string;
};

type PageProps = {
    logs: PaginatedLogs;
    filters: Filters;
    users: LogUser[];
    statusOptions: Option[];
    intentOptions: Option[];
};

function preview(text: string | null, max = 90): string {
    if (!text) return '-';

    return text.length > max ? `${text.slice(0, max)}...` : text;
}

function prettyJson(value: Record<string, unknown> | null): string {
    if (!value || Object.keys(value).length === 0) {
        return 'No data';
    }

    return JSON.stringify(value, null, 2);
}

export default function ChatbotLogsPage({ logs, filters, users, statusOptions, intentOptions }: PageProps) {
    const [form, setForm] = useState<Filters>(filters);

    const activeFilterCount = useMemo(() => {
        return Object.values(form).filter(Boolean).length;
    }, [form]);

    const applyFilters = (page?: number) => {
        const payload = Object.fromEntries(
            Object.entries({ ...form, page }).filter(([, value]) => value !== '' && value !== undefined),
        );

        router.get(route('chatbot.logs.index'), payload, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const resetFilters = () => {
        const cleared = {
            user: '',
            status: '',
            intent: '',
            date: '',
            search: '',
        };

        setForm(cleared);
        router.get(route('chatbot.logs.index'), {}, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    return (
        <DefaultLayout>
            <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h1 className="text-xl font-bold">Chatbot Interaction Logs</h1>
                        <p className="text-sm text-muted-foreground">
                            Review chatbot responses, generated request payloads, validation outcomes, and the backend context used.
                        </p>
                    </div>
                    <div className="text-sm text-muted-foreground">
                        {logs.total} total log{logs.total === 1 ? '' : 's'}
                    </div>
                </div>

                <div className="grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-5">
                    <div className="md:col-span-2">
                        <label className="mb-1 block text-sm font-medium">Search</label>
                        <Input
                            value={form.search}
                            onChange={(e) => setForm(prev => ({ ...prev, search: e.target.value }))}
                            placeholder="User, question, or reply"
                        />
                    </div>

                    <div>
                        <label className="mb-1 block text-sm font-medium">User</label>
                        <select
                            value={form.user}
                            onChange={(e) => setForm(prev => ({ ...prev, user: e.target.value }))}
                            className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm"
                        >
                            <option value="">All users</option>
                            {users.map((user) => (
                                <option key={user.id} value={String(user.id)}>{user.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="mb-1 block text-sm font-medium">Status</label>
                        <select
                            value={form.status}
                            onChange={(e) => setForm(prev => ({ ...prev, status: e.target.value }))}
                            className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm"
                        >
                            <option value="">All statuses</option>
                            {statusOptions.map((status) => (
                                <option key={status} value={status}>{status}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="mb-1 block text-sm font-medium">Intent</label>
                        <select
                            value={form.intent}
                            onChange={(e) => setForm(prev => ({ ...prev, intent: e.target.value }))}
                            className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm"
                        >
                            <option value="">All intents</option>
                            {intentOptions.map((intent) => (
                                <option key={intent} value={intent}>{intent}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="mb-1 block text-sm font-medium">Date</label>
                        <Input
                            type="date"
                            value={form.date}
                            onChange={(e) => setForm(prev => ({ ...prev, date: e.target.value }))}
                        />
                    </div>

                    <div className="flex items-end gap-2 md:col-span-5">
                        <Button onClick={() => applyFilters()}>Apply Filters</Button>
                        <Button variant="outline" onClick={resetFilters}>Reset</Button>
                        <div className="text-sm text-muted-foreground">
                            {activeFilterCount} active filter{activeFilterCount === 1 ? '' : 's'}
                        </div>
                    </div>
                </div>

                <div className="overflow-hidden rounded-xl border bg-card">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-40">Timestamp</TableHead>
                                    <TableHead className="w-40">User</TableHead>
                                    <TableHead className="w-36">Intent</TableHead>
                                    <TableHead>User Message</TableHead>
                                    <TableHead>Assistant Reply</TableHead>
                                    <TableHead className="w-32">Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {logs.data.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                                            No chatbot logs found for the current filters.
                                        </TableCell>
                                    </TableRow>
                                )}

                                {logs.data.map((log) => (
                                    <TableRow key={log.id} className="align-top">
                                        <TableCell className="text-sm text-muted-foreground">
                                            {new Date(log.created_at).toLocaleString()}
                                        </TableCell>
                                        <TableCell>
                                            <div className="font-medium">{log.user?.name ?? 'Guest / Unknown'}</div>
                                            <div className="text-xs text-muted-foreground">{log.session_id ?? 'No session'}</div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="font-medium">{log.intent ?? log.interaction_type ?? '-'}</div>
                                            {log.interaction_type && log.intent !== log.interaction_type && (
                                                <div className="text-xs text-muted-foreground">{log.interaction_type}</div>
                                            )}
                                        </TableCell>
                                        <TableCell className="max-w-xs whitespace-normal">{preview(log.user_message)}</TableCell>
                                        <TableCell className="max-w-xs whitespace-normal">{preview(log.assistant_message)}</TableCell>
                                        <TableCell>
                                            <span className="inline-flex rounded-full border px-2 py-1 text-xs font-medium capitalize">
                                                {log.status.replace('_', ' ')}
                                            </span>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </div>

                <Accordion type="single" collapsible className="rounded-xl border bg-card px-4">
                    {logs.data.map((log) => (
                        <AccordionItem key={`detail-${log.id}`} value={`log-${log.id}`}>
                            <AccordionTrigger className="text-left hover:no-underline">
                                <div className="flex flex-col gap-1 pr-4">
                                    <span className="font-medium">
                                        Log #{log.id} � {log.intent ?? log.interaction_type ?? 'general_chat'} � {log.status}
                                    </span>
                                    <span className="text-sm text-muted-foreground">
                                        {preview(log.user_message, 120)}
                                    </span>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent>
                                <div className="grid gap-4 lg:grid-cols-2">
                                    <div className="space-y-2 rounded-lg border p-3">
                                        <h2 className="font-semibold">Conversation</h2>
                                        <div>
                                            <p className="text-xs uppercase tracking-wide text-muted-foreground">User</p>
                                            <p className="whitespace-pre-wrap text-sm">{log.user_message ?? 'No user message captured.'}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Assistant</p>
                                            <p className="whitespace-pre-wrap text-sm">{log.assistant_message ?? 'No assistant reply captured.'}</p>
                                        </div>
                                        {log.facility_request && (
                                            <div>
                                                <p className="text-xs uppercase tracking-wide text-muted-foreground">Linked Request</p>
                                                <p className="text-sm">#{log.facility_request.id} � {log.facility_request.title}</p>
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-4">
                                        <div className="rounded-lg border p-3">
                                            <h2 className="mb-2 font-semibold">Context Data</h2>
                                            <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted p-3 text-xs">
                                                {prettyJson(log.context_data)}
                                            </pre>
                                        </div>

                                        <div className="rounded-lg border p-3">
                                            <h2 className="mb-2 font-semibold">Generated Payload</h2>
                                            <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted p-3 text-xs">
                                                {prettyJson(log.generated_payload)}
                                            </pre>
                                        </div>

                                        <div className="rounded-lg border p-3">
                                            <h2 className="mb-2 font-semibold">Validation Result</h2>
                                            <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted p-3 text-xs">
                                                {prettyJson(log.validation_result)}
                                            </pre>
                                        </div>
                                    </div>
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>

                {logs.last_page > 1 && (
                    <div className="flex justify-center">
                        <SmartPagination
                            currentPage={logs.current_page}
                            lastPage={logs.last_page}
                            onPageChange={(page) => applyFilters(page)}
                        />
                    </div>
                )}
            </div>
        </DefaultLayout>
    );
}
