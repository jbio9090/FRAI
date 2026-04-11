import React, { useRef, useEffect, useState } from 'react';
import { Message, CreateRequestPayload, AttachedFileInfo } from './types';
import { useMessages } from './hooks/useMessages';
import { useParticipantCount } from './hooks/useParticipantCount';
import { useChatAPI } from './hooks/useChatAPI';
import { QuickReply } from './components/QuickReplies';
import { Facility, useBookingFlow } from './hooks/useBookingFlow';
import { Equipment } from '@/types/equipment';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { getCsrfToken } from './utils/csrfToken';
import WelcomeMessage from './components/WelcomeMessage';
import MessageList from './components/MessageList';
import LoadingIndicator from './components/LoadingIndicator';
import ChatInput from './components/ChatInput';
import BookingFlow from './components/BookingFlow';

type ChatMode = 'idle' | 'booking' | 'ai';

export default function Chatbot() {
    const messagesEndRef = useRef<HTMLDivElement | null>(null);
    const [input, setInput] = React.useState('');
    const [mode, setMode] = useState<ChatMode>('idle');
    const [facilities, setFacilities] = useState<Facility[]>([]);
    const [equipmentOptions, setEquipmentOptions] = useState<Array<Equipment>>([]);
    const [selectedEquipment, setSelectedEquipment] = useState<
        Array<{ equipment_id: number; equipment_name: string; quantity_needed: number }>
    >([]);
    // NEW: Track the message index of the last equipment question we responded to
    const [lastEquipmentQuestionIndex, setLastEquipmentQuestionIndex] = useState<number>(-1);
    // NEW: Track whether to show equipment selection UI
    const [showEquipmentSelection, setShowEquipmentSelection] = useState<boolean>(false);

    const { messages, addMessage, addMessages, setMessages, getMessagesText } = useMessages();
    const { extractAndSet, getCurrentCount } = useParticipantCount();
    const bookingFlow = useBookingFlow(facilities);
    const { isLoading, sendMessage, submitRequest } = useChatAPI();
    const [pendingPayload, setPendingPayload] = useState<CreateRequestPayload | null>(null);
    const [attachedFiles, setAttachedFiles] = useState<AttachedFileInfo[]>([]);
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const messageQueueRef = useRef<Array<{ message: Message; context?: string }>>([]);

    // Reset equipment selection UI when mode changes
    useEffect(() => {
        setShowEquipmentSelection(false);
        setSelectedEquipment([]);
    }, [mode]);

    // Fetch facilities and equipment for the booking flow
    useEffect(() => {
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
        })
            .then(res => res.json())
            .then(json => {
                if (json.messages && json.messages.length > 0) {
                    setMessages(json.messages);
                    setMode('ai');
                }
            })
            .catch(() => {});
    }, []);

    const processAndSend = async (userMessage: Message, contextNote?: string, skipUserAdd = false) => {
        if (!skipUserAdd) {
            addMessage(userMessage);
        }
        addMessage({ role: 'assistant', content: '' });

        // Check if user is confirming a pending request
        const isConfirming = pendingPayload && /\b(yes|proceed|confirm|ok)\b/i.test(userMessage.content);

        if (isConfirming && pendingPayload) {
            try {
                const result = await submitRequest(pendingPayload);
                setPendingPayload(null);
                setAttachedFiles([]);
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
            const activeBookingContext = bookingFlow.step !== 'title' && bookingFlow.step !== 'done'
                ? bookingFlow.buildContextSummary()
                : undefined;

            let streamingContent = '';

            await sendMessage(
                allMessages,
                currentCount,
                activeBookingContext,
                (token) => {
                    streamingContent += token;
                    setMessages(prev => {
                        if (prev.length === 0) return prev;
                        const updated = [...prev];
                        const last = updated[updated.length - 1];
                        updated[updated.length - 1] = {
                            ...last,
                            content: streamingContent,
                        };
                        return updated;
                    });
                },
                (json) => {
                    try {
                        const payload = JSON.parse(json);
                        if (payload.title && payload.facility_bookings && Array.isArray(payload.facility_bookings)) {
                            if (attachedFiles.length > 0) {
                                payload.files = attachedFiles.map(f => f.id);
                            }
                            setPendingPayload(payload);
                        }
                    } catch (_) { }
                },
            );

            if (messageQueueRef.current.length > 0) {
                const next = messageQueueRef.current.shift();
                if (next) {
                    await processAndSend(next.message, next.context, true);
                }
            }

        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Unknown error occurred';
            setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                    role: 'assistant',
                    content: `Error: ${errorMsg}`,
                };
                return updated;
            });
        }
    };

    const buildRequestSummary = (payload: CreateRequestPayload): string => {
        const bookings = payload.facility_bookings.map((b, i) => {
            const facility = facilities.find(f => f.id === b.facility_id);
            const equipmentList =
                b.equipment
                    ?.map(e => {
                        const eq = equipmentOptions.find(opt => opt.id === e.equipment_id);
                        return `${eq?.name || 'Unknown'} x${e.quantity_needed}`;
                    })
                    .join(', ') || 'None';
            const facilityName = facility?.name || 'Unknown';
            const facilityInfo = `${i + 1}. ${facilityName} on ${b.date} (${b.time_start} - ${b.time_end})`;
            return `${facilityInfo} | Equipment: ${equipmentList}`;
        }).join('\n');

        const titleLine = `Title: ${payload.title}`;
        const descriptionLine = `Description: ${payload.description || 'N/A'}`;
        const priorityLine = `Priority: ${payload.priority_level ?? 0}`;
        return `${titleLine}\n${descriptionLine}\n${priorityLine}\n\nFacilities:\n${bookings}`;
    };

    const handleConfirmRequest = async () => {
        if (!pendingPayload) return;

        try {
            const result = await submitRequest(pendingPayload);
            setPendingPayload(null);
            setAttachedFiles([]);
            addMessage({ role: 'assistant', content: `✓ Request #${result.request_id} created successfully!` });
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Failed to create request';
            addMessage({ role: 'assistant', content: `✗ Failed to create request: ${errorMsg}` });
        }
    };

    const handleCancelRequest = () => {
        setPendingPayload(null);
        addMessage({ role: 'assistant', content: 'Request cancelled. How else can I help you?' });
    };

    const getCurrentFacilityId = (): number | null => {
        if (bookingFlow.data.facility_id) {
            return bookingFlow.data.facility_id;
        }
        if (pendingPayload && pendingPayload.facility_bookings.length > 0) {
            return pendingPayload.facility_bookings[0].facility_id;
        }
        return null;
    };

    const getFilteredEquipment = () => {
        const facilityId = getCurrentFacilityId();
        if (!facilityId) return equipmentOptions;
        return equipmentOptions.filter(eq => eq.facility_id === facilityId);
    };

    const getLatestAssistantMessage = (): { message: Message; index: number } | null => {
        for (let i = messages.length - 1; i >= 0; i -= 1) {
            if (messages[i].role === 'assistant') {
                return { message: messages[i], index: i };
            }
        }

        return null;
    };

    const getLatestUserMessageBeforeIndex = (endIndex: number): { message: Message; index: number } | null => {
        for (let i = endIndex - 1; i >= 0; i -= 1) {
            if (messages[i].role === 'user') {
                return { message: messages[i], index: i };
            }
        }

        return null;
    };

    const isEquipmentAvailabilityIntent = (text: string): boolean => {
        return [
            /\bavailable equipment\b/,
            /\bequipment available\b/,
            /\bwhat equipment(?:s)? (?:are )?available\b/,
            /\bwhich equipment(?:s)? (?:are )?available\b/,
            /\bshow\b.*\bequipment\b/,
            /\blist\b.*\bequipment\b/,
            /\bselect equipment\b/,
            /\bchoose equipment\b/,
            /\bdo you need\b.*\bequipment\b/,
            /\bwould you like\b.*\bequipment\b/,
            /\bneed any of (?:these )?equipment\b/,
            /\bneed any of these\b.*\bequipment\b/,
            /\bplease let me know if you need\b.*\bequipment\b/,
            /\bi(?:'|’)ll add (?:them|it) to the facility request\b/,
            /\bany additional equipment\b/,
            /\bavailable for use\b/,
        ].some((pattern) => pattern.test(text));
    };

    const shouldShowEquipmentPicker = (): boolean => {
        const latest = getLatestAssistantMessage();
        if (!latest) return false;

        if (latest.index <= lastEquipmentQuestionIndex) return false;

        const latestAssistantText = latest.message.content.toLowerCase();
        const latestUser = getLatestUserMessageBeforeIndex(latest.index);
        const latestUserText = latestUser?.message.content.toLowerCase() ?? '';

        const assistantAskedAboutEquipment = isEquipmentAvailabilityIntent(latestAssistantText);
        const userAskedAboutEquipmentAvailability = isEquipmentAvailabilityIntent(latestUserText);

        return (
            getFilteredEquipment().length > 0 &&
            (assistantAskedAboutEquipment || userAskedAboutEquipmentAvailability)
        );
    };

    const handleEquipmentToggle = (equipment: Equipment) => {
        setSelectedEquipment(prev => {
            const exists = prev.find(item => item.equipment_id === equipment.id);
            if (exists) {
                return prev.filter(item => item.equipment_id !== equipment.id);
            } else {
                return [...prev, {
                    equipment_id: equipment.id,
                    equipment_name: equipment.name,
                    quantity_needed: 1,
                }];
            }
        });
    };

    const updateEquipmentQuantity = (equipmentId: number, quantity: number) => {
        setSelectedEquipment(prev =>
            prev.map(item =>
                item.equipment_id === equipmentId
                    ? { ...item, quantity_needed: quantity }
                    : item
            )
        );
    };

    const buildEquipmentSelectionMessage = (): string => {
        if (selectedEquipment.length === 0) {
            return "I don't need any additional equipment.";
        }
        const items = selectedEquipment
            .map(
                (e) => `${e.equipment_name} (ID: ${e.equipment_id}, quantity: ${e.quantity_needed})`
            )
            .join(', ');
        return `I need the following equipment: ${items}`;
    };

    const handleAttachFiles = async (fileList: FileList) => {
        if (!fileList || fileList.length === 0) {
            setUploadError('No files selected');
            return;
        }

        setUploading(true);
        setUploadError(null);

        const formData = new FormData();
        Array.from(fileList).forEach(file => formData.append('files[]', file));

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);

            const response = await fetch(route('chat.upload'), {
                method: 'POST',
                headers: {
                    'X-CSRF-TOKEN': getCsrfToken(),
                    'X-Requested-With': 'XMLHttpRequest',
                },
                credentials: 'same-origin',
                body: formData,
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Upload error response:', response.status, errorText);
                setUploadError(`Upload failed: ${response.status} ${response.statusText}`);
                setUploading(false);
                return;
            }

            const data = await response.json();
            console.log('Upload response:', data);

            if (data.success && data.files) {
                setAttachedFiles(prev => [...prev, ...data.files]);
            } else {
                setUploadError(data.error || data.message || 'Upload failed');
            }
            setUploading(false);
        } catch (err) {
            if (err instanceof Error && err.name === 'AbortError') {
                setUploadError('Upload timeout - request took too long');
            } else {
                setUploadError(err instanceof Error ? err.message : 'Network error during upload');
            }
            console.error('Upload error:', err);
            setUploading(false);
        }
    };

    const submitEquipmentSelection = async () => {
        const message = buildEquipmentSelectionMessage();
        const serializedSelection = selectedEquipment.map((equipment) => ({
            equipment_id: equipment.equipment_id,
            quantity_needed: equipment.quantity_needed,
        }));
        const equipmentMsg =
            'The user selected equipment using the checkbox list. ' +
            `Use these exact selections when generating or updating the booking JSON payload: ${JSON.stringify(serializedSelection)}. ` +
            'Do not replace the equipment IDs with names or any other format.';
        const noEquipmentMsg =
            'The user selected no additional equipment. ' +
            'Do not ask for equipment again unless it is required later.';
        const context = selectedEquipment.length > 0 ? equipmentMsg : noEquipmentMsg;

        // NEW: Mark this equipment question as answered by storing the message index
        const latest = getLatestAssistantMessage();
        if (latest) {
            setLastEquipmentQuestionIndex(latest.index);
        }

        setSelectedEquipment([]);
        setShowEquipmentSelection(false); // Reset the selection UI
        await processAndSend({ role: 'user', content: message }, context);
    };

    const handleQuickReply = (option: QuickReply) => {
        if (option.id === 'book_facility') {
            // Enter structured booking flow — no AI needed
            setMode('booking');
            return;
        }

        const userMessage: Message = { role: 'user', content: option.message };

        if (isLoading) {
            addMessage(userMessage);
            messageQueueRef.current.push({ message: userMessage, context: option.context });
            return;
        }

        // All other quick replies go to AI mode
        setMode('ai');
        processAndSend(userMessage, option.context);
    };

    const handleSendMessage = async () => {
        const message = input.trim();
        if (!message) return;
        setInput('');
        if (mode === 'idle' || mode === 'booking') setMode('ai');

        const userMessage: Message = { role: 'user', content: message };
        if (isLoading) {
            addMessage(userMessage);
            messageQueueRef.current.push({ message: userMessage });
            return;
        }

        await processAndSend(userMessage);
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
        <div className="w-full h-full flex flex-col bg-background">
            <div className="flex-1 overflow-y-auto p-6 space-y-4">

                {/* Idle — show welcome + quick reply buttons */}
                {mode === 'idle' && (
                    <WelcomeMessage onQuickReply={handleQuickReply} />
                )}

                {/* Booking flow — fully structured, no AI */}
                {mode === 'booking' && (
                    <BookingFlow
                        bookingFlow={bookingFlow}
                        onComplete={handleBookingComplete}
                        onCancel={() => setMode('idle')}
                        attachedFiles={attachedFiles}
                        onAttachFile={handleAttachFiles}
                        uploading={uploading}
                        uploadError={uploadError}
                    />
                )}

                {/* AI chat mode */}
                {mode === 'ai' && (
                    <>
                        <MessageList 
                            messages={messages} 
                            messagesEndRef={messagesEndRef} 
                            showConfirmationButtons={!!pendingPayload}
                            onConfirm={handleConfirmRequest}
                            onCancel={handleCancelRequest}
                        />

                        {shouldShowEquipmentPicker() && (
                            <div className="mb-4 rounded-lg border border-border bg-background p-4">
                                {!showEquipmentSelection ? (
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-semibold">Equipment Selection</p>
                                            <p className="text-xs text-muted-foreground">
                                                Click the button to select equipment from the available list.
                                            </p>
                                        </div>
                                        <Button
                                            size="sm"
                                            onClick={() => setShowEquipmentSelection(true)}
                                            disabled={isLoading}
                                        >
                                            Select Equipment
                                        </Button>
                                    </div>
                                ) : (
                                    <>
                                        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                            <div>
                                                <p className="text-sm font-semibold">Equipment selection</p>
                                                <p className="text-xs text-muted-foreground">
                                                    Tick the items you need, adjust quantities, then submit your selection.
                                                </p>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => setShowEquipmentSelection(false)}
                                                >
                                                    Cancel
                                                </Button>
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
                                            {getFilteredEquipment().map((equipment) => {
                                                const selected = selectedEquipment.find(
                                                    item => item.equipment_id === equipment.id
                                                );
                                                return (
                                                    <div key={equipment.id} className="rounded-lg border border-border p-3">
                                                        <div className="flex items-start gap-3">
                                                            <Checkbox
                                                                id={`equipment-${equipment.id}`}
                                                                checked={!!selected}
                                                                onCheckedChange={() => handleEquipmentToggle(equipment)}
                                                            />
                                                            <div className="min-w-0 flex-1">
                                                                <Label
                                                                htmlFor={`equipment-${equipment.id}`}
                                                                className="text-sm font-medium cursor-pointer"
                                                            >
                                                                    {equipment.name}
                                                                </Label>
                                                                <p className="text-xs text-muted-foreground">
                                                                    Available: {equipment.quantity}
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
                                                                    onChange={(e) => {
                                                                        const value = Number(e.target.value);
                                                                        const bounded = Math.min(
                                                                            Math.max(1, value),
                                                                            equipment.quantity
                                                                        );
                                                                        updateEquipmentQuantity(equipment.id, bounded);
                                                                    }}
                                                                    className="w-24"
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        {isLoading && <LoadingIndicator />}
                    </>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input area — hidden during booking flow */}
            <ChatInput
                value={input}
                onChange={setInput}
                onKeyPress={handleKeyPress}
                onSend={handleSendMessage}
                disabled={uploading || isLoading}
                attachedFiles={attachedFiles}
                onAttachFile={handleAttachFiles}
                uploading={uploading}
                uploadError={uploadError}
                onRemoveFile={(fileId) => {
                    setAttachedFiles(prev => prev.filter(f => f.id !== fileId));
                }}
            />
        </div>
    );
}
