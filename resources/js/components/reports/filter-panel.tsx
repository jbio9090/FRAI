"use client";

import { Calendar, Filter, X, ChevronDown, ChevronUp, Building2, MapPin, Users, ClipboardList, Settings } from "lucide-react";
import { useState, useMemo, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { ReportFilters, Granularity } from "@/types/reports";

interface FilterPanelProps {
  filters: ReportFilters;
  defaultFilters: ReportFilters;
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

const GRANULARITY_OPTIONS: { value: Granularity; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

const DATE_TYPE_OPTIONS = [
  { value: "event_date", label: "Event Date" },
  { value: "approval_date", label: "Approval Date" },
  { value: "submission_date", label: "Submission Date" },
] as const;

type DateType = typeof DATE_TYPE_OPTIONS[number]["value"];

export function FilterPanel({
  filters,
  defaultFilters,
  meta,
  onFiltersChange,
  onReset,
}: FilterPanelProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
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

  const handleDateChange = useCallback(
    (field: "start" | "end", value: string) => {
      onFiltersChange({ [field]: value });
    },
    [onFiltersChange]
  );

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
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="start-date" className="text-xs font-medium text-muted-foreground">
                        Start Date
                      </Label>
                      <Input
                        id="start-date"
                        type="date"
                        value={filters.start}
                        onChange={(e) => handleDateChange("start", e.target.value)}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="end-date" className="text-xs font-medium text-muted-foreground">
                        End Date
                      </Label>
                      <Input
                        id="end-date"
                        type="date"
                        value={filters.end}
                        onChange={(e) => handleDateChange("end", e.target.value)}
                        className="h-9"
                      />
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
                      {GRANULARITY_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
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