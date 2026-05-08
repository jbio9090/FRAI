import { router } from '@inertiajs/react';
import { Deferred } from '@inertiajs/react';
import {
    CheckLine,
    MessageCirclePlus,
    ListFilter,
    MessageCircleOff,
    MousePointer2,
    X,
    Check,
    Search,
    ArrowDownUp,
    GraduationCap,
    Landmark,
    ArrowUp,
    Download,
    FolderOpen,
} from 'lucide-react';
import moment from 'moment';
import { motion, AnimatePresence } from 'motion/react';
import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import RequestCard from '@/components/request-card';
import RequestsSkeleton from '@/components/skeleton/RequestIndexSkeleton';
import SmartPagination from '@/components/SmartPagination';
import { Button } from '@/components/ui/button';
import { usePermission } from '@/hooks/use-permission';
import DefaultLayout from '@/layout.tsx/default.';
import { downloadRequestsCSV } from '@/lib/downloadCSV';
import { cn } from '@/lib/utils';
import type { Facility } from '@/types/facility';
import { Request } from '@/types/request';
import { Popover, PopoverContent, PopoverHeader, PopoverTitle, PopoverTrigger } from '@/components/ui/popover';
import { Field, FieldDescription } from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

export interface PaginatedRequests {
    data: Request[];
    links: { url: string | null; label: string; active: boolean }[];
    current_page: number;
    last_page: number;
    total: number;
}

export interface RequestsPageProps {
    requests?: PaginatedRequests;
    page_title: string;
    filter: string;
    facilities: Facility[];
    requesters: { id: string | number; name: string }[];
}

export const PRIORITY_ICONS: Record<0 | 1 | 2, React.ReactNode> = {
    0: null,
    1: <GraduationCap size={14} />,
    2: <Landmark size={14} />,
};

