import { AlertCircleIcon, ChevronDown, Check } from 'lucide-react';
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
import { AlternativesPanel } from './components/AlternativesPanel';
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
                                        alternatives={alternatives}
                                        alternativesLoading={alternativesLoading}
                                        alternativesError={alternativesError}
                                        includeEquipmentFilter={includeEquipmentFilter}
                                        setIncludeEquipmentFilter={setIncludeEquipmentFilter}
                                        applyAlternative={applyAlternative}
                                        facilities={facilities}
                                        isEditing={isEditing}
                                        existingRequest={existingRequest}
                                        editingIndex={editingIndex}
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

{/* ── Alternatives for FOR_RESCHEDULE (Desktop only) ── */}
                                    <div className="hidden lg:block">
                                        <AlternativesPanel
                                            alternatives={alternatives}
                                            alternativesLoading={alternativesLoading}
                                            alternativesError={alternativesError}
                                            includeEquipmentFilter={includeEquipmentFilter}
                                            setIncludeEquipmentFilter={setIncludeEquipmentFilter}
                                            applyAlternative={applyAlternative}
                                            facilities={facilities}
                                            isEditing={isEditing}
                                            existingRequest={existingRequest}
                                            editingIndex={editingIndex}
                                        />
                                    </div>
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
