"use client";

import { Calendar, Filter, X, ChevronDown, ChevronUp, MapPin, ClipboardList, Settings } from "lucide-react";
import { useState, useMemo, useCallback, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ReportFilters, Granularity } from "@/types/reports";

interface FilterPanelProps {
  filters: ReportFilters;
  meta: {
    campuses: { id: number; name: string }[];
    buildings: { id: number; name: string; campus_id: number }[];
    facilities: { id: number; name: string; building_id: number }[];
    statuses: { value: string; label: string }[];
    priorities: { value: number; label: string }[];
    users: { id: number; name: string }[];
  };
  onFiltersChange: (filters: Partial<ReportFilters>) => void;
  onReset: () => void;
}

const GRANULARITY_OPTIONS: {
  value: Granularity;
  label: string;
  disabled?: boolean;
  tooltip?: string;
}[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

const MONTH_OPTIONS = [
  { value: "01", label: "January" },
  { value: "02", label: "February" },
  { value: "03", label: "March" },
  { value: "04", label: "April" },
  { value: "05", label: "May" },
  { value: "06", label: "June" },
  { value: "07", label: "July" },
  { value: "08", label: "August" },
  { value: "09", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

const currentYear = new Date().getFullYear();
const YEAR_OPTIONS = Array.from(
  { length: currentYear - 2025 + 1 },
  (_, i) => ({ value: String(2025 + i), label: String(2025 + i) })
);

const DATE_TYPE_OPTIONS = [
  { value: "event_date", label: "Event Date" },
  { value: "approval_date", label: "Approval Date" },
  { value: "submission_date", label: "Submission Date" },
] as const;

type DateType = typeof DATE_TYPE_OPTIONS[number]["value"];

export function FilterPanel({
  filters,
  meta,
  onFiltersChange,
  onReset,
}: FilterPanelProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    location: true,
    request: true,
    date: true,
  });

  const hasActiveFilters = useMemo(() => {
    return (
      filters.facilityIds?.length ||
      filters.buildingIds?.length ||
      filters.campusIds?.length ||
      filters.statuses?.length ||
      filters.priorityLevel !== undefined ||
      filters.userId !== undefined ||
      filters.dateType !== "event_date"
    );
  }, [filters]);

  const availableBuildings = useMemo(() => {
    if (filters.campusIds?.length) {
      return meta.buildings.filter((b) => filters.campusIds!.includes(b.campus_id));
    }
    return meta.buildings;
  }, [filters.campusIds, meta.buildings]);

  const availableFacilities = useMemo(() => {
    if (filters.buildingIds?.length) {
      return meta.facilities.filter((f) => filters.buildingIds!.includes(f.building_id));
    }
    return meta.facilities;
  }, [filters.buildingIds, meta.facilities]);

  const toggleSection = useCallback((section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  }, []);

  const handleMultiSelectChange = useCallback(
    (key: keyof ReportFilters, id: number | string, checked: boolean) => {
      const current = (filters[key] as (number | string)[]) ?? [];
      const updated = checked
        ? [...current, id]
        : current.filter((v) => v !== id);
      onFiltersChange({ [key]: updated } as Partial<ReportFilters>);
    },
    [filters, onFiltersChange]
  );

  const handleSingleSelectChange = useCallback(
    (key: keyof ReportFilters, value: string | number | undefined) => {
      onFiltersChange({ [key]: value } as Partial<ReportFilters>);
    },
    [onFiltersChange]
  );

  const parseMonthParts = useCallback(
    (value: string | undefined) => {
      const parts = (value ?? "").split("-");
      return {
        year: parts[0] ?? String(new Date().getFullYear()),
        month: parts[1] ?? "01",
      };
    },
    []
  );

  const monthSpan = useMemo(() => {
    const start = parseMonthParts(filters.start);
    const end = parseMonthParts(filters.end);
    const s = new Date(Number(start.year), Number(start.month) - 1, 1);
    const e = new Date(Number(end.year), Number(end.month) - 1, 1);
    return (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
  }, [filters.start, filters.end, parseMonthParts]);

  const handleMonthPartChange = useCallback(
    (field: "start" | "end", part: "year" | "month", value: string) => {
      const current = field === "start" ? filters.start : filters.end;
      const parts = (current ?? "").split("-");
      const updated =
        part === "year"
          ? [value, parts[1] ?? "01"]
          : [parts[0] ?? String(new Date().getFullYear()), value];
      onFiltersChange({ [field]: updated.join("-") });
    },
    [filters.start, filters.end, onFiltersChange]
  );

  useEffect(() => {
    const invalid =
      (filters.granularity === "daily" && monthSpan > 12) ||
      (filters.granularity === "weekly" && monthSpan > 24);
    if (invalid) {
      onFiltersChange({ granularity: "monthly" });
    }
  }, [filters.granularity, monthSpan, onFiltersChange]);

  const renderSection = (
    title: string,
    icon: React.ReactNode,
    children: React.ReactNode,
    sectionKey: string,
    className?: string
  ) => (
    <div className={cn("space-y-3", className)}>
      <button
        type="button"
        onClick={() => toggleSection(sectionKey)}
        className="flex w-full items-center justify-between px-2 py-2 text-left font-medium text-sm text-foreground hover:text-primary transition-colors"
        aria-expanded={expandedSections[sectionKey]}
      >
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{expandedSections[sectionKey] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</span>
          <span className="flex items-center gap-2">
            {icon}
            {title}
          </span>
        </div>
        <Badge variant="secondary" className="text-xs">
          {expandedSections[sectionKey] ? "Hide" : "Show"}
        </Badge>
      </button>

      {expandedSections[sectionKey] && (
        <div className="space-y-4 pt-2 border-l-2 border-border pl-4 ml-2">
          {children}
        </div>
      )}
    </div>
  );

  const renderMultiSelect = (
    label: string,
    options: { id: number | string; name: string }[],
    selectedIds: (number | string)[],
    onChange: (id: number | string, checked: boolean) => void,
    maxHeight = "max-h-48"
  ) => (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-foreground">{label}</Label>
      <ScrollArea className={cn(maxHeight, "rounded-md border border-border p-2")}>
        <div className="flex flex-col gap-1.5">
          {options.map((option) => (
            <Label
              key={option.id}
              className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent transition-colors"
            >
              <Checkbox
                checked={selectedIds.includes(option.id)}
                onCheckedChange={(checked) => onChange(option.id, checked as boolean)}
              />
              {option.name}
            </Label>
          ))}
        </div>
      </ScrollArea>
    </div>
  );

  return (
    <div className="space-y-4">
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filters
            </CardTitle>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={onReset} className="gap-1.5">
                <X className="h-3.5 w-3.5" />
                Clear all
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="lg:col-span-4">
              {renderSection(
                "Date Range",
                <Calendar className="h-4 w-4 text-muted-foreground" />,
                (
                  <div className="grid gap-4 sm:grid-cols-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="start-year" className="text-xs font-medium text-muted-foreground">
                        Start Year
                      </Label>
                      <Select
                        value={parseMonthParts(filters.start).year}
                        onValueChange={(v) => handleMonthPartChange("start", "year", v)}
                      >
                        <SelectTrigger id="start-year-trigger" className="h-9 w-full">
                          <SelectValue placeholder="Year" />
                        </SelectTrigger>
                        <SelectContent>
                          {YEAR_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="start-month" className="text-xs font-medium text-muted-foreground">
                        Start Month
                      </Label>
                      <Select
                        value={parseMonthParts(filters.start).month}
                        onValueChange={(v) => handleMonthPartChange("start", "month", v)}
                      >
                        <SelectTrigger id="start-month-trigger" className="h-9 w-full">
                          <SelectValue placeholder="Month" />
                        </SelectTrigger>
                        <SelectContent>
                          {MONTH_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="end-year" className="text-xs font-medium text-muted-foreground">
                        End Year
                      </Label>
                      <Select
                        value={parseMonthParts(filters.end).year}
                        onValueChange={(v) => handleMonthPartChange("end", "year", v)}
                      >
                        <SelectTrigger id="end-year-trigger" className="h-9 w-full">
                          <SelectValue placeholder="Year" />
                        </SelectTrigger>
                        <SelectContent>
                          {YEAR_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="end-month" className="text-xs font-medium text-muted-foreground">
                        End Month
                      </Label>
                      <Select
                        value={parseMonthParts(filters.end).month}
                        onValueChange={(v) => handleMonthPartChange("end", "month", v)}
                      >
                        <SelectTrigger id="end-month-trigger" className="h-9 w-full">
                          <SelectValue placeholder="Month" />
                        </SelectTrigger>
                        <SelectContent>
                          {MONTH_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="date-type" className="text-xs font-medium text-muted-foreground">
                        Date Type
                      </Label>
                      <Select
                        value={filters.dateType ?? "event_date"}
                        onValueChange={(v) => handleSingleSelectChange("dateType", v as DateType)}
                      >
                        <SelectTrigger id="date-type" className="h-9 w-full">
                          <SelectValue placeholder="Event Date" />
                        </SelectTrigger>
                        <SelectContent>
                          {DATE_TYPE_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ),
                "date"
              )}
            </div>

            <div className="lg:col-span-1">
              {renderSection(
                "Granularity",
                <Settings className="h-4 w-4 text-muted-foreground" />,
                (
                  <Select
                    value={filters.granularity}
                    onValueChange={(v) => handleSingleSelectChange("granularity", v as Granularity)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {GRANULARITY_OPTIONS.map((opt) => {
                        const disabled =
                          (opt.value === "daily" && monthSpan > 12) ||
                          (opt.value === "weekly" && monthSpan > 24);
                        const tooltip =
                          opt.value === "daily" && monthSpan > 12
                            ? "Daily granularity unavailable for ranges over 12 months"
                            : opt.value === "weekly" && monthSpan > 24
                              ? "Weekly granularity unavailable for ranges over 24 months"
                              : undefined;
                        if (disabled && tooltip) {
                          return (
                            <Tooltip key={opt.value}>
                              <TooltipTrigger asChild>
                                <SelectItem key={opt.value} value={opt.value} disabled>
                                  {opt.label}
                                </SelectItem>
                              </TooltipTrigger>
                              <TooltipContent>{tooltip}</TooltipContent>
                            </Tooltip>
                          );
                        }
                        return (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                ),
                "granularity"
              )}
            </div>

            <div className="lg:col-span-3">
              {renderSection(
                "Location",
                <MapPin className="h-4 w-4 text-muted-foreground" />,
                (
                  <div className="grid gap-4 sm:grid-cols-3">
                    {renderMultiSelect(
                      "Campus",
                      meta.campuses,
                      filters.campusIds ?? [],
                      (id, checked) => handleMultiSelectChange("campusIds", id, checked)
                    )}
                    {renderMultiSelect(
                      "Building",
                      availableBuildings,
                      filters.buildingIds ?? [],
                      (id, checked) => handleMultiSelectChange("buildingIds", id, checked)
                    )}
                    {renderMultiSelect(
                      "Facility",
                      availableFacilities,
                      filters.facilityIds ?? [],
                      (id, checked) => handleMultiSelectChange("facilityIds", id, checked)
                    )}
                  </div>
                ),
                "location"
              )}
            </div>

            <div className="lg:col-span-4">
              {renderSection(
                "Request",
                <ClipboardList className="h-4 w-4 text-muted-foreground" />,
                (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {renderMultiSelect(
                      "Status",
                      meta.statuses.map((s) => ({ id: s.value, name: s.label })),
                      filters.statuses ?? [],
                      (id, checked) => handleMultiSelectChange("statuses", id, checked),
                      "max-h-40"
                    )}
                    <div className="space-y-1.5">
                      <Label htmlFor="event-type" className="text-xs font-medium text-muted-foreground">
                        Event Type
                      </Label>
                      <Select
                        value={filters.priorityLevel?.toString() ?? ""}
                        onValueChange={(v) => handleSingleSelectChange("priorityLevel", v ? parseInt(v) : undefined)}
                      >
                        <SelectTrigger id="event-type" className="h-9 w-full">
                          <SelectValue placeholder="All event types" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">All event types</SelectItem>
                          {meta.priorities.map((p) => (
                            <SelectItem key={p.value} value={String(p.value)}>
                              {p.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="requester" className="text-xs font-medium text-muted-foreground">
                        Requester
                      </Label>
                      <Select
                        value={filters.userId?.toString() ?? ""}
                        onValueChange={(v) => handleSingleSelectChange("userId", v ? parseInt(v) : undefined)}
                      >
                        <SelectTrigger id="requester" className="h-9 w-full">
                          <SelectValue placeholder="All requesters" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">All requesters</SelectItem>
                          {meta.users.map((u) => (
                            <SelectItem key={u.id} value={String(u.id)}>
                              {u.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ),
                "request"
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}