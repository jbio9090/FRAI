import { AlertCircleIcon, LayoutGrid, Filter, ChevronDown, Check, Loader2, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import moment from 'moment';
import { useState } from 'react';
import { FacilityInfo } from '@/components/create-page/facility-info';
import { BookingCardList } from '@/components/request/create/booking-card-list';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import DefaultLayout from '@/layout.tsx/default.';
import { BookingActions } from './sections/booking-actions';
import { DetailsTab } from './sections/details-tab';
import { EquipmentSection } from './sections/equipment-section';
import { ScheduleSection } from './sections/schedule-section';
import type { CreateRequestProps, FacilityBooking } from './types';
import { useCreateRequest } from './use-create-request';
import { timeAgo } from './utils';

export type { FacilityBooking };

export default function CreateRequest({ facilities, existingRequest }: CreateRequestProps) {
    const {
        // page
        isEditing,
        requestOptions,
        draft,
        showDraftBanner,
        restoreDraft,
        discardDraft,
        errors,
        processing,
        submit,
        data,
        setData,

        // form booking state
        selectedFacility,
        selectedDates,
        currentTimeStart,
        currentTimeEnd,
        selectedEquipment,
        scheduleConflicts,
        attachedFiles,
        expectedCapacity,
        hasOutsiders,
        existingFiles,
        equipmentConflicts,
        equipmentAvailability,
        editingIndex,

        // alternatives
        alternatives,
        alternativesLoading,
        alternativesError,
        includeEquipmentFilter,
        setIncludeEquipmentFilter,
        applyAlternative,

        // grouped panels
        externalEquipmentProps,
        borrowPanelProps,

        // setters
        setExpectedCapacity,
        setHasOutsiders,

        // handlers
        handleCheckboxChange,
        handleFileSelect,
        removeFile,
        removeExistingFile,
        editBooking,
        cancelEditBooking,
        handleFacilityChange,
        handleDateChange,
        clearEquipmentSelection,
        selectAllEquipment,
        handleEquipmentToggle,
        updateEquipmentQuantity,
        handleTimeStartChange,
        handleTimeEndChange,
        addFacilityBooking,
        removeBooking,

        // derived
        minSelectableDate,
        availableDaysOfWeek,
        hasNearMinimumScheduleDate,
        bookingTimeOptions,
        availableEndTimeOptions,
        canSaveFacilityBooking,
        availableEquipment,
    } = useCreateRequest({ facilities, existingRequest });

    const [selectedAlternative, setSelectedAlternative] = useState<string | null>(null);

    return (
        <DefaultLayout>
            <AlertDialog
                open={showDraftBanner}
                onOpenChange={(open) => {
                    if (!open) discardDraft();
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Restore unsaved draft?</AlertDialogTitle>
                        <AlertDialogDescription>
                            You have an unsaved draft from <span className="font-medium text-foreground">{draft ? timeAgo(draft.savedAt) : ''}</span>.
                            Would you like to restore it, or start fresh?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={discardDraft}>Discard</AlertDialogCancel>
                        <AlertDialogAction onClick={restoreDraft}>Restore Draft</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <div className="relative w-full">
                <form onSubmit={submit} className="flex flex-col gap-6 space-y-8">
                    {Object.keys(errors).length > 0 && (
                        <Alert variant="destructive" className="mt-0 mb-0 max-w-2xl border-destructive bg-destructive/4">
                            <AlertCircleIcon />
                            <AlertTitle>Error with submission. Please properly fill in all the details.</AlertTitle>
                            <AlertDescription>
                                <ul className="mt-1 list-disc space-y-1 pl-5">
                                    {Object.entries(errors).map(([key, msg]) => (
                                        <li key={key}>{msg as string}</li>
                                    ))}
                                </ul>
                            </AlertDescription>
                        </Alert>
                    )}

                    <Tabs defaultValue="details" className="w-full">
                        <TabsList variant="line" className="border-b border-border">
                            <TabsTrigger value="details">Details</TabsTrigger>
                            <TabsTrigger value="facility">Facility</TabsTrigger>
                        </TabsList>

                        <DetailsTab
                            data={data}
                            setData={setData}
                            errors={errors}
                            requestOptions={requestOptions}
                            handleCheckboxChange={handleCheckboxChange}
                            attachedFiles={attachedFiles}
                            existingFiles={existingFiles}
                            handleFileSelect={handleFileSelect}
                            removeFile={removeFile}
                            removeExistingFile={removeExistingFile}
                        />

                        <TabsContent value="facility" className="mt-6 space-y-6">
                            {/* Two-column grid on desktop — form | sticky sidebar */}
                            <div className="lg:grid lg:grid-cols-[5fr_3fr] lg:items-start lg:gap-6">
                                {/* ── Left: form content ── */}
                                <div className="space-y-6">
                                    <ScheduleSection
                                        selectedDates={selectedDates}
                                        handleDateChange={handleDateChange}
                                        minSelectableDate={minSelectableDate}
                                        availableDaysOfWeek={availableDaysOfWeek}
                                        hasNearMinimumScheduleDate={hasNearMinimumScheduleDate}
                                        bookingTimeOptions={bookingTimeOptions}
                                        availableEndTimeOptions={availableEndTimeOptions}
                                        currentTimeStart={currentTimeStart}
                                        currentTimeEnd={currentTimeEnd}
                                        handleTimeStartChange={handleTimeStartChange}
                                        handleTimeEndChange={handleTimeEndChange}
                                        expectedCapacity={expectedCapacity}
                                        setExpectedCapacity={setExpectedCapacity}
                                        hasOutsiders={hasOutsiders}
                                        setHasOutsiders={setHasOutsiders}
                                        scheduleConflicts={scheduleConflicts}
                                    />

                                    <EquipmentSection
                                        facilities={facilities}
                                        selectedFacility={selectedFacility}
                                        handleFacilityChange={handleFacilityChange}
                                        availableEquipment={availableEquipment}
                                        selectedEquipment={selectedEquipment}
                                        equipmentConflicts={equipmentConflicts}
                                        equipmentAvailability={equipmentAvailability}
                                        selectAllEquipment={selectAllEquipment}
                                        clearEquipmentSelection={clearEquipmentSelection}
                                        handleEquipmentToggle={handleEquipmentToggle}
                                        updateEquipmentQuantity={updateEquipmentQuantity}
                                        externalEquipmentProps={externalEquipmentProps}
                                        borrowPanelProps={borrowPanelProps}
                                    />

                                    <BookingActions
                                        facilityBookingsLength={data.facility_bookings.length}
                                        editingIndex={editingIndex}
                                        cancelEditBooking={cancelEditBooking}
                                        addFacilityBooking={addFacilityBooking}
                                        canSaveFacilityBooking={canSaveFacilityBooking}
                                        selectedDates={selectedDates}
                                    />

                                    {data.facility_bookings.length > 0 && (
                                        <BookingCardList
                                            bookings={data.facility_bookings}
                                            editingIndex={editingIndex}
                                            onEdit={editBooking}
                                            onRemove={removeBooking}
                                        />
                                    )}
                                </div>

                                {/* ── Right: sticky sidebar (desktop only) ── */}
                                <div className="ads-card sticky top-6 hidden p-5 lg:block">
                                    {/* ── Desktop: FacilityInfo manages its own facility + date ── */}
                                    <FacilityInfo facilities={facilities} isForSidebar={true} />

                                    {/* ── Alternatives for FOR_RESCHEDULE ── */}
                                    {isEditing && existingRequest?.status === 'For Reschedule' && editingIndex !== null && (
                                        <div className="mt-6 border-t border-border pt-6">
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center gap-2">
                                                    <LayoutGrid className="h-4 w-4 text-[var(--ads-ok)]" />
                                                    <span className="text-sm font-semibold">Suggested Alternatives</span>
                                                </div>
                                            </div>

                                            <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer mb-3">
                                                <Filter className="h-3.5 w-3.5" />
                                                <input
                                                    type="checkbox"
                                                    checked={includeEquipmentFilter}
                                                    onChange={(e) => setIncludeEquipmentFilter(e.target.checked)}
                                                    className="h-3.5 w-3.5 rounded border-border accent-primary"
                                                />
                                                Check equipment availability
                                            </label>

                                            {alternativesLoading && (
                                                <div className="flex flex-col items-center gap-3 py-4">
                                                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                                    <div className="h-3 w-full animate-pulse rounded bg-muted" />
                                                </div>
                                            )}

                                            {alternativesError && (
                                                <div className="text-sm text-destructive mb-3">
                                                    Failed to load alternatives: {alternativesError}
                                                </div>
                                            )}

{!alternativesLoading && !alternativesError && Object.keys(alternatives).length > 0 && (
                                                    <div className="space-y-4 max-h-[50vh] overflow-y-auto">
                                                        {Object.entries(alternatives).map(([facilityId, slots]) => {
                                                            if (!slots.length) return null;

                                                            const facility = facilities.find((f) => f.id === Number(facilityId));
                                                            const facilityName = facility?.name ?? `Facility #${facilityId}`;

                                                            const grouped = slots.reduce((acc: Record<string, typeof slots>, slot) => {
                                                                if (!acc[slot.type]) acc[slot.type] = [];
                                                                acc[slot.type].push(slot);
                                                                return acc;
                                                            }, {});

                                                            const typeOrder = ['same_facility_time', 'same_facility_date', 'different_facility', 'different_facility_date'] as const;

                                                            function getTypeLabel(type: string) {
                                                                switch (type) {
                                                                    case 'same_facility_time': return 'Same Facility - Different Times';
                                                                    case 'same_facility_date': return 'Same Facility - Nearby Dates';
                                                                    case 'different_facility': return 'Other Facilities - Same Date/Time';
                                                                    case 'different_facility_date': return 'Other Facilities - Nearby Dates';
                                                                    default: return type;
                                                                }
                                                            }

                                                            return (
                                                                <div key={facilityId} className="space-y-3">
                                                                    <h5 className="text-xs font-medium text-foreground uppercase tracking-wide text-muted-foreground">{facilityName}</h5>
                                                                    <div className="space-y-3">
                                                                        {typeOrder.map((type) => {
                                                                            const typeSlots = grouped[type];
                                                                            if (!typeSlots?.length) return null;

                                                                            return (
                                                                                <div key={type} className="space-y-2">
                                                                                    <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{getTypeLabel(type)}</span>
                                                                                    <div className="grid gap-1.5 sm:grid-cols-2">
                                                                                        {typeSlots.map((slot) => {
                                                                                            const slotKey = `${slot.facility_id}-${slot.date}-${slot.time_start}`;
                                                                                            const isSelected = selectedAlternative === slotKey;
                                                                                            return (
                                                                                                <button
                                                                                                    key={slotKey}
                                                                                                    type="button"
                                                                                                    onClick={() => {
                                                                                                        setSelectedAlternative(slotKey);
                                                                                                        applyAlternative(slot);
                                                                                                    }}
                                                                                                    className={`group relative flex flex-col p-3 text-left transition-all duration-150 text-xs ${
                                                                                                        isSelected
                                                                                                            ? 'ads-card border-primary bg-primary/5 ring-1 ring-primary/20 shadow-sm'
                                                                                                            : 'ads-card hover:border-primary/50 hover:bg-primary/5 hover:shadow-sm'
                                                                                                    }`}
                                                                                                >
                                                                                                    <div className="flex items-start justify-between gap-2 mb-2">
                                                                                                        <span className="font-medium text-foreground truncate">{moment(slot.date).format('MMM D')}</span>
                                                                                                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
                                                                                                            <Clock size={10} />
                                                                                                            {moment(slot.time_start, 'HH:mm:ss').format('h:mm A')} – {moment(slot.time_end, 'HH:mm:ss').format('h:mm A')}
                                                                                                        </span>
                                                                                                    </div>
                                                                                                    <div className="flex flex-wrap items-center gap-1.5">
                                                                                                        <Badge variant={slot.capacity_fit === 'exact' ? 'default' : slot.capacity_fit === 'larger' ? 'secondary' : 'outline'} className="text-[10px] px-2 py-0.5">
                                                                                                            {slot.capacity_fit}
                                                                                                        </Badge>
                                                                                                        <Badge variant={slot.equipment_available ? 'default' : 'outline'} className="text-[10px] px-2 py-0.5">
                                                                                                            {slot.equipment_available ? 'Equipment Available' : 'Equipment Unavailable'}
                                                                                                        </Badge>
                                                                                                    </div>
                                                                                                </button>
                                                                                            );
                                                                                        })}
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}

                                            {!alternativesLoading && !alternativesError && Object.keys(alternatives).length === 0 && (
                                                <div className="text-center text-sm text-muted-foreground py-4">
                                                    No available alternatives found.
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </TabsContent>
                    </Tabs>

                    <div className="sticky bottom-0 z-5 -mx-6 flex justify-end gap-4 border-t border-border bg-background/80 px-6 py-4 backdrop-blur-sm md:-mx-8 md:px-8">
                        <Button type="button" variant="outline" size="lg" className="text-md font-semibold" onClick={() => window.history.back()}>
                            Cancel
                        </Button>
                        <Button type="submit" size="lg" className="text-md font-semibold" disabled={processing}>
                            {processing ? (isEditing ? 'Saving...' : 'Submitting...') : isEditing ? 'Save Changes' : 'Submit Request'}
                        </Button>
                    </div>
                </form>
            </div>
        </DefaultLayout>
    );
}
