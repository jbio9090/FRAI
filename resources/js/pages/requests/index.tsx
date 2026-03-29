import { router, Link } from '@inertiajs/react';
import { CheckLine, MessageCirclePlus, SlidersHorizontal, MessageCircleOff, MousePointer2, X, Check, Search, ArrowDownUp, GraduationCap, Landmark, ArrowUp, Download, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import DefaultLayout from '@/layout.tsx/default.';
import moment from 'moment';
import { Request } from '@/types/request';
import { cn, formatTime, recommendedActionToPresentTense } from '@/lib/utils';
import { Popover, PopoverContent, PopoverHeader, PopoverTitle, PopoverTrigger } from "@/components/ui/popover"
import { useState, useEffect, useRef } from 'react';
import { Field, FieldDescription } from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { toast } from 'sonner';
import { downloadRequestsCSV } from '@/lib/downloadCSV';
import { motion } from 'motion/react';
import { ButtonGroup } from '@/components/ui/button-group';
import SmartPagination from '@/components/SmartPagination';
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger, } from "@/components/ui/sheet"
import { Facility } from '@/types/facility';
import RequestCard from '@/components/request-card';


export interface PaginatedRequests {
    data: Request[];
    links: { url: string | null; label: string; active: boolean }[];
    current_page: number;
    last_page: number;
    total: number;
}

export interface RequestsPageProps {
    requests: PaginatedRequests;
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
    const [bulkComment, setBulkComment] = useState("");
    const [isBulkCommentOpen, setIsBulkCommentOpen] = useState(false);
    const [currentActiveFitler, setActiveFilter] = useState("This Week");
    const [searchQuery, setSearchQuery] = useState("");
    const [sortField, setSortField] = useState<string | null>(null);
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const isMounted = useRef(false);
    const [facilityFilter, setFacilityFilter] = useState<string[]>([]);
    const [requesterFilter, setRequesterFilter] = useState<string[]>([]);
    const [externalEquipmentFilter, setExternalEquipmentFilter] = useState<string>("");

    useEffect(() => {
        if (!isMounted.current) {
            isMounted.current = true;
            return;
        }

        const timeout = setTimeout(() => {
            router.get(route(route().current(), { status: route().params.status }), {
                filter: filterMap[currentActiveFitler],
                search: searchQuery,
            }, {
                preserveState: true,
                preserveScroll: true,
            });
        }, 400);

        return () => clearTimeout(timeout);
    }, [searchQuery]);

    const commonFilterOptions = [
        {
            title: "Today",
        },
        {
            title: "This Week",
        },
        {
            title: "This Month",
        },
        {
            title: "All",
        },
    ]

    const sortOptions = [
        { label: "Date Submitted", value: "created_at" },
        { label: "Priority Level", value: "priority_level" },
        { label: "Title", value: "title" },
        { label: "Requester", value: "user_name" },
        { label: "None", value: "" }
    ];

    const filterMap: Record<string, string> = {
        "Today": "today",
        "This Week": "this_week",
        "This Month": "this_month",
        "All": "all",
    };

    const getParams = (overrides = {}) => ({
        filter: filterMap[currentActiveFitler],
        search: searchQuery,
        ...(requesterFilter.length && { requester: requesterFilter.join(',') }),
        ...(facilityFilter.length && { facility: facilityFilter.join(',') }),
        ...(externalEquipmentFilter && { has_external_equipment: externalEquipmentFilter }),
        ...overrides,
    });

    const toggleFacility = (id: string) => {
        setFacilityFilter(prev =>
            prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
        );
    };

