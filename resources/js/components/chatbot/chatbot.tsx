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
    const [equipmentOptions, setEquipmentOptions] = useState<Array<Equipment & { facility?: string }>>([]);
    const [selectedEquipment, setSelectedEquipment] = useState<Array<{ equipment_id: number; equipment_name: string; quantity_needed: number }>>([]);
    // NEW: Track the message index of the last equipment question we responded to
    const [lastEquipmentQuestionIndex, setLastEquipmentQuestionIndex] = useState<number>(-1);

    const { messages, addMessage, addMessages, setMessages, getMessagesText } = useMessages();
    const { extractAndSet, getCurrentCount } = useParticipantCount();
    const bookingFlow = useBookingFlow(facilities);
    const { isLoading, sendMessage, submitRequest } = useChatAPI();
    const [pendingPayload, setPendingPayload] = useState<CreateRequestPayload | null>(null);
    const [attachedFiles, setAttachedFiles] = useState<AttachedFileInfo[]>([]);
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const messageQueueRef = useRef<Array<{ message: Message; context?: string }>>([]);

    // Auto-scroll to bottom when messages change or mode changes
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, mode]);

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
                            setPendingPayload(payload); // stage for confirmation
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
            const equipmentList = b.equipment?.map(e => `${e.equipment_name} x${e.quantity_needed}`).join(', ') || 'None';
            return `${i + 1}. ${facility?.name || 'Unknown'} on ${b.date} (${b.time_start} - ${b.time_end}) | Equipment: ${equipmentList}`;
        }).join('\n');

        return `Title: ${payload.title}\nDescription: ${payload.description || 'N/A'}\nPriority: ${payload.priority_level ?? 0}\n\nFacilities:\n${bookings}`;
    };

    const handleConfirmRequest = async () => {
        if (!pendingPayload) return;

        try {
            const result = await submitRequest(pendingPayload);
            setPendingPayload(null);
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

    const getLatestAssistantMessage = (): { message: Message; index: number } | undefined => {
        for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].role === 'assistant') {
                return { message: messages[i], index: i };
            }
        }
        return undefined;
    };

    const shouldShowEquipmentPicker = (): boolean => {
        const latest = getLatestAssistantMessage();
        if (!latest || pendingPayload) return false;
        
        // NEW: Don't show if we've already responded to this equipment question
        if (latest.index <= lastEquipmentQuestionIndex) return false;
        
        const text = latest.message.content.toLowerCase();
        const hasEquipmentKeywords = /equipment|any equipment|what equipment|select equipment|equipment you wish|equipment you want/.test(text);
        
        return hasEquipmentKeywords && equipmentOptions.length > 0;
    };

    const handleEquipmentToggle = (equipment: Equipment & { facility?: string }) => {
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
        const items = selectedEquipment.map(e => `${e.equipment_name} (quantity: ${e.quantity_needed})`).join(', ');
        return `I need the following equipment: ${items}`;
    };

    const handleAttachFiles = async (files: File[]) => {
        setUploading(true);
        setUploadError(null);

        const formData = new FormData();
        files.forEach(file => formData.append('files[]', file));

        try {
            const response = await fetch(route('chat.upload'), {
                method: 'POST',
                headers: {
                    'X-CSRF-TOKEN': getCsrfToken(),
                    'X-Requested-With': 'XMLHttpRequest',
                },
                credentials: 'same-origin',
                body: formData,
            });

            const data = await response.json();

            if (data.success && data.files) {
                setAttachedFiles(prev => [...prev, ...data.files]);
            } else {
                setUploadError(data.error || 'Upload failed');
            }
        } catch (err) {
            setUploadError('Network error during upload');
        } finally {
            setUploading(false);
        }
    };

    const submitEquipmentSelection = async () => {
        const message = buildEquipmentSelectionMessage();
        const context = selectedEquipment.length > 0
            ? 'The user selected equipment using the checkbox list. Use these exact selections when generating or updating the booking JSON payload.'
            : 'The user selected no additional equipment. Do not ask for equipment again unless it is required later.';

        // NEW: Mark this equipment question as answered by storing the message index
        const latest = getLatestAssistantMessage();
        if (latest) {
            setLastEquipmentQuestionIndex(latest.index);
        }

        setSelectedEquipment([]);
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
                disabled={uploading}
            />
        </div>
    );
}