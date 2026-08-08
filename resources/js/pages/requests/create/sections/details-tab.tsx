import type { InertiaFormProps } from '@inertiajs/react';
import { Paperclip } from 'lucide-react';
import { AttachedFileList } from '@/components/attached-file-list';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { PRIORITY_LABELS } from '@/types/request';
import type { RequestOptions } from '@/types/request';
import { PriorityLozenge } from '../priority-lozenge';
import type { AttachedFile, CreateRequestFormData, ExistingFile } from '../types';

interface DetailsTabProps {
    data: CreateRequestFormData;
    setData: InertiaFormProps<CreateRequestFormData>['setData'];
    errors: InertiaFormProps<CreateRequestFormData>['errors'];
    requestOptions: RequestOptions;
    handleCheckboxChange: (name: string) => void;
    attachedFiles: AttachedFile[];
    existingFiles: ExistingFile[];
    handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
    removeFile: (index: number) => void;
    removeExistingFile: (index: number) => void;
}

export function DetailsTab({
    data,
    setData,
    errors,
    requestOptions,
    handleCheckboxChange,
    attachedFiles,
    existingFiles,
    handleFileSelect,
    removeFile,
    removeExistingFile,
}: DetailsTabProps) {
    return (
        <TabsContent value="details" className="mt-6 max-w-3xl space-y-6">
            {/* Request details */}
            <section className="ads-card p-5 md:p-6">
                <div className="mb-5 border-b border-border pb-3">
                    <span className="ads-eyebrow">Request details</span>
                </div>
                <div className="space-y-5">
                    <div className="space-y-2">
                        <Label htmlFor="title">
                            Request Title <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            id="title"
                            type="text"
                            value={data.title}
                            onChange={(e) => setData('title', e.target.value)}
                            placeholder="e.g., Gamecon"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                            id="description"
                            value={data.description}
                            onChange={(e) => setData('description', e.target.value)}
                            placeholder="Provide details about your request"
                            rows={4}
                        />
                    </div>
                </div>
            </section>

            {/* Event type & approval */}
            <section className="ads-card p-5 md:p-6">
                <div className="mb-5 border-b border-border pb-3">
                    <span className="ads-eyebrow">Event type & approval</span>
                </div>
                <div className="space-y-5">
                    <div className="space-y-2">
                        <Label htmlFor="priority">Event Type</Label>
                        <Select
                            value={data.priority_level.toString()}
                            onValueChange={(value) => setData('priority_level', parseInt(value) as 0 | 1 | 2)}
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select priority" />
                            </SelectTrigger>
                            <SelectContent>
                                {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                                    <SelectItem key={value} value={value}>
                                        <span className="flex items-center gap-2">
                                            <PriorityLozenge priority={Number(value)} />
                                            <span>{label}</span>
                                        </span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Approved By</Label>
                        <div className="flex flex-wrap gap-2">
                            {requestOptions.approvers.map((approver, index) => {
                                const isChecked = data.approved_by.includes(approver);

                                return (
                                    <label
                                        key={`${approver}-${index}`}
                                        className={cn(
                                            'flex cursor-pointer items-center gap-2 rounded-[4px] border px-3 py-2 text-sm transition-colors',
                                            isChecked ? 'border-primary bg-[var(--ads-ok-bg)]' : 'border-border bg-card hover:bg-muted/50',
                                        )}
                                    >
                                        <Checkbox
                                            id={`approver-${index}`}
                                            checked={isChecked}
                                            onCheckedChange={() => handleCheckboxChange(approver)}
                                        />
                                        <Label htmlFor={`approver-${index}`} className="cursor-pointer font-medium">
                                            {approver}
                                        </Label>
                                    </label>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </section>

            {/* File Attachments */}
            <section className="ads-card p-5 md:p-6">
                <div className="mb-5 border-b border-border pb-3">
                    <span className="ads-eyebrow">Attachments</span>
                </div>
                <div className="space-y-3">
                    <p className="text-xs text-muted-foreground">Attach supporting documents, images, or files (max 10MB each).</p>

                    <label
                        htmlFor="file-upload"
                        className="flex h-28 w-full cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed border-border transition-colors hover:border-primary/50 hover:bg-muted/20"
                    >
                        <Paperclip size={20} className="mb-2 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Click to attach files</span>
                        <span className="mt-1 text-xs text-muted-foreground">JPG, PNG, PDF, DOC, XLSX, PPTX up to 10MB</span>
                        <input
                            id="file-upload"
                            type="file"
                            multiple
                            accept=".jpg,.jpeg,.png,.pdf,.doc,.docx,.xlsx,.pptx"
                            onChange={handleFileSelect}
                            className="hidden"
                        />
                    </label>

                    <AttachedFileList files={attachedFiles} serverFiles={existingFiles} onRemove={removeFile} onRemoveServer={removeExistingFile} />

                    {/* File errors — catches both array-level and per-file errors */}
                    {(() => {
                        const fileErrors = Object.entries(errors)
                            .filter(([key]) => key === 'files' || key.startsWith('files.'))
                            .map(([, msg]) => msg as string);

                        return fileErrors.length > 0 ? (
                            <ul className="mt-1 space-y-1 text-sm text-destructive">
                                {fileErrors.map((msg, i) => (
                                    <li key={i}>{msg}</li>
                                ))}
                            </ul>
                        ) : null;
                    })()}
                </div>
            </section>
        </TabsContent>
    );
}