    const toggleRequester = (id: string) => {
        setRequesterFilter(prev =>
            prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
        );
    };

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchQuery(e.target.value);
    };

    const handleFilterButtonClick = (title: string) => {
        setActiveFilter(title);
        router.get(
            route(route().current(), { status: route().params.status }),
            getParams({ filter: filterMap[title] }),
            { preserveState: true, preserveScroll: true }
        );
    };

    const applyAdvancedFilters = () => {
        router.get(
            route(route().current(), { status: route().params.status }),
            getParams(),
            { preserveState: true, preserveScroll: true }
        );
    };

    const handleSelection = (request_id: number) => {
        setSelected((prev) =>
            prev.includes(request_id)
                ? prev.filter((id) => id !== request_id)
                : [...prev, request_id]
        );
    };

    const handleSort = (field: string) => {
        if (field === "") {
            setSortField(null);
            setSortOrder('asc');
            router.get(
                route(route().current(), { status: route().params.status }),
                getParams({ sort: undefined, order: undefined }),
                { preserveState: true, preserveScroll: true }
            );
            return;
        }

        const newOrder = sortField === field && sortOrder === 'asc' ? 'desc' : 'asc';
        setSortField(field);
        setSortOrder(newOrder);
        router.get(
            route(route().current(), { status: route().params.status }),
            getParams({ sort: field, order: newOrder }),  // <-- was missing getParams
            { preserveState: true, preserveScroll: true }
        );
    };

    const clearAllSelection = () => {
        setSelected([]);
    }

    const selectAllSelection = () => {
        setSelected(requests.data.map((req) => req.id));
    }

    const toggleSelection = () => {
        setSelectState(!isSelecting);
        if (isSelecting) setSelected([]);
    }

    const bulkAction = (action: string) => {
        router.post(route('bulk.action'), {
            ids: selected,
            action,
            comment: bulkComment.length > 0 ? bulkComment : null,
        }, {
            onSuccess: () => {
                setSelected([]);
                setSelectState(false);
                setBulkComment("");
                setIsBulkCommentOpen(false);
            },
        });
    };

    return (
        <DefaultLayout>
            <div className="max-w-6xl mx-auto w-full">
                <h1 className="text-xl font-bold mb-6">{page_title} Requests</h1>
                <div className="flex flex-col justify-center w-full mt-4 flex-wrap gap-4">
                    <div className="flex gap-2">
                        <InputGroup className='max-w-xs sm:max-w-sm md:max-w-md'>
                            <InputGroupAddon>
                                <Search />
                            </InputGroupAddon>
                            <InputGroupInput
                                placeholder='Search'
                                value={searchQuery}
                                onChange={handleSearch}
                            />
                        </InputGroup>

                        <div className="hidden sm:flex gap-2">
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline">
                                        <ArrowDownUp />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="p-0 w-48">
                                    <PopoverHeader>
                                        <PopoverTitle className='px-3 py-1 pt-4 text-xs text-muted-foreground font-semibold'>
                                            Sort By
                                        </PopoverTitle>
                                    </PopoverHeader>
                                    <div className="flex flex-col p-1">
                                        {sortOptions.map((option) => (
                                            <Button
                                                key={option.value || "none"}
                                                onClick={() => {
                                                    handleSort(option.value);
                                                }}
                                                variant={sortField === option.value || (option.value === "" && !sortField) ? "secondary" : "ghost"}
                                                className='justify-between w-full px-2'
                                                size="sm"
                                            >
                                                <span>{option.label}</span>
                                                {option.value !== "" && (sortField === option.value
                                                    ? sortOrder === 'asc'
                                                        ? <ArrowUp size={14} className="rotate-180 text-foreground" />
                                                        : <ArrowUp size={14} className="text-foreground" />
                                                    : <ArrowUp size={14} className="opacity-0" />
                                                )}
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
                                            (requesterFilter.length || facilityFilter.length || externalEquipmentFilter) &&
                                            "border-primary text-primary bg-primary/5"
                                        )}
                                    >
                                        <SlidersHorizontal size={16} />
                                        {(requesterFilter.length + facilityFilter.length + (externalEquipmentFilter ? 1 : 0)) > 0 && (
                                            <span className="text-xs font-semibold">
                                                {requesterFilter.length + facilityFilter.length + (externalEquipmentFilter ? 1 : 0)}
                                            </span>
                                        )}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="p-0 w-72" align="start">
                                    <PopoverHeader>
                                        <PopoverTitle className="px-3 pt-3 text-muted-foreground font-semibold">
                                            Filters
                                        </PopoverTitle>
                                    </PopoverHeader>
                                    <div className="flex flex-col gap-4 p-3 max-h-96 overflow-y-auto">

                                        <div className="flex flex-col gap-2">
                                            <div className="flex items-center justify-between">
                                                <p className="text-xs text-muted-foreground font-semibold">Facility</p>
                                                <Button
                                                    className="text-xs text-primary"
                                                    variant={"ghost"}
                                                    size={"xs"}
                                                    onClick={() =>
                                                        facilityFilter.length === facilities.length
                                                            ? setFacilityFilter([])
                                                            : setFacilityFilter(facilities.map(f => String(f.id)))
                                                    }
                                                >
                                                    {facilityFilter.length === facilities.length ? "Deselect all" : "Select all"}
                                                </Button>
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                {facilities.map((f) => (
                                                    <label
                                                        key={f.id}
                                                        className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted cursor-pointer text-sm"
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
                                                <p className="text-xs text-muted-foreground font-semibold">Requester</p>
                                                <Button
                                                    className="text-xs text-primary hover:underline"
                                                    variant={"ghost"}
                                                    size={"xs"}
                                                    onClick={() =>
                                                        requesterFilter.length === requesters.length
                                                            ? setRequesterFilter([])
                                                            : setRequesterFilter(requesters.map(r => String(r.id)))
                                                    }
                                                >
                                                    {requesterFilter.length === requesters.length ? "Deselect all" : "Select all"}
                                                </Button>
                                            </div>
                                            <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
                                                {requesters.map((r) => (
                                                    <label
                                                        key={r.id}
                                                        className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted cursor-pointer text-sm"
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
                                            <p className="text-xs text-muted-foreground font-semibold">External Equipment</p>
                                            <div className="flex flex-col gap-1">
                                                {[
                                                    { label: "Has external equipment", value: "yes" },
                                                    { label: "No external equipment", value: "no" },
                                                ].map((opt) => (
                                                    <label
                                                        key={opt.value}
                                                        className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted cursor-pointer text-sm"
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            className="accent-primary"
                                                            checked={externalEquipmentFilter === opt.value}
                                                            onChange={() =>
                                                                setExternalEquipmentFilter(prev => prev === opt.value ? "" : opt.value)
                                                            }
                                                        />
                                                        {opt.label}
                                                    </label>
                                                ))}
                                            </div>
                                        </div>

                                    </div>

                                    <div className="flex gap-2 p-3 border-t">
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
                                                setExternalEquipmentFilter("");
                                                router.get(
                                                    route(route().current(), { status: route().params.status }),
                                                    { filter: filterMap[currentActiveFitler], search: searchQuery },
                                                    { preserveState: true, preserveScroll: true }
                                                );
                                            }}
                                        >
                                            Clear
                                        </Button>
                                    </div>
                                </PopoverContent>
                            </Popover>

                            <Button
                                variant={"outline"}
                                onClick={toggleSelection}
                                className={cn(isSelecting ? "text-primary border-primary bg-primary/5" : "")}
                            >
                                <MousePointer2 size={16} />
                                <span>{!isSelecting ? "Bulk" : "Stop"}</span>
                            </Button>
                        </div>

                        <Sheet>
                            <SheetTrigger asChild>
                                <Button variant="outline" className="sm:hidden">
                                    <SlidersHorizontal />
                                </Button>
                            </SheetTrigger>
                            <SheetContent side="right" className="sm:hidden overflow-y-auto flex flex-col" showCloseButton={false}>
                                <SheetHeader>
                                    <SheetTitle>Filters & Actions</SheetTitle>
                                </SheetHeader>

                                <div className="flex flex-col gap-6 px-4">
                                    <div className="flex flex-col gap-2">
                                        <p className="text-xs font-semibold text-muted-foreground pt-4">Actions</p>
                                        <SheetClose asChild>
                                            <Button
                                                variant={"outline"}
                                                onClick={toggleSelection}
                                                className={cn("w-full", isSelecting ? "text-primary border-primary bg-primary/5" : "")}
                                            >
                                                <MousePointer2 size={16} />
                                                <span>{!isSelecting ? "Bulk Select" : "Stop Selecting"}</span>
                                            </Button>
                                        </SheetClose>
                                    </div>

                                    <div className="flex flex-col gap-2">
                                        <p className="text-xs font-semibold text-muted-foreground pt-4">Sort By</p>
                                        <div className="flex flex-col gap-1">
                                            {[
                                                { label: "None", value: "" },
                                                { label: "Date Submitted", value: "created_at" },
                                                { label: "Priority Level", value: "priority_level" },
                                                { label: "Title", value: "title" },
                                                { label: "Requester", value: "user_name" },
                                            ].map((option) => (
                                                <Button
                                                    key={option.value || "none"}
                                                    onClick={() => handleSort(option.value)}
                                                    variant={sortField === option.value || (option.value === "" && !sortField) ? "secondary" : "ghost"}
                                                    className='justify-between w-full'
                                                    size="sm"
                                                >
                                                    <span>{option.label}</span>
                                                    {option.value !== "" && (
                                                        sortField === option.value
                                                            ? sortOrder === 'asc'
                                                                ? <ArrowUp size={14} className="rotate-180" />
                                                                : <ArrowUp size={14} />
                                                            : <ArrowUp size={14} className="opacity-0" />
                                                    )}
                                                </Button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Facilities */}
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
                                                        : setFacilityFilter(facilities.map(f => String(f.id)))
                                                }
                                            >
                                                {facilityFilter.length === facilities.length ? "Deselect all" : "Select all"}
                                            </Button>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            {facilities.map((f) => (
                                                <label
                                                    key={f.id}
                                                    className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted cursor-pointer text-sm"
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

                                    {/* Requesters */}
                                    <div className="flex flex-col gap-2">
                                        <div className="flex items-center justify-between">
                                            <p className="text-xs font-semibold text-muted-foreground pt-4">Requester</p>
                                            <Button
                                                className="text-xs text-primary"
                                                variant="ghost"
                                                size="xs"
                                                onClick={() =>
                                                    requesterFilter.length === requesters.length
                                                        ? setRequesterFilter([])
                                                        : setRequesterFilter(requesters.map(r => String(r.id)))
                                                }
                                            >
                                                {requesterFilter.length === requesters.length ? "Deselect all" : "Select all"}
                                            </Button>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            {requesters.map((r) => (
                                                <label
                                                    key={r.id}
                                                    className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted cursor-pointer text-sm"
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

                                    {/* External Equipment */}
                                    <div className="flex flex-col gap-2">
                                        <p className="text-xs font-semibold text-muted-foreground pt-4">External Equipment</p>
                                        <div className="flex flex-col gap-1">
                                            {[
                                                { label: "Has external equipment", value: "yes" },
                                                { label: "No external equipment", value: "no" },
                                            ].map((opt) => (
                                                <label
                                                    key={opt.value}
                                                    className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted cursor-pointer text-sm"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        className="accent-primary"
                                                        checked={externalEquipmentFilter === opt.value}
                                                        onChange={() =>
                                                            setExternalEquipmentFilter(prev => prev === opt.value ? "" : opt.value)
                                                        }
                                                    />
                                                    {opt.label}
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="flex gap-2 py-4 bg-background sticky bottom-0">
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
                                                setExternalEquipmentFilter("");
                                                router.get(
                                                    route(route().current(), { status: route().params.status }),
                                                    { filter: filterMap[currentActiveFitler], search: searchQuery },
                                                    { preserveState: true, preserveScroll: true }
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

                    <div className="flex max-w-full gap-2 overflow-x-scroll [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                        {commonFilterOptions.map((filter) => (
                            <Button
                                className='rounded-full'
                                size="sm"
                                variant={currentActiveFitler === filter.title ? "default" : "outline"}
                                onClick={() => handleFilterButtonClick(filter.title)}
                                key={filter.title}
                            >
                                {filter.title}
                            </Button>
                        ))}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap mt-2">
                        {(!(selected.length >= requests.data.length) && (isSelecting)) && (
                            <Button
                                size={"sm"}
                                variant={"outline"}
                                onClick={selectAllSelection}
                            >
                                <MousePointer2 size={16} />
                                <span>Select All</span>
                            </Button>
                        )}

                        {(selected.length > 0 && (
                            <Button
                                size={"sm"}
                                variant={"outline"}
                                onClick={clearAllSelection}
                                className='items-center'
                            >
                                <span>{selected.length} selected</span>
                                <X size={16} />
                            </Button>
                        ))}
                    </div>


                    <ButtonGroup className="flex items-center flex-wrap my-4">
                        {selected.length > 0 && (
                            <Button size="sm" variant="outline" onClick={() => bulkAction('approve')}>
                                <Check size={16} />
                                <span>Approve</span>
                            </Button>
                        )}

                        {selected.length > 0 && (
                            <Button size="sm" variant="outline" onClick={() => bulkAction('reject')}>
                                <X size={16} />
                                <span>Deny</span>
                            </Button>
                        )}

                        {selected.length > 0 && (
                            <Button size="sm" variant="outline" onClick={() => bulkAction('conditionally_approve')}>
                                <CheckLine size={16} />
                                <span>Conditionally Approve</span>
                            </Button>
                        )}

                        {selected.length > 0 && (
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                    const selectedRequests = requests.data.filter((r) =>
                                        selected.includes(r.id)
                                    );
                                    downloadRequestsCSV(
                                        selectedRequests,
                                        `Requests Report-${moment().format("YYYY-MM-DD")}.csv`
                                    );
                                    toast.success(`Exported ${selectedRequests.length} request(s) to CSV`);
                                }}
                            >
                                <Download size={16} />
                                <span>CSV</span>
                            </Button>
                        )}

                        {selected.length > 0 && (
                            <Button size="sm" variant="outline" onClick={() => setIsBulkCommentOpen(p => !p)}>
                                {isBulkCommentOpen ? <MessageCircleOff className="mr-2 h-4 w-4" /> : <MessageCirclePlus className="mr-2 h-4 w-4" />}
                                <span>{isBulkCommentOpen ? "Cancel Comment" : "Add Comment"}</span>
                            </Button>
                        )}
                    </ButtonGroup>

                </div>

                {selected.length > 0 && isBulkCommentOpen && (
                    <div className="w-full mt-2 mb-6">
                        <Field>
                            <FieldDescription>Comment to attach to all selected requests</FieldDescription>
                            <Textarea
                                rows={3}
                                className="w-full"
                                value={bulkComment}
                                onChange={(e) => setBulkComment(e.target.value)}
                            />
                        </Field>
                    </div>
                )}

                {requests.data.length > 0 && (
                    <SmartPagination
                        currentPage={requests.current_page}
                        lastPage={requests.last_page}
                        onPageChange={(page) => router.get(
                            route(route().current(), { status: route().params.status }),
                            { page, filter: filterMap[currentActiveFitler], search: searchQuery },
                            { preserveState: true, preserveScroll: true }
                        )}
                    />
                )}

                <div className="gap-4 mt-6 flex flex-col xl:grid grid-cols-[1fr_1fr]">
                    {requests.data.length > 0 ? requests.data.map((request) => (
                        <RequestCard
                            request={request}
                            page_title={page_title}
                            key={request.id}
                            isSelecting={isSelecting}
                            isSelected={selected.includes(request.id)}
                            handleSelection={handleSelection}
                        />
                    )) :
                        (
                            <motion.div
                                initial={{ opacity: 0, scale: 0 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{
                                    duration: 0.4,
                                    scale: { type: "tween", visualDuration: 0.4, bounce: 0.5 },
                                }}
                                className='m-auto items-center mt-8 flex flex-col text-center col-span-full gap-2'>
                                <FolderOpen size={32} />
                                <h1 className='font-bold text-2xl'>
                                    No Requests
                                </h1>
                                <p>
                                    Nothing to see here
                                </p>
                            </motion.div>
                        )}
                </div>

                {requests.data.length > 9 && (
                    <SmartPagination
                        currentPage={requests.current_page}
                        lastPage={requests.last_page}
                        onPageChange={(page) => router.get(
                            route(route().current(), { status: route().params.status }),
                            { page, filter: filterMap[currentActiveFitler], search: searchQuery },
                            { preserveState: true, preserveScroll: true }
                        )}
                    />
                )}

            </div>
        </DefaultLayout>
    );
}