export default function RequestsPage({ requests, page_title, facilities, requesters }: RequestsPageProps) {
    const [selected, setSelected] = useState<number[]>([]);
    const [isSelecting, setSelectState] = useState<boolean>(false);
    const [bulkComment, setBulkComment] = useState('');
    const [isBulkCommentOpen, setIsBulkCommentOpen] = useState(false);
    const [currentActiveFitler, setActiveFilter] = useState('This Week');
    const [searchQuery, setSearchQuery] = useState('');
    const [sortField, setSortField] = useState<string | null>(null);
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const isMounted = useRef(false);
    const [facilityFilter, setFacilityFilter] = useState<string[]>([]);
    const [requesterFilter, setRequesterFilter] = useState<string[]>([]);
    const [externalEquipmentFilter, setExternalEquipmentFilter] = useState<string>('');
    const [statusFilter, setStatusFilter] = useState<string[]>([]);
    const hasLoadedOnce = useRef(false);
    const staleRequests = useRef<PaginatedRequests | null>(null);

    if (requests !== undefined) {
        hasLoadedOnce.current = true;
        staleRequests.current = requests;
    }

    const displayRequests = staleRequests.current;
    const isInitialLoad = !hasLoadedOnce.current;

    const { hasRole } = usePermission();
    const isAdmin = hasRole(['admin', 'Super Admin']);

    const statusOptions = [
        { label: 'Pending', value: 'pending' },
        { label: 'Approved', value: 'approved' },
        { label: 'Denied', value: 'denied' },
        { label: 'Conditionally Approved', value: 'conditionally_approved' },
        { label: 'For Reschedule', value: 'for_reschedule' },
    ];

    const toggleStatus = (value: string) => {
        setStatusFilter((prev) => (prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value]));
    };

    useEffect(() => {
        if (!isMounted.current) {
            isMounted.current = true;
            return;
        }

        const timeout = setTimeout(() => {
            router.get(
                route(route().current(), { status: route().params.status }),
                {
                    filter: filterMap[currentActiveFitler],
                    search: searchQuery,
                },
                {
                    preserveState: true,
                    preserveScroll: true,
                },
            );
        }, 400);

        return () => clearTimeout(timeout);
    }, [searchQuery]);

    const commonFilterOptions = [{ title: 'Today' }, { title: 'This Week' }, { title: 'This Month' }, { title: 'All' }];

    const sortOptions = [
        { label: 'Date Submitted', value: 'created_at' },
        { label: 'Priority Level', value: 'priority_level' },
        { label: 'Title', value: 'title' },
        { label: 'Requester', value: 'user_name' },
        { label: 'None', value: '' },
    ];

    const filterMap: Record<string, string> = {
        Today: 'today',
        'This Week': 'this_week',
        'This Month': 'this_month',
        All: 'all',
    };

    const getParams = (overrides = {}) => ({
        filter: filterMap[currentActiveFitler],
        search: searchQuery,
        ...(statusFilter.length && { status: statusFilter.join(',') }),
        ...(requesterFilter.length && { requester: requesterFilter.join(',') }),
        ...(facilityFilter.length && { facility: facilityFilter.join(',') }),
        ...(externalEquipmentFilter && { has_external_equipment: externalEquipmentFilter }),
        ...overrides,
    });

    const toggleFacility = (id: string) => {
        setFacilityFilter((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]));
    };

    const toggleRequester = (id: string) => {
        setRequesterFilter((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]));
    };

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchQuery(e.target.value);
    };

    const handleFilterButtonClick = (title: string) => {
        setActiveFilter(title);
        router.get(route(route().current(), { status: route().params.status }), getParams({ filter: filterMap[title] }), {
            preserveState: true,
            preserveScroll: true,
        });
    };

    const applyAdvancedFilters = () => {
        router.get(route(route().current(), { status: route().params.status }), getParams(), { preserveState: true, preserveScroll: true });
    };

    const handleSelection = (request_id: number) => {
        setSelected((prev) => (prev.includes(request_id) ? prev.filter((id) => id !== request_id) : [...prev, request_id]));
    };

    const handleSort = (field: string) => {
        if (field === '') {
            setSortField(null);
            setSortOrder('asc');
            router.get(route(route().current(), { status: route().params.status }), getParams({ sort: undefined, order: undefined }), {
                preserveState: true,
                preserveScroll: true,
            });
            return;
        }

        const newOrder = sortField === field && sortOrder === 'asc' ? 'desc' : 'asc';
        setSortField(field);
        setSortOrder(newOrder);
        router.get(route(route().current(), { status: route().params.status }), getParams({ sort: field, order: newOrder }), {
            preserveState: true,
            preserveScroll: true,
        });
    };

    const clearAllSelection = () => setSelected([]);
    const selectAllSelection = () => setSelected((requests?.data ?? []).map((req) => req.id));

    const toggleSelection = () => {
        setSelectState(!isSelecting);
        if (isSelecting) setSelected([]);
    };

    const bulkAction = (action: string) => {
        router.post(
            route('bulk.action'),
            {
                ids: selected,
                action,
                comment: isBulkCommentOpen && bulkComment.trim().length > 0 ? bulkComment.trim() : null,
            },
            {
                onSuccess: () => {
                    setSelected([]);
                    setSelectState(false);
                    setBulkComment('');
                    setIsBulkCommentOpen(false);
                    router.reload();
                },
            },
        );
    };  

    return (
        <DefaultLayout hasPadding={false}>
            <div className="mx-auto w-full max-w-7xl">
                <h1 className="mb-6 px-4 pt-4 text-xl font-bold md:px-8 md:pt-8 pb-2">Requests</h1>

                <div className="mt-4 flex w-full flex-col flex-wrap justify-center gap-4 px-4 md:px-8">
                    <div className="flex gap-2">
                        <InputGroup className="max-w-xs sm:max-w-sm md:max-w-md">
                            <InputGroupAddon>
                                <Search />
                            </InputGroupAddon>
                            <InputGroupInput placeholder="Search" value={searchQuery} onChange={handleSearch} />
                        </InputGroup>

                        <div className="ml-auto hidden gap-2 sm:flex">
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline">
                                        <ArrowDownUp />
                                        <span>Sort By</span>
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-48 p-0">
                                    <PopoverHeader>
                                        <PopoverTitle className="px-3 py-1 pt-4 text-xs font-semibold text-muted-foreground">Sort By</PopoverTitle>
                                    </PopoverHeader>
                                    <div className="flex flex-col p-1">
                                        {sortOptions.map((option) => (
                                            <Button
                                                key={option.value || 'none'}
                                                onClick={() => handleSort(option.value)}
                                                variant={sortField === option.value || (option.value === '' && !sortField) ? 'secondary' : 'ghost'}
                                                className="w-full justify-between px-2"
                                                size="sm"
                                            >
                                                <span>{option.label}</span>
                                                {option.value !== '' &&
                                                    (sortField === option.value ? (
                                                        sortOrder === 'asc' ? (
                                                            <ArrowUp size={14} className="rotate-180 text-foreground" />
                                                        ) : (
                                                            <ArrowUp size={14} className="text-foreground" />
                                                        )
                                                    ) : (
                                                        <ArrowUp size={14} className="opacity-0" />
                                                    ))}
                                            </Button>
                                        ))}
                                    </div>
                                </PopoverContent>
                            </Popover>

                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className={cn(
                                            (requesterFilter.length || facilityFilter.length || externalEquipmentFilter || statusFilter.length) &&
                                                'border-primary bg-primary/5 text-primary',
                                        )}
                                    >
                                        <ListFilter size={16} />
                                        <span>Filters</span>
                                        {requesterFilter.length + facilityFilter.length + (externalEquipmentFilter ? 1 : 0) + statusFilter.length >
                                            0 && (
                                            <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary/12 px-1 text-[10px] font-medium text-primary">
                                                {requesterFilter.length +
                                                    facilityFilter.length +
                                                    (externalEquipmentFilter ? 1 : 0) +
                                                    statusFilter.length}
                                            </span>
                                        )}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-72 p-0" align="start">
                                    <div className="flex max-h-96 flex-col gap-4 overflow-y-auto p-3">
                                        <div className="flex flex-col gap-2">
                                            <div className="flex items-center justify-between">
                                                <p className="text-xs font-semibold text-muted-foreground">Facility</p>
                                                <Button
                                                    className="text-xs text-primary"
                                                    variant={'ghost'}
                                                    size={'xs'}
                                                    onClick={() =>
                                                        facilityFilter.length === facilities.length
                                                            ? setFacilityFilter([])
                                                            : setFacilityFilter(facilities.map((f) => String(f.id)))
                                                    }
                                                >
                                                    {facilityFilter.length === facilities.length ? 'Deselect all' : 'Select all'}
                                                </Button>
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                {facilities.map((f) => (
                                                    <label
                                                        key={f.id}
                                                        className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            className="accent-primary"
                                                            checked={facilityFilter.includes(String(f.id))}
                                                            onChange={() => toggleFacility(String(f.id))}
                                                        />
                                                        {f.name}
                                                    </label>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-2">
                                            <div className="flex items-center justify-between">
                                                <p className="text-xs font-semibold text-muted-foreground">Status</p>
                                                <Button
                                                    className="text-xs text-primary"
                                                    variant={'ghost'}
                                                    size={'xs'}
                                                    onClick={() =>
                                                        statusFilter.length === statusOptions.length
                                                            ? setStatusFilter([])
                                                            : setStatusFilter(statusOptions.map((o) => o.value))
                                                    }
                                                >
                                                    {statusFilter.length === statusOptions.length ? 'Deselect all' : 'Select all'}
                                                </Button>
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                {statusOptions.map((opt) => (
                                                    <label
                                                        key={opt.value}
                                                        className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            className="accent-primary"
                                                            checked={statusFilter.includes(opt.value)}
                                                            onChange={() => toggleStatus(opt.value)}
                                                        />
                                                        {opt.label}
                                                    </label>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-2">
                                            <div className="flex items-center justify-between">
                                                <p className="text-xs font-semibold text-muted-foreground">Requester</p>
                                                <Button
                                                    className="text-xs text-primary hover:underline"
                                                    variant={'ghost'}
                                                    size={'xs'}
                                                    onClick={() =>
                                                        requesterFilter.length === requesters.length
                                                            ? setRequesterFilter([])
                                                            : setRequesterFilter(requesters.map((r) => String(r.id)))
                                                    }
                                                >
                                                    {requesterFilter.length === requesters.length ? 'Deselect all' : 'Select all'}
                                                </Button>
                                            </div>
                                            <div className="flex max-h-40 flex-col gap-1 overflow-y-auto">
                                                {requesters.map((r) => (
                                                    <label
                                                        key={r.id}
                                                        className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            className="accent-primary"
                                                            checked={requesterFilter.includes(String(r.id))}
                                                            onChange={() => toggleRequester(String(r.id))}
                                                        />
                                                        {r.name}
                                                    </label>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-2">
                                            <p className="text-xs font-semibold text-muted-foreground">External Equipment</p>
                                            <div className="flex flex-col gap-1">
                                                {[
                                                    { label: 'Has external equipment', value: 'yes' },
                                                    { label: 'No external equipment', value: 'no' },
                                                ].map((opt) => (
                                                    <label
                                                        key={opt.value}
                                                        className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            className="accent-primary"
                                                            checked={externalEquipmentFilter === opt.value}
                                                            onChange={() =>
                                                                setExternalEquipmentFilter((prev) => (prev === opt.value ? '' : opt.value))
                                                            }
                                                        />
                                                        {opt.label}
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex gap-2 border-t p-3">
                                        <Button size="sm" className="flex-1" onClick={applyAdvancedFilters}>
                                            Apply
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="flex-1"
                                            onClick={() => {
                                                setRequesterFilter([]);
                                                setFacilityFilter([]);
                                                setExternalEquipmentFilter('');
                                                router.get(
                                                    route(route().current(), { status: route().params.status }),
                                                    { filter: filterMap[currentActiveFitler], search: searchQuery },
                                                    { preserveState: true, preserveScroll: true },
                                                );
                                            }}
                                        >
                                            Clear
                                        </Button>
                                    </div>
                                </PopoverContent>
                            </Popover>

                            {isAdmin && (
                                <Button
                                    variant={'outline'}
                                    onClick={toggleSelection}
                                    className={cn(isSelecting ? 'border-primary bg-primary/5 text-primary' : '')}
                                >
                                    <MousePointer2 size={16} />
                                    <span>{!isSelecting ? 'Bulk' : 'Stop'}</span>
                                </Button>
                            )}
                        </div>

                        <Sheet>
                            <SheetTrigger asChild>
                                <Button variant="outline" className="sm:hidden">
                                    <ListFilter />
                                    <span>Filters</span>
                                </Button>
                            </SheetTrigger>
                            <SheetContent side="right" className="flex flex-col overflow-y-auto sm:hidden" showCloseButton={false}>
                                <SheetHeader>
                                    <SheetTitle>Filters & Actions</SheetTitle>
                                </SheetHeader>

                                <div className="flex flex-col gap-6 px-4">
                                    {isAdmin && (
                                        <div className="flex flex-col gap-2">
                                            <p className="pt-4 text-xs font-semibold text-muted-foreground">Actions</p>

                                            <SheetClose asChild>
                                                <Button
                                                    variant={'outline'}
                                                    onClick={toggleSelection}
                                                    className={cn('w-full', isSelecting ? 'border-primary bg-primary/5 text-primary' : '')}
                                                >
                                                    <MousePointer2 size={16} />
                                                    <span>{!isSelecting ? 'Bulk Select' : 'Stop Selecting'}</span>
                                                </Button>
                                            </SheetClose>
                                        </div>
                                    )}

                                    <div className="flex flex-col gap-2">
                                        <p className="pt-4 text-xs font-semibold text-muted-foreground">Sort By</p>
                                        <div className="flex flex-col gap-1">
                                            {[
                                                { label: 'None', value: '' },
                                                { label: 'Date Submitted', value: 'created_at' },
                                                { label: 'Priority Level', value: 'priority_level' },
                                                { label: 'Title', value: 'title' },
                                                { label: 'Requester', value: 'user_name' },
                                            ].map((option) => (
                                                <Button
                                                    key={option.value || 'none'}
                                                    onClick={() => handleSort(option.value)}
                                                    variant={
                                                        sortField === option.value || (option.value === '' && !sortField) ? 'secondary' : 'ghost'
                                                    }
                                                    className="w-full justify-between"
                                                    size="sm"
                                                >
                                                    <span>{option.label}</span>
                                                    {option.value !== '' &&
                                                        (sortField === option.value ? (
                                                            sortOrder === 'asc' ? (
                                                                <ArrowUp size={14} className="rotate-180" />
                                                            ) : (
                                                                <ArrowUp size={14} />
                                                            )
                                                        ) : (
                                                            <ArrowUp size={14} className="opacity-0" />
                                                        ))}
                                                </Button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-2">
                                        <div className="flex items-center justify-between">
                                            <p className="text-xs font-semibold text-muted-foreground">Status</p>
                                            <Button
                                                className="text-xs text-primary"
                                                variant={'ghost'}
                                                size={'xs'}
                                                onClick={() =>
                                                    statusFilter.length === statusOptions.length
                                                        ? setStatusFilter([])
                                                        : setStatusFilter(statusOptions.map((o) => o.value))
                                                }
                                            >
                                                {statusFilter.length === statusOptions.length ? 'Deselect all' : 'Select all'}
                                            </Button>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            {statusOptions.map((opt) => (
                                                <label
                                                    key={opt.value}
                                                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        className="accent-primary"
                                                        checked={statusFilter.includes(opt.value)}
                                                        onChange={() => toggleStatus(opt.value)}
                                                    />
                                                    {opt.label}
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-2">
                                        <div className="flex items-center justify-between">
                                            <p className="text-xs font-semibold text-muted-foreground">Facility</p>
                                            <Button
                                                className="text-xs text-primary"
                                                variant="ghost"
                                                size="xs"
                                                onClick={() =>
                                                    facilityFilter.length === facilities.length
                                                        ? setFacilityFilter([])
                                                        : setFacilityFilter(facilities.map((f) => String(f.id)))
                                                }
                                            >
                                                {facilityFilter.length === facilities.length ? 'Deselect all' : 'Select all'}
                                            </Button>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            {facilities.map((f) => (
                                                <label
                                                    key={f.id}
                                                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        className="accent-primary"
                                                        checked={facilityFilter.includes(String(f.id))}
                                                        onChange={() => toggleFacility(String(f.id))}
                                                    />
                                                    {f.name}
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-2">
                                        <div className="flex items-center justify-between">
                                            <p className="pt-4 text-xs font-semibold text-muted-foreground">Requester</p>
                                            <Button
                                                className="text-xs text-primary"
                                                variant="ghost"
                                                size="xs"
                                                onClick={() =>
                                                    requesterFilter.length === requesters.length
                                                        ? setRequesterFilter([])
                                                        : setRequesterFilter(requesters.map((r) => String(r.id)))
                                                }
                                            >
                                                {requesterFilter.length === requesters.length ? 'Deselect all' : 'Select all'}
                                            </Button>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            {requesters.map((r) => (
                                                <label
                                                    key={r.id}
                                                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        className="accent-primary"
                                                        checked={requesterFilter.includes(String(r.id))}
                                                        onChange={() => toggleRequester(String(r.id))}
                                                    />
                                                    {r.name}
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-2">
                                        <p className="pt-4 text-xs font-semibold text-muted-foreground">External Equipment</p>
                                        <div className="flex flex-col gap-1">
                                            {[
                                                { label: 'Has external equipment', value: 'yes' },
                                                { label: 'No external equipment', value: 'no' },
                                            ].map((opt) => (
                                                <label
                                                    key={opt.value}
                                                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        className="accent-primary"
                                                        checked={externalEquipmentFilter === opt.value}
                                                        onChange={() => setExternalEquipmentFilter((prev) => (prev === opt.value ? '' : opt.value))}
                                                    />
                                                    {opt.label}
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="sticky bottom-0 flex gap-2 bg-background py-4">
                                        <SheetClose asChild>
                                            <Button size="sm" className="flex-1" onClick={applyAdvancedFilters}>
                                                Apply
                                            </Button>
                                        </SheetClose>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="flex-1"
                                            onClick={() => {
                                                setRequesterFilter([]);
                                                setFacilityFilter([]);
                                                setExternalEquipmentFilter('');
                                                setStatusFilter([]);
                                                router.get(
                                                    route(route().current(), { status: route().params.status }),
                                                    { filter: filterMap[currentActiveFitler], search: searchQuery },
                                                    { preserveState: true, preserveScroll: true },
                                                );
                                            }}
                                        >
                                            Clear
                                        </Button>
                                    </div>
                                </div>
                            </SheetContent>
                        </Sheet>
                    </div>

                    <div className="flex max-w-full gap-2 overflow-x-scroll [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        {commonFilterOptions.map((filter) => (
                            <Button
                                className="rounded-full"
                                size="sm"
                                variant={currentActiveFitler === filter.title ? 'default' : 'outline'}
                                onClick={() => handleFilterButtonClick(filter.title)}
                                key={filter.title}
                            >
                                {filter.title}
                            </Button>
                        ))}
                    </div>

                    {isAdmin && isSelecting && (requests?.data?.length ?? 0) > selected.length && (
                        <div className="mt-2 flex items-center gap-2">
                            <Button size={'sm'} variant={'outline'} onClick={selectAllSelection}>
                                <MousePointer2 size={16} />
                                <span>Select All</span>
                            </Button>
                        </div>
                    )}
                </div>

                <AnimatePresence>
                    {selected.length > 0 && isBulkCommentOpen && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mt-4 mb-2 w-full overflow-hidden px-4 md:px-8"
                        >
                            <Field>
                                <FieldDescription>Comment to attach to all selected requests</FieldDescription>
                                <Textarea rows={3} className="w-full" value={bulkComment} onChange={(e) => setBulkComment(e.target.value)} />
                            </Field>
                            <div className="mt-2 flex gap-2">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={bulkComment.trim().length === 0}
                                    onClick={() => {
                                        router.post(
                                            route('bulk.action'),
                                            {
                                                ids: selected,
                                                action: 'comment',
                                                comment: bulkComment.trim(),
                                            },
                                            {
                                                onSuccess: () => {
                                                    setBulkComment('');
                                                    setIsBulkCommentOpen(false);
                                                },
                                            },
                                        );
                                    }}
                                >
                                    <MessageCirclePlus size={16} />
                                    <span>Submit Comment</span>
                                </Button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {isInitialLoad ? (
                    <RequestsSkeleton />
                ) : (
                    <>
                        {displayRequests && displayRequests.data.length > 9 && (
                            <SmartPagination
                                currentPage={displayRequests.current_page}
                                lastPage={displayRequests.last_page}
                                onPageChange={(page) =>
                                    router.get(
                                        route(route().current(), { status: route().params.status }),
                                        { page, filter: filterMap[currentActiveFitler], search: searchQuery },
                                        { preserveState: true, preserveScroll: true },
                                    )
                                }
                                className={'my-4 px-4 py-0 md:px-8'}
                            />
                        )}

                        <div
                            className="mt-8 flex w-full flex-col items-stretch gap-4 p-2 sm:grid sm:px-4 md:px-8"
                            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(max(24rem, calc(50% - 0.5rem)), 1fr))' }}
                        >
                            <AnimatePresence mode="popLayout">
                                {displayRequests && displayRequests.data.length > 0 ? (
                                    displayRequests.data.map((request) => (
                                        <RequestCard
                                            request={request}
                                            page_title={page_title}
                                            key={request.id}
                                            isSelecting={isSelecting}
                                            isSelected={selected.includes(request.id)}
                                            handleSelection={handleSelection}
                                            className="w-full"
                                        />
                                    ))
                                ) : (
                                    <motion.div
                                        key="empty"
                                        initial={{ opacity: 0, scale: 0 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ duration: 0.4, scale: { type: 'tween', visualDuration: 0.4, bounce: 0.5 } }}
                                        className="col-span-full m-auto mt-8 flex flex-col items-center gap-2 text-center"
                                    >
                                        <FolderOpen size={32} />
                                        <h1 className="text-2xl font-bold">No Requests</h1>
                                        <p>Nothing to see here...</p>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {displayRequests && displayRequests.data.length > 9 && (
                            <SmartPagination
                                currentPage={displayRequests.current_page}
                                lastPage={displayRequests.last_page}
                                onPageChange={(page) =>
                                    router.get(
                                        route(route().current(), { status: route().params.status }),
                                        { page, filter: filterMap[currentActiveFitler], search: searchQuery },
                                        { preserveState: true, preserveScroll: true },
                                    )
                                }
                                className={'my-5 px-4 md:px-8'}
                            />
                        )}
                    </>
                )}
            </div>

            <AnimatePresence>
                {isAdmin && isSelecting && (
                    <motion.div
                        initial={{ y: 80, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 80, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 200, damping: 30 }}
                        className="fixed right-0 bottom-0 left-0 z-50 flex flex-wrap items-center gap-2 border-t bg-secondary px-4 py-3 backdrop-blur-sm md:justify-center"
                    >
                        <Button size="sm" variant="outline" onClick={clearAllSelection} className="flex items-center gap-1.5 hover:text-primary">
                            <span className="text-sm font-medium">{selected.length} selected</span>
                            <X size={12} />
                        </Button>

                        <div className="h-5 w-px shrink-0 bg-border" />

                        <Button
                            size="sm"
                            variant="outline"
                            className="hover:text-green-500 dark:hover:text-green-500"
                            onClick={() => bulkAction('approve')}
                        >
                            <Check size={14} />
                            <span>Approve</span>
                        </Button>

                        <Button
                            size="sm"
                            variant="outline"
                            className="hover:text-destructive dark:hover:text-destructive"
                            onClick={() => bulkAction('reject')}
                        >
                            <X size={14} />
                            <span>Deny</span>
                        </Button>

                        <Button size="sm" variant="outline" onClick={() => bulkAction('conditionally_approve')}>
                            <CheckLine size={14} />
                            <span>Conditionally Approve</span>
                        </Button>

                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                                const selectedRequests = (requests?.data ?? []).filter((r) => selected.includes(r.id));
                                downloadRequestsCSV(selectedRequests, `Requests Report-${moment().format('YYYY-MM-DD')}.csv`);
                                toast.success(`Exported ${selectedRequests.length} request(s) to CSV`);
                            }}
                        >
                            <Download size={14} />
                            <span>CSV</span>
                        </Button>

                        <Button size="sm" variant="outline" onClick={() => setIsBulkCommentOpen((p) => !p)}>
                            {isBulkCommentOpen ? <MessageCircleOff size={14} /> : <MessageCirclePlus size={14} />}
                            <span>{isBulkCommentOpen ? 'Cancel Comment' : 'Add Comment'}</span>
                        </Button>
                    </motion.div>
                )}
            </AnimatePresence>
        </DefaultLayout>
    );
}
