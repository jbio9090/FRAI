import React, { useRef, useEffect, useState } from 'react';
import { usePage } from '@inertiajs/react';
import { Message } from './types';
import { useMessages } from './hooks/useMessages';
import { useParticipantCount } from './hooks/useParticipantCount';
import { useChatAPI } from './hooks/useChatAPI';
import { QuickReply } from './components/QuickReplies';
<<<<<<< Updated upstream
import { Facility } from './hooks/useBookingFlow';
=======
import { Facility, useBookingFlow } from './hooks/useBookingFlow';
import { Equipment } from '@/types/equipment';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
>>>>>>> Stashed changes
import WelcomeMessage from './components/WelcomeMessage';
import MessageList from './components/MessageList';
import LoadingIndicator from './components/LoadingIndicator';
import ChatInput from './components/ChatInput';
import BookingFlow from './components/BookingFlow';

type ChatMode = 'idle' | 'booking' | 'ai';

export default function Chatbot() {
    const page = usePage();
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [input, setInput] = React.useState('');
    const [mode, setMode] = useState<ChatMode>('idle');
    const [facilities, setFacilities] = useState<Facility[]>([]);
    const [equipmentOptions, setEquipmentOptions] = useState<Array<Equipment & { facility?: string }>>([]);
    const [selectedEquipment, setSelectedEquipment] = useState<Array<{ equipment_id: number; equipment_name: string; quantity_needed: number }>>([]);

    const { messages, addMessage, getMessagesText } = useMessages();
    const { extractAndSet, getCurrentCount } = useParticipantCount();
    const csrfToken = (page.props as any).csrf_token || '';
    const { isLoading, sendMessage, detectAndSubmitRequest } = useChatAPI(csrfToken);
    const [pendingPayload, setPendingPayload] = useState(null);

    // Auto-scroll to bottom when messages change or mode changes
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, mode]);

    // Fetch facilities for the booking flow
    useEffect(() => {
<<<<<<< Updated upstream
        fetch('/chat/facilities', {
            headers: { 'X-CSRF-TOKEN': csrfToken },
=======
        fetch(route('chat.facilities'), {
            headers: {
                'Accept': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
            },
            credentials: 'same-origin',
        })
            .then(res => res.json())
            .then(json => { if (json.data) setFacilities(json.data); })
            .catch(() => {});

        fetch(route('chat.equipment'), {
            headers: {
                'Accept': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
            },
            credentials: 'same-origin',
        })
            .then(res => res.json())
            .then(json => { if (json.data) setEquipmentOptions(json.data); })
            .catch(() => {});
    }, []);

    useEffect(() => {
        fetch(route('chat.session.get'), {
            headers: {
                'Accept': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                'X-CSRF-TOKEN': getCsrfToken(),
            },
            credentials: 'same-origin',
>>>>>>> Stashed changes
        })
            .then(res => res.json())
            .then(json => {
                if (json.data) setFacilities(json.data);
            })
            .catch(() => { });
    }, []);

    const processAndSend = async (userMessage: Message, contextNote?: string) => {
        addMessage(userMessage);

        // Check if user is confirming a pending request
        const isConfirming = pendingPayload && /\b(yes|proceed|confirm|ok)\b/i.test(userMessage.content);

        if (isConfirming && pendingPayload) {
            try {
                const result = await submitRequest(pendingPayload);
                setPendingPayload(null);
                addMessage({ role: 'assistant', content: `✓ Request #${result.request_id} created successfully!` });
            } catch (err) {
                const errorMsg = err instanceof Error ? err.message : 'Failed to create request';
                addMessage({ role: 'assistant', content: `✗ Failed to create request: ${errorMsg}` });
            }
            return; // don't send to AI again
        }

        try {
            extractAndSet(userMessage.content);

            const allMessages: Message[] = [
                ...(contextNote ? [{ role: 'system' as const, content: `QUICK REPLY CONTEXT: ${contextNote}` }] : []),
                ...messages,
                userMessage,
            ];

            const currentCount = getCurrentCount(getMessagesText()) ?? undefined;
            const responseContent = await sendMessage(allMessages, currentCount);
            addMessage({ role: 'assistant', content: responseContent });

            // Detect JSON payload in AI response and stage it — don't submit yet
            const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                try {
                    const payload = JSON.parse(jsonMatch[0]);
                    if (payload.title && payload.facility_bookings && Array.isArray(payload.facility_bookings)) {
                        setPendingPayload(payload); // stage for confirmation
                    }
                } catch (_) { }
            }

        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Unknown error occurred';
            addMessage({ role: 'assistant', content: `Error: ${errorMsg}` });
        }
    };

<<<<<<< Updated upstream
=======
    const buildRequestSummary = (payload: CreateRequestPayload): string => {
        const bookings = payload.facility_bookings.map((b, i) => {
            const facility = facilities.find(f => f.id === b.facility_id);
            const facilityName = facility?.name || `Facility #${b.facility_id}`;
            const equipment = b.equipment?.map(e => {
                return `${e.quantity_needed}x equipment`;
            }).join(', ') || 'None';
            return `${i + 1}. ${facilityName} on ${b.date} from ${b.time_start} to ${b.time_end} (Equipment: ${equipment})`;
        }).join('\n');

        return `📋 **Booking Summary**\n\n` +
            `**Title:** ${payload.title}\n` +
            `**Description:** ${payload.description || 'N/A'}\n` +
            `**Event Type:** ${payload.priority_level === 2 ? 'Government' : payload.priority_level === 1 ? 'Organizational/University' : 'Academic'}\n\n` +
            `**Bookings:**\n${bookings}\n\n` +
            `Reply "confirm" to submit this request, or "cancel" to discard it.`;
    };

    const handleConfirmRequest = async () => {
        if (!pendingPayload) return;

        const payload = pendingPayload;
        setPendingPayload(null);

        addMessage({ role: 'user', content: 'Confirm' });

        try {
            const payloadWithFiles: CreateRequestPayload = {
                ...payload,
                files: attachedFiles.map(f => f.id),
            };

            const result = await submitRequest(payloadWithFiles);
            if (result) {
                addMessage({
                    role: 'assistant',
                    content: `✅ Request #${result.request_id} has been created successfully${attachedFiles.length > 0 ? ` with ${attachedFiles.length} file(s)` : ''}!`,
                });
                setAttachedFiles([]);
                setUploadError(null);
            }
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Failed to create request';
            addMessage({ role: 'assistant', content: `❌ Failed to create request: ${errorMsg}` });
        }
    };

    const handleCancelRequest = () => {
        setPendingPayload(null);
        addMessage({ role: 'user', content: 'Cancel' });
        addMessage({
            role: 'assistant',
            content: 'Request cancelled. Is there anything else I can help you with?',
        });
    };

    const handleAttachFiles = async (files: FileList) => {
        if (!files || files.length === 0) return;

        setUploading(true);
        setUploadError(null);

        try {
            const formData = new FormData();
            for (let i = 0; i < files.length; i++) {
                formData.append('files[]', files[i]);
            }

            const response = await fetch(route('chat.upload'), {
                method: 'POST',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRF-TOKEN': getCsrfToken(),
                },
                credentials: 'same-origin',
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json();
                const errorMessage = errorData.messages?.join(', ') || errorData.error || 'File upload failed';
                setUploadError(errorMessage);
                return;
            }

            const data = await response.json();
            if (data.success && data.files) {
                setAttachedFiles(prev => [...prev, ...data.files]);
            }
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Upload failed';
            setUploadError(errorMsg);
        } finally {
            setUploading(false);
        }
    };

    const handleRemoveFile = (fileId: string) => {
        setAttachedFiles(prev => prev.filter(f => f.id !== fileId));
    };

    const getLatestAssistantMessage = (): Message | undefined => {
        for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].role === 'assistant') {
                return messages[i];
            }
        }
        return undefined;
    };

    const shouldShowEquipmentPicker = (): boolean => {
        const latest = getLatestAssistantMessage();
        if (!latest || pendingPayload) return false;
        const text = latest.content.toLowerCase();
        return /equipment|any equipment|what equipment|select equipment|equipment you wish|equipment you want/.test(text)
            && equipmentOptions.length > 0;
    };

    const handleEquipmentToggle = (equipment: Equipment) => {
        setSelectedEquipment((prev) => {
            const exists = prev.find((item) => item.equipment_id === equipment.id);
            if (exists) {
                return prev.filter((item) => item.equipment_id !== equipment.id);
            }
            return [
                ...prev,
                { equipment_id: equipment.id, equipment_name: equipment.name, quantity_needed: 1 },
            ];
        });
    };

    const updateEquipmentQuantity = (equipmentId: number, quantity: number) => {
        setSelectedEquipment((prev) => prev.map((item) =>
            item.equipment_id === equipmentId
                ? { ...item, quantity_needed: Math.max(1, quantity) }
                : item
        ));
    };

    const buildEquipmentSelectionMessage = (): string => {
        if (selectedEquipment.length === 0) {
            return 'No additional equipment is needed.';
        }
        return 'I would like the following equipment:\n' + selectedEquipment.map((item) => `- ${item.equipment_name} x${item.quantity_needed}`).join('\n');
    };

    const submitEquipmentSelection = async () => {
        const message = buildEquipmentSelectionMessage();
        const context = selectedEquipment.length > 0
            ? 'The user selected equipment using the checkbox list. Use these exact selections when generating or updating the booking JSON payload.'
            : 'The user selected no additional equipment. Do not ask for equipment again unless it is required later.';

        setSelectedEquipment([]);
        await processAndSend({ role: 'user', content: message }, context);
    };

>>>>>>> Stashed changes
    const handleQuickReply = (option: QuickReply) => {
        if (option.id === 'book_facility') {
            // Enter structured booking flow — no AI needed
            setMode('booking');
            return;
        }
        // All other quick replies go to AI mode
        setMode('ai');
        processAndSend({ role: 'user', content: option.message }, option.context);
    };

    const handleSendMessage = async () => {
        const message = input.trim();
        if (!message || isLoading) return;
        setInput('');
        if (mode === 'idle') setMode('ai');
        await processAndSend({ role: 'user', content: message });
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const handleBookingComplete = (resultMessage: string) => {
        setMode('ai');
        addMessage({ role: 'assistant', content: resultMessage });
    };

    return (
        <div className="w-full h-full flex flex-col bg-white">
            <div className="flex-1 overflow-y-auto p-6 space-y-4">

                {/* Idle — show welcome + quick reply buttons */}
                {mode === 'idle' && (
                    <WelcomeMessage onQuickReply={handleQuickReply} />
                )}

                {/* Booking flow — fully structured, no AI */}
                {mode === 'booking' && (
                    <BookingFlow
                        facilities={facilities}
                        csrfToken={csrfToken}
                        onComplete={handleBookingComplete}
                        onCancel={() => setMode('idle')}
                    />
                )}

                {/* AI chat mode */}
                {mode === 'ai' && (
                    <>
<<<<<<< Updated upstream
                        <MessageList messages={messages} messagesEndRef={messagesEndRef} />
=======
                        <MessageList 
                            messages={messages} 
                            messagesEndRef={messagesEndRef} 
                            showConfirmationButtons={!!pendingPayload}
                            onConfirm={handleConfirmRequest}
                            onCancel={handleCancelRequest}
                        />

                        {shouldShowEquipmentPicker() && (
                            <div className="mb-4 rounded-lg border border-border bg-background p-4">
                                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <p className="text-sm font-semibold">Equipment selection</p>
                                        <p className="text-xs text-muted-foreground">
                                            The assistant asked for equipment. Tick the items you need, adjust quantities, then submit your selection.
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={submitEquipmentSelection}
                                            disabled={isLoading}
                                        >
                                            {selectedEquipment.length > 0 ? 'Send equipment' : 'No equipment needed'}
                                        </Button>
                                    </div>
                                </div>
                                <div className="space-y-3 max-h-64 overflow-y-auto">
                                    {equipmentOptions.map((equipment) => {
                                        const selected = selectedEquipment.find(item => item.equipment_id === equipment.id);
                                        return (
                                            <div key={equipment.id} className="rounded-lg border border-border p-3">
                                                <div className="flex items-start gap-3">
                                                    <Checkbox
                                                        id={`equipment-${equipment.id}`}
                                                        checked={!!selected}
                                                        onCheckedChange={() => handleEquipmentToggle(equipment)}
                                                    />
                                                    <div className="min-w-0 flex-1">
                                                        <Label htmlFor={`equipment-${equipment.id}`} className="text-sm font-medium cursor-pointer">
                                                            {equipment.name}
                                                        </Label>
                                                        <p className="text-xs text-muted-foreground">
                                                            Available: {equipment.quantity} {equipment.facility ? `in ${equipment.facility}` : ''}
                                                        </p>
                                                    </div>
                                                </div>

                                                {selected && (
                                                    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                                                        <Label className="text-sm">Quantity</Label>
                                                        <Input
                                                            type="number"
                                                            min={1}
                                                            max={equipment.quantity}
                                                            value={selected.quantity_needed}
                                                            onChange={(e) => updateEquipmentQuantity(
                                                                equipment.id,
                                                                Math.min(Math.max(1, Number(e.target.value)), equipment.quantity)
                                                            )}
                                                            className="w-24"
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

>>>>>>> Stashed changes
                        {isLoading && <LoadingIndicator />}
                    </>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input area — hidden during booking flow */}
            {mode !== 'booking' && (
                <ChatInput
                    value={input}
                    onChange={setInput}
                    onKeyPress={handleKeyPress}
                    onSend={handleSendMessage}
                    disabled={isLoading}
                />
            )}
        </div>
    );
}
