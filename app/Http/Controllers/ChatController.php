<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Http\File as HttpFile;
use App\Models\Request as RequestModel;
use App\Models\Rule as RuleModel;
use App\Models\Facility;
use App\Models\Equipment;
use App\RequestStatus;
use App\PriorityLevel;
use GuzzleHttp\Client;
use GuzzleHttp\Exception\RequestException;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ChatController extends Controller
{
    private string $ollamaUrl;
    private string $model;

    private const SESSION_TTL_MINUTES = 15;

    public function __construct()
    {
        $this->ollamaUrl = config('ollama-laravel.url');
        $this->model     = config('ollama-laravel.model', 'FRAI');
    }

    private function sessionCacheKey(): string
    {
        return 'chat_session_' . Auth::id();
    }

    private function saveSession(array $userMessages): void
    {
        Cache::put(
            $this->sessionCacheKey(),
            $userMessages,
            now()->addMinutes(self::SESSION_TTL_MINUTES)
        );
    }

    private function loadSession(): array
    {
        return Cache::get($this->sessionCacheKey(), []);
    }

    public function getSession(): JsonResponse
    {
        $messages = $this->loadSession();
        return response()->json(['messages' => $messages]);
    }

    private function clearSession(): void
    {
        Cache::forget($this->sessionCacheKey());
    }

    public function newSession(): JsonResponse
    {
        $this->clearSession();
        return response()->json(['message' => 'Session cleared.']);
    }

    private function filterFacilitiesByCapacity($facilities, $participants)
    {
        return $facilities->filter(function ($facility) use ($participants) {
            return $participants <= $facility->capacity
                && $participants >= ($facility->capacity * 0.5);
        });
    }

    private function injectApprovedBookingTable(array &$messages, $allRequests): void
    {
        $approvedBookings = $allRequests->filter(function ($r) {
            return $r->status->value === 'Approved';
        })->flatMap(function ($r) {
            return $r->requestFacilities->map(function ($rf) use ($r) {
                $facilityName = $r->facilities->firstWhere('id', $rf->facility_id)?->name ?? 'Unknown';
                return [
                    'request_id' => $r->id,
                    'facility_id' => $rf->facility_id,
                    'facility_name' => $facilityName,
                    'date' => $rf->date_requested,
                    'time_start' => $rf->time_start,
                    'time_end' => $rf->time_end,
                ];
            });
        })->values();

        if ($approvedBookings->isEmpty()) {
            return;
        }

        $bookingLines = $approvedBookings->map(function ($b) {
            return sprintf(
                "%s | %s | %s | %s | %s | %s",
                $b['facility_id'], $b['facility_name'], $b['date'], $b['time_start'], $b['time_end'], $b['request_id']
            );
        })->implode("\n");

        array_unshift($messages, [
            'role' => 'system',
            'content' => "APPROVED BOOKINGS TABLE FOR AVAILABILITY CHECK:\nFacility ID | Facility Name | Date | Start | End | Request ID\n" . $bookingLines,
        ]);

        array_unshift($messages, [
            'role' => 'system',
            'content' => "When the user asks whether a facility is available for a specific date or time, consult the approved bookings table above. To check for conflicts:\n1. Find all bookings for the same facility_id on the same date\n2. Check if the requested time overlaps with any existing booking:\n   - Overlap occurs if: requested_start < existing_end AND requested_end > existing_start\n3. If ANY overlap is found, the facility is UNAVAILABLE for that time slot\n4. If NO overlaps are found, the facility is AVAILABLE\n\nAlways provide specific details about conflicting bookings when found, and suggest alternative times or facilities.",
        ]);
    }

    public function chat(Request $request): JsonResponse
    {
        try {
            set_time_limit(300);

            $sessionMessages  = $this->loadSession();
            $incomingMessages = $request->input('messages', []);

            $sessionMessages = array_filter($sessionMessages, function($msg) {
                $content = $msg['content'] ?? '';
                $isStaleContext = 
                    strpos($content, 'APPROVED BOOKINGS TABLE') !== false ||
                    strpos($content, 'CURRENT FACILITY REQUESTS') !== false ||
                    strpos($content, 'Available Facilities') !== false ||
                    strpos($content, 'Available Equipment') !== false ||
                    strpos($content, 'FACILITY CAPACITY MATCHING') !== false ||
                    strpos($content, 'IMPORTANT REQUEST CREATION CAPABILITY') !== false ||
                    strpos($content, 'When the user asks whether a facility is available') !== false;
                
                return $msg['role'] !== 'system' || !$isStaleContext;
            });

            $messages = array_merge($sessionMessages, $incomingMessages);

            $participantCount = $request->input('participant_count');
            $bookingContext   = $request->input('booking_context');

            try {
                // Fetch recent requests (both pending and approved) for context
                $allRequests = RequestModel::with(['user', 'requestFacilities', 'facilities'])
                    ->whereIn('status', ['Pending', 'Approved'])
                    ->latest()
                    ->limit(30)
                    ->get();

                $lines = $allRequests->map(function ($r) {
                    $facilities = $r->requestFacilities->map(function ($rf) use ($r) {
                        $facilityName = $r->facilities->firstWhere('id', $rf->facility_id)?->name ?? 'Unknown';
                        return sprintf('%s on %s (%s - %s)', $facilityName, $rf->date_requested, $rf->time_start, $rf->time_end);
                    })->implode('; ');

                    $priorityLabel = $r->priority_level->label();
                    $holdInfo      = $r->on_hold ? ' [ON HOLD]' : '';

                    return sprintf(
                        'Request #%s "%s" — Status: %s%s — Priority: %s — By: %s — Facilities: %s',
                        $r->id, $r->title, $r->status->value, $holdInfo,
                        $priorityLabel, $r->user?->name ?? 'Unknown', $facilities ?: 'N/A'
                    );
                })->toArray();

                if (!empty($lines)) {
                    array_unshift($messages, [
                        'role'    => 'system',
                        'content' => "CURRENT FACILITY REQUESTS (pending & approved):\n- " . implode("\n- ", $lines),
                    ]);
                    $this->injectApprovedBookingTable($messages, $allRequests);
                } else {
                    array_unshift($messages, [
                        'role'    => 'system',
                        'content' => "There are currently NO pending or approved facility bookings in the system. All facilities are available unless specified otherwise.",
                    ]);
                }
            } catch (\Exception $e) {
                \Log::warning('Failed to fetch requests for chat: ' . $e->getMessage());
            }

            try {
                $allFacilities = Facility::orderBy('id', 'asc')->limit(50)->get(['id', 'name', 'building', 'capacity']);

                $facilitiesToDisplay = $allFacilities;
                $filterApplied       = false;

                if ($participantCount && is_numeric($participantCount) && $participantCount > 0) {
                    $participantCount    = (int) $participantCount;
                    $facilitiesToDisplay = $this->filterFacilitiesByCapacity($allFacilities, $participantCount);
                    $filterApplied       = true;
                }

                $facilities = $facilitiesToDisplay->map(function ($f) {
                    return "ID {$f->id}: {$f->name} (Building: {$f->building}, Capacity: {$f->capacity})";
                })->toArray();

                if (!empty($facilities)) {
                    array_unshift($messages, [
                        'role'    => 'system',
                        'content' => "Available Facilities" . ($filterApplied ? " (filtered for {$participantCount} participants)" : "") . ":\n- " . implode("\n- ", $facilities),
                    ]);
                    // Add a reminder to the AI to warn about already approved bookings for selected facilities
                    array_unshift($messages, [
                        'role'    => 'system',
                        'content' => "CRITICAL: When the user wants to book a facility, you MUST check the APPROVED BOOKINGS TABLE first. If the requested facility, date, and time overlaps with any approved booking, you MUST tell the user it's unavailable and suggest alternatives. Do NOT proceed with creating a request that conflicts with approved bookings.",
                    ]);
                } elseif ($filterApplied) {
                    array_unshift($messages, [
                        'role'    => 'system',
                        'content' => "No facilities available with capacity suitable for {$participantCount} participants.",
                    ]);
                }

                $equipment = Equipment::orderBy('id', 'asc')->limit(50)
                    ->get(['id', 'name', 'quantity', 'facility_id'])
                    ->map(function ($e) {
                        return "ID {$e->id}: {$e->name} (Facility: " . ($e->facility->name ?? 'Unknown') . ", Available: {$e->quantity})";
                    })->toArray();

                if (!empty($equipment)) {
                    array_unshift($messages, [
                        'role'    => 'system',
                        'content' => "Available Equipment:\n- " . implode("\n- ", $equipment),
                    ]);
                }

                array_unshift($messages, [
                    'role'    => 'system',
                    'content' => "FACILITY CAPACITY MATCHING:\nWhen the user mentions the number of participants or people they plan to host, ask for this information early if not provided. After learning the participant count, the system will automatically filter and show ONLY suitable facilities. Facilities are recommended based on:\n- Minimum: At least 50% capacity utilization (to avoid empty rooms)\n- Maximum: Can accommodate all participants\nFor example, for 40 participants, recommend rooms with capacity 40-80. Always present the filtered results and explain why those facilities are recommended.",
                ]);

                array_unshift($messages, [
                    'role' => 'system',
                    'content' => "IMPORTANT REQUEST CREATION CAPABILITY:\nYou can create facility requests for the user. When they ask to create a request, collect the following information in this order:\n1. Title (brief request name)\n2. Facility ID (from the available facilities list above)\n3. Equipment (optional list of equipment IDs and quantities needed, from the available equipment list above)\n4. Date (YYYY-MM-DD format)\n5. Start Time (HH:MM format in 24-hour)\n6. End Time (HH:MM format in 24-hour)\n7. Event Type (IMPORTANT - determine from context):\n   - 0 = Academic (default, regular academic events)\n   - 1 = Organizational (official school activities, department events)\n   - 2 = University (university-wide events)\n   - 3 = Government (government officials, external government events, high-authority visits)\n   *Map the selected Event Type to a priority level as follows: Academic=0, Organizational=1, University=1, Government=2.*\n8. Description (detailed explanation)\n9. Additional Message (any extra information the user wants to provide)\n\nPRIORITY OVERRIDE SYSTEM: If the user's event is Organizational (type 1) or University (type 2) or Government (type 3), and there are existing requests at the same time with lower priority, the system will AUTOMATICALLY put those lower-priority requests on hold.\n\nFILE ATTACHMENT REQUIREMENT:\nBefore asking for confirmation, you MUST check if files have been uploaded:\n- If NO files have been uploaded: STOP and ask the user to upload supporting documents. Say: \"Please upload the necessary supporting documents (JPG, PNG, PDF, DOC, XLSX, PPTX - max 10MB each) before I can proceed with the request.\"\n- If files HAVE been uploaded: Proceed with the standard JSON confirmation request below.\n\nAfter collecting all required information and files, construct the JSON payload exactly as shown below and present it to the user for confirmation. Ensure the JSON includes the correct `priority_level` based on the Event Type mapping above:\n{\"title\": \"...\", \"description\": \"...\", \"priority_level\": 0, \"facility_bookings\": [{\"facility_id\": ID, \"date\": \"YYYY-MM-DD\", \"time_start\": \"HH:MM\", \"time_end\": \"HH:MM\", \"equipment\": [{\"equipment_id\": ID, \"quantity_needed\": number}]}]}\n\nWait for the user to confirm 'yes' or 'proceed' before submitting the JSON. Once confirmed, output ONLY the JSON payload (no additional text) to trigger automatic submission to the database.",
                ]);
            } catch (\Exception $e) {
                \Log::warning('Failed to fetch facilities/equipment for chat: ' . $e->getMessage());
            }

            $rules = [];
            try {
                $limitRules = max(1, min(200, (int) $request->input('rules_limit', 50)));
                $rules = RuleModel::orderBy('id', 'asc')->limit($limitRules)->get(['id', 'rule'])
                    ->map(fn($r) => trim($r->rule))->filter()->toArray();

                $rulesListText = !empty($rules) ? implode("\n- ", $rules) : '';
                $rulesSummary  = "Please be aware of the following facility booking guidelines. If a request is directly relevant to these guidelines and would clearly violate one, politely explain the issue and guide toward a valid solution. If a guideline is vague, unrelated to the booking process, or would unnecessarily block a valid facility reservation, use your judgment to allow the request.";
                $rulesSummary .= !empty($rulesListText) ? "\nGuidelines:\n- " . $rulesListText : "\n(There are currently no configured guidelines.)";

                array_unshift($messages, ['role' => 'system', 'content' => $rulesSummary]);
            } catch (\Exception $e) {
                \Log::warning('Failed to fetch Rules for chat: ' . $e->getMessage());
                array_unshift($messages, [
                    'role'    => 'system',
                    'content' => 'Please be aware of facility booking guidelines stored in the system. If a request directly violates a relevant guideline, explain the issue politely and guide toward a valid solution. Do not unnecessarily block valid facility reservations.',
                ]);
            }

            if (!empty($bookingContext)) {
                array_unshift($messages, [
                    'role'    => 'system',
                    'content' => "BOOKING FLOW CONTEXT (HIGHEST PRIORITY):\n" . $bookingContext . "\n\nIMPORTANT: The user is currently in the middle of a structured booking process. Do NOT restart the process. Only assist based on the collected data and current step.",
                ]);
            }

            if (empty($messages)) {
                return response()->json(['error' => 'No messages provided'], 400);
            }

            $client   = new Client(['timeout' => 580]);
            $response = $client->post($this->ollamaUrl . '/api/chat', [
                'json' => [
                    'model'    => $this->model,
                    'messages' => $messages,
                    'stream'   => false,
                ],
            ]);

            $data = json_decode($response->getBody(), true);

            $userAndAssistantMessages = array_filter($incomingMessages, fn($m) => in_array($m['role'], ['user', 'assistant']));
            if (isset($data['message']['content'])) {
                $userAndAssistantMessages[] = [
                    'role'    => 'assistant',
                    'content' => $data['message']['content'],
                ];
            }
            $this->saveSession(array_values($userAndAssistantMessages));

            // Rule validation
            if (!empty($rules)) {
                try {
                    $assistantText = $data['message']['content'] ?? $data['response'] ?? (is_string($data) ? $data : '');

                    $validatorMessages = [
                        [
                            'role'    => 'system',
                            'content' => "You are a careful rules validator. Analyze if the assistant response CLEARLY AND DIRECTLY VIOLATES any hard constraints in the rules. Important distinctions:\n\n- VIOLATIONS (hard constraints): Explicit prohibitions like 'do not mention X', 'never do Y', 'forbidden topic', 'cannot discuss Z'\n- NOT VIOLATIONS (soft guidelines): Style preferences like 'be brief', 'be concise', 'use simple language', 'be friendly'\n\nOnly flag something as a violation if it DIRECTLY contradicts a strict prohibition. Return ONLY valid JSON with key \"violations\" (array of rule indices, 0-based). Example: {\"violations\": [0,2]} or {\"violations\": []}. No extra text.",
                        ],
                        [
                            'role'    => 'user',
                            'content' => "Rules:\n- " . implode("\n- ", $rules) . "\n\nAssistant Response:\n" . $assistantText,
                        ],
                    ];

                    try {
                        $validatorResp = $client->post($this->ollamaUrl . '/api/chat', [
                            'json' => ['model' => $this->model, 'messages' => $validatorMessages, 'stream' => false],
                        ]);

                        if ($validatorResp->getStatusCode() >= 400) {
                            \Log::warning('Validator API returned error status: ' . $validatorResp->getStatusCode());
                            return response()->json($data);
                        }

                        $validatorData = json_decode($validatorResp->getBody(), true);
                        $jsonText      = $validatorData['message']['content'] ?? $validatorData['response'] ?? (is_string($validatorData) ? $validatorData : '');
                        $parsed        = @json_decode($jsonText, true);

                        if (is_array($parsed) && !empty($parsed['violations'])) {
                            $violationDetails = [];
                            foreach ($parsed['violations'] as $ruleIndex) {
                                if (isset($rules[$ruleIndex])) {
                                    $violationDetails[] = 'Rule #' . ($ruleIndex + 1) . ': ' . $rules[$ruleIndex];
                                }
                            }
                            $data = [
                                'message' => [
                                    'content' => "I cannot comply with that request because it would violate the following rules:\n\n" . implode("\n\n", $violationDetails),
                                    'role'    => 'assistant',
                                ],
                            ];
                        }
                    } catch (RequestException $ve) {
                        \Log::warning('Validator API request failed: ' . $ve->getMessage());
                        return response()->json($data);
                    }
                } catch (\Exception $e) {
                    \Log::warning('Rule validation failed: ' . $e->getMessage());
                }
            }

            return response()->json($data);

        } catch (RequestException $e) {
            \Log::error('Chat error: ' . $e->getMessage());
            return response()->json([
                'error'   => 'Failed to connect to Ollama',
                'message' => config('app.debug') ? $e->getMessage() : 'An error occurred',
            ], 500);
        } catch (\Exception $e) {
            \Log::error('Chat error: ' . $e->getMessage());
            return response()->json([
                'error'   => 'Failed to process chat request',
                'message' => config('app.debug') ? $e->getMessage() : 'An error occurred',
            ], 500);
        }
    }

    public function stream(Request $request): StreamedResponse
    {
        // Collect all the same context as chat()
        $messages         = $request->input('messages', []);
        $participantCount = $request->input('participant_count');
        $bookingContext   = $request->input('booking_context');

        // Load session history and merge
        $sessionMessages = $this->loadSession();
        
        $sessionMessages = array_filter($sessionMessages, function($msg) {
            $content = $msg['content'] ?? '';
            $isStaleContext = 
                strpos($content, 'APPROVED BOOKINGS TABLE') !== false ||
                strpos($content, 'CURRENT FACILITY REQUESTS') !== false ||
                strpos($content, 'Available Facilities') !== false ||
                strpos($content, 'Available Equipment') !== false ||
                strpos($content, 'FACILITY CAPACITY MATCHING') !== false ||
                strpos($content, 'IMPORTANT REQUEST CREATION CAPABILITY') !== false ||
                strpos($content, 'When the user asks whether a facility is available') !== false;
            
            return $msg['role'] !== 'system' || !$isStaleContext;
        });
        
        $messages = array_merge($sessionMessages, $messages);

        // Inject DB context 
        try {
            $allRequests = RequestModel::with(['user', 'requestFacilities', 'facilities'])
                ->whereIn('status', ['Pending', 'Approved'])
                ->latest()->limit(30)->get();

            $lines = $allRequests->map(function ($r) {
                $facilities    = $r->requestFacilities->map(function ($rf) use ($r) {
                    $facilityName = $r->facilities->firstWhere('id', $rf->facility_id)?->name ?? 'Unknown';
                    return sprintf('%s on %s (%s - %s)', $facilityName, $rf->date_requested, $rf->time_start, $rf->time_end);
                })->implode('; ');
                $priorityLabel = $r->priority_level->label();
                $holdInfo      = $r->on_hold ? ' [ON HOLD]' : '';
                return sprintf('Request #%s "%s" — Status: %s%s — Priority: %s — By: %s — Facilities: %s',
                    $r->id, $r->title, $r->status->value, $holdInfo, $priorityLabel, $r->user?->name ?? 'Unknown', $facilities ?: 'N/A'
                );
            })->toArray();

            if (!empty($lines)) {
                array_unshift($messages, ['role' => 'system', 'content' => "CURRENT FACILITY REQUESTS (pending & approved):\n- " . implode("\n- ", $lines)]);
                $this->injectApprovedBookingTable($messages, $allRequests);
            } else {
                array_unshift($messages, ['role' => 'system', 'content' => "There are currently NO pending or approved facility bookings in the system. All facilities are available unless specified otherwise."]);
            }
        } catch (\Exception $e) {
            \Log::warning('Stream: Failed to fetch requests: ' . $e->getMessage());
        }

        try {
            $allFacilities       = Facility::orderBy('id', 'asc')->limit(50)->get(['id', 'name', 'building', 'capacity']);
            $facilitiesToDisplay = $allFacilities;
            $filterApplied       = false;

            if ($participantCount && is_numeric($participantCount) && $participantCount > 0) {
                $participantCount    = (int) $participantCount;
                $facilitiesToDisplay = $this->filterFacilitiesByCapacity($allFacilities, $participantCount);
                $filterApplied       = true;
            }

            $facilities = $facilitiesToDisplay->map(fn($f) => "ID {$f->id}: {$f->name} (Building: {$f->building}, Capacity: {$f->capacity})")->toArray();

            if (!empty($facilities)) {
                array_unshift($messages, ['role' => 'system', 'content' => "Available Facilities" . ($filterApplied ? " (filtered for {$participantCount} participants)" : "") . ":\n- " . implode("\n- ", $facilities)]);
                // Add a reminder to the AI to warn about already approved bookings for selected facilities
                array_unshift($messages, [
                    'role'    => 'system',
                    'content' => "CRITICAL: When the user wants to book a facility, you MUST check the APPROVED BOOKINGS TABLE first. If the requested facility, date, and time overlaps with any approved booking, you MUST tell the user it's unavailable and suggest alternatives. Do NOT proceed with creating a request that conflicts with approved bookings.",
                ]);
            } elseif ($filterApplied) {
                array_unshift($messages, ['role' => 'system', 'content' => "No facilities available with capacity suitable for {$participantCount} participants."]);
            }

            $equipment = Equipment::orderBy('id', 'asc')->limit(50)->get(['id', 'name', 'quantity', 'facility_id'])
                ->map(fn($e) => "ID {$e->id}: {$e->name} (Facility: " . ($e->facility->name ?? 'Unknown') . ", Available: {$e->quantity})")->toArray();

            if (!empty($equipment)) {
                array_unshift($messages, ['role' => 'system', 'content' => "Available Equipment:\n- " . implode("\n- ", $equipment)]);
            }

            array_unshift($messages, ['role' => 'system', 'content' => "FACILITY CAPACITY MATCHING:\nWhen the user mentions the number of participants or people they plan to host, ask for this information early if not provided. After learning the participant count, the system will automatically filter and show ONLY suitable facilities. Facilities are recommended based on:\n- Minimum: At least 50% capacity utilization (to avoid empty rooms)\n- Maximum: Can accommodate all participants\nFor example, for 40 participants, recommend rooms with capacity 40-80. Always present the filtered results and explain why those facilities are recommended."]);
            // Updated flow: ask for event type and map to priority level, no separate priority reason
            // Updated order: Description moved after Event Type, and Additional Message retained at end.
                // Updated file attachment handling: files are optional. If provided, include them; otherwise proceed without prompting.
                array_unshift($messages, ['role' => 'system', 'content' => "IMPORTANT REQUEST CREATION CAPABILITY:\nYou can create facility requests for the user. When they ask to create a request, collect the following information in this order:\n1. Title (brief request name)\n2. Facility ID (from the available facilities list above)\n3. Equipment (optional list of equipment IDs and quantities needed, from the available equipment list above)\n4. Date (YYYY-MM-DD format)\n5. Start Time (HH:MM format in 24-hour)\n6. End Time (HH:MM format in 24-hour)\n7. Event Type (IMPORTANT - determine from context):\n   - 0 = Academic (default, regular academic events)\n   - 1 = Organizational (official school activities, department events)\n   - 2 = University (university-wide events)\n   - 3 = Government (government officials, external government events, high-authority visits)\n   *Map the selected Event Type to a priority level as follows: Academic=0, Organizational=1, University=1, Government=2.*\n8. Description (detailed explanation)\n9. Additional Message (any extra information the user wants to provide)\n\nPRIORITY OVERRIDE SYSTEM: If the user's event is Organizational (type 1) or University (type 2) or Government (type 3), and there are existing requests at the same time with lower priority, the system will AUTOMATICALLY put those lower-priority requests on hold.\n\nFILE ATTACHMENT (OPTIONAL): Users may optionally upload supporting documents (JPG, PNG, PDF, DOC, XLSX, PPTX - max 10MB each). Files are not required to proceed with the request. If files are available, include them in the submission. If no files are provided, proceed without them.\n\nAfter collecting all required information and any optional files, construct the JSON payload exactly as shown below and present it to the user for confirmation. Ensure the JSON includes the correct `priority_level` based on the Event Type mapping above:\n{\"title\": \"...\", \"description\": \"...\", \"priority_level\": 0, \"facility_bookings\": [{\"facility_id\": ID, \"date\": \"YYYY-MM-DD\", \"time_start\": \"HH:MM\", \"time_end\": \"HH:MM\", \"equipment\": [{\"equipment_id\": ID, \"quantity_needed\": number}]}]}\n\nWait for the user to confirm 'yes' or 'proceed' before submitting the JSON. Once confirmed, output ONLY the JSON payload (no additional text) to trigger automatic submission to the database."]);
        } catch (\Exception $e) {
            \Log::warning('Stream: Failed to fetch facilities/equipment: ' . $e->getMessage());
        }

        $rules = [];
        try {
            $rules = RuleModel::orderBy('id', 'asc')->limit(50)->get(['id', 'rule'])
                ->map(fn($r) => trim($r->rule))->filter()->toArray();

            $rulesSummary = "You MUST follow the following rules exactly. If a user request would violate any rule, you MUST refuse and reply with a short explanation stating which rule would be violated. Do NOT provide prohibited content.";
            $rulesSummary .= !empty($rules) ? "\nRules:\n- " . implode("\n- ", $rules) : "\n(There are currently no configured rules.)";
            array_unshift($messages, ['role' => 'system', 'content' => $rulesSummary]);
        } catch (\Exception $e) {
            \Log::warning('Stream: Failed to fetch rules: ' . $e->getMessage());
        }

        if (!empty($bookingContext)) {
            array_unshift($messages, ['role' => 'system', 'content' => "BOOKING FLOW CONTEXT (HIGHEST PRIORITY):\n" . $bookingContext . "\n\nIMPORTANT: The user is currently in the middle of a structured booking process. Do NOT restart the process."]);
        }

        // Capture incoming user messages to save to session ltr
        $incomingMessages = $request->input('messages', []);

        return response()->stream(function () use ($messages, $incomingMessages, $rules) {
            set_time_limit(300);

            $client = new Client(['timeout' => 580]);
            $fullContent = '';

            try {
                $response = $client->post($this->ollamaUrl . '/api/chat', [
                    'json' => [
                        'model'    => $this->model,
                        'messages' => $messages,
                        'stream'   => true,
                    ],
                    'stream' => true, 
                ]);

                $body = $response->getBody();

                $isCapturingJson = false;
                $jsonBuffer = '';

                while (!$body->eof()) {
                    $line = '';

                    while (!$body->eof()) {
                        $char = $body->read(1);
                        if ($char === "\n") break;
                        $line .= $char;
                    }

                    $line = trim($line);
                    if (empty($line)) continue;

                    $chunk = @json_decode($line, true);
                    if (!is_array($chunk)) continue;

                    $token = $chunk['message']['content'] ?? '';
                    $done  = $chunk['done'] ?? false;

                    if ($token !== '') {
                        $fullContent .= $token;

                        // Detect start of JSON
                        if (!$isCapturingJson && str_contains($token, '{')) {
                            $isCapturingJson = true;
                            $jsonBuffer = $token;
                            // Don't send JSON tokens to UI
                            continue;
                        }

                        // Continue capturing JSON
                        if ($isCapturingJson) {
                            $jsonBuffer .= $token;
                            
                            // Try to parse complete JSON
                            try {
                                $parsed = json_decode($jsonBuffer, true);
                                if ($parsed !== null && is_array($parsed)) {
                                    // Valid JSON found - send as booking_payload
                                    echo "data: " . json_encode(['booking_payload' => $jsonBuffer]) . "\n\n";
                                    ob_flush();
                                    flush();
                                    
                                    $isCapturingJson = false;
                                    $jsonBuffer = '';
                                }
                            } catch (\Exception $e) {
                                // Not valid JSON yet, keep accumulating
                            }
                            
                            // Don't send JSON tokens to UI
                            continue;
                        }

                        // Regular token (not JSON)
                        echo "data: " . json_encode(['token' => $token]) . "\n\n";
                        ob_flush();
                        flush();
                    }

                    if ($done) break;
                }

                // Rule validation on full content
                if (!empty($rules)) {
                    try {
                        $validatorMessages = [
                            ['role' => 'system', 'content' => "You are a careful rules validator. Analyze if the assistant response CLEARLY AND DIRECTLY VIOLATES any hard constraints in the rules.\n\n- VIOLATIONS: Explicit prohibitions like 'do not mention X', 'never do Y'\n- NOT VIOLATIONS: Style preferences like 'be brief', 'be friendly'\n\nReturn ONLY valid JSON with key \"violations\" (array of rule indices, 0-based). No extra text."],
                            ['role' => 'user',   'content' => "Rules:\n- " . implode("\n- ", $rules) . "\n\nAssistant Response:\n" . $fullContent],
                        ];

                        $validatorResp = $client->post($this->ollamaUrl . '/api/chat', [
                            'json' => ['model' => $this->model, 'messages' => $validatorMessages, 'stream' => false],
                        ]);

                        $validatorData = json_decode($validatorResp->getBody(), true);
                        $jsonText      = $validatorData['message']['content'] ?? '';
                        $parsed        = @json_decode($jsonText, true);

                        if (!empty($parsed['violations'])) {
                            $violationDetails = [];
                            foreach ($parsed['violations'] as $idx) {
                                if (isset($rules[$idx])) {
                                    $violationDetails[] = 'Rule #' . ($idx + 1) . ': ' . $rules[$idx];
                                }
                            }
                            $violationMessage = "I cannot comply with that request because it would violate the following rules:\n\n" . implode("\n\n", $violationDetails);

                            // Override the streamed content with the violation message
                            echo "data: " . json_encode(['violation' => $violationMessage]) . "\n\n";
                            ob_flush();
                            flush();

                            $fullContent = $violationMessage;
                        }
                    } catch (\Exception $e) {
                        \Log::warning('Stream: Rule validation failed: ' . $e->getMessage());
                    }
                }

                // Save session
                $userAndAssistant = array_filter($incomingMessages, fn($m) => in_array($m['role'], ['user', 'assistant']));
                $userAndAssistant[] = ['role' => 'assistant', 'content' => $fullContent];
                $this->saveSession(array_values($userAndAssistant));

                echo "data: " . json_encode(['done' => true]) . "\n\n";
                ob_flush();
                flush();

            } catch (\Exception $e) {
                \Log::error('Stream error: ' . $e->getMessage());
                echo "data: " . json_encode(['error' => 'Stream failed']) . "\n\n";
                ob_flush();
                flush();
            }
        }, 200, [
            'Content-Type'      => 'text/event-stream',
            'Cache-Control'     => 'no-cache',
            'X-Accel-Buffering' => 'no', 
            'Connection'        => 'keep-alive',
        ]);
    }

    public function testCsrf(): JsonResponse
    {
        try {
            $client   = new Client(['timeout' => 10]);
            $response = $client->get($this->ollamaUrl . '/api/tags');
            $data     = json_decode($response->getBody(), true);

            return response()->json([
                'message'   => 'Connected to Ollama',
                'models'    => $data['models'] ?? [],
                'timestamp' => now(),
            ]);
        } catch (\Exception $e) {
            \Log::error('Ollama connection test failed: ' . $e->getMessage());
            return response()->json([
                'error'   => 'Cannot connect to Ollama at ' . $this->ollamaUrl,
                'message' => config('app.debug') ? $e->getMessage() : 'Connection failed',
            ], 500);
        }
    }

    public function models(): JsonResponse
    {
        try {
            $client   = new Client(['timeout' => 10]);
            $response = $client->get($this->ollamaUrl . '/api/tags');
            $data     = json_decode($response->getBody(), true);

            return response()->json(['models' => $data['models'] ?? []]);
        } catch (\Exception $e) {
            \Log::error('Models fetch error: ' . $e->getMessage());
            return response()->json([
                'error'   => 'Failed to fetch models',
                'message' => config('app.debug') ? $e->getMessage() : 'An error occurred',
            ], 500);
        }
    }

    public function latestRequests(Request $request): JsonResponse
    {
        try {
            $limit = max(1, min(20, (int) $request->input('limit', 5)));

            $rows = RequestModel::orderBy('created_at', 'desc')
                ->limit($limit)
                ->get(['id', 'user_id', 'status', 'created_at'])
                ->map(fn($r) => [
                    'id'         => $r->id,
                    'user_id'    => $r->user_id,
                    'status'     => $r->status,
                    'created_at' => $r->created_at->toDateTimeString(),
                ]);

            return response()->json(['data' => $rows]);
        } catch (\Exception $e) {
            \Log::error('Latest requests error: ' . $e->getMessage());
            return response()->json([
                'error'   => 'Failed to fetch latest requests',
                'message' => config('app.debug') ? $e->getMessage() : 'An error occurred',
            ], 500);
        }
    }

    public function rulesList(Request $request): JsonResponse
    {
        try {
            $limit = max(1, min(200, (int) $request->input('limit', 50)));

            $rows = RuleModel::orderBy('id', 'asc')
                ->limit($limit)
                ->get(['id', 'rule'])
                ->map(fn($r) => ['id' => $r->id, 'rule' => trim($r->rule)]);

            return response()->json(['data' => $rows]);
        } catch (\Exception $e) {
            \Log::error('Rules list error: ' . $e->getMessage());
            return response()->json([
                'error'   => 'Failed to fetch rules',
                'message' => config('app.debug') ? $e->getMessage() : 'An error occurred',
            ], 500);
        }
    }

    public function facilitiesList(Request $request): JsonResponse
    {
        try {
            $limit = max(1, min(200, (int) $request->input('limit', 50)));

            $rows = Facility::orderBy('id', 'asc')
                ->limit($limit)
                ->get(['id', 'name', 'building', 'capacity'])
                ->map(fn($f) => [
                    'id'       => $f->id,
                    'name'     => $f->name,
                    'building' => $f->building,
                    'capacity' => $f->capacity,
                ]);

            return response()->json(['data' => $rows]);
        } catch (\Exception $e) {
            \Log::error('Facilities list error: ' . $e->getMessage());
            return response()->json([
                'error'   => 'Failed to fetch facilities',
                'message' => config('app.debug') ? $e->getMessage() : 'An error occurred',
            ], 500);
        }
    }

    public function equipmentList(Request $request): JsonResponse
    {
        try {
            $limit = max(1, min(200, (int) $request->input('limit', 50)));

            $rows = Equipment::orderBy('id', 'asc')
                ->limit($limit)
                ->get(['id', 'name', 'quantity', 'facility_id'])
                ->map(fn($e) => [
                    'id'       => $e->id,
                    'name'     => $e->name,
                    'quantity' => $e->quantity,
                    'facility' => $e->facility->name ?? $e->facility_id ?? null,
                ]);

            return response()->json(['data' => $rows]);
        } catch (\Exception $e) {
            \Log::error('Equipment list error: ' . $e->getMessage());
            return response()->json([
                'error'   => 'Failed to fetch equipment',
                'message' => config('app.debug') ? $e->getMessage() : 'An error occurred',
            ], 500);
        }
    }

    public function uploadFile(Request $request): JsonResponse
    {
        try {
            $validated = $request->validate([
                'files' => 'required|array|min:1',
                'files.*' => 'required|file|max:10485760|mimes:jpeg,jpg,png,pdf,doc,docx,xls,xlsx,ppt,pptx',
            ]);

            $uploadedFiles = [];
            $userId = Auth::id();
            $sessionId = session()->getId();
            $tempDir = "chat-uploads/{$userId}/{$sessionId}";

            try {
                if (!Storage::disk('public')->exists($tempDir)) {
                    Storage::disk('public')->makeDirectory($tempDir, 0755, true);
                }
            } catch (\Exception $dirErr) {
                \Log::error("Failed to create temp directory: " . $dirErr->getMessage());
                return response()->json([
                    'success' => false,
                    'error' => 'Failed to create upload directory',
                ], 500);
            }

            foreach ($request->file('files') as $file) {
                try {
                    $fileId = Str::uuid();
                    $extension = $file->getClientOriginalExtension();
                    $filename = $fileId . '.' . $extension;
                    
                    $path = Storage::disk('public')->putFileAs($tempDir, $file, $filename);
                    
                    if (!$path) {
                        \Log::warning("File storage returned false for: {$filename}");
                        continue;
                    }

                    $uploadedFiles[] = [
                        'id' => (string) $fileId,
                        'name' => $file->getClientOriginalName(),
                        'size' => $file->getSize(),
                        'mime_type' => $file->getMimeType(),
                        'url' => Storage::disk('public')->url($path),
                    ];
                } catch (\Exception $fileErr) {
                    \Log::error("Failed to upload file: " . $fileErr->getMessage());
                    continue;
                }
            }

            if (empty($uploadedFiles)) {
                return response()->json([
                    'success' => false,
                    'error' => 'No files were successfully uploaded',
                ], 422);
            }

            return response()->json([
                'success' => true,
                'files' => $uploadedFiles,
            ]);

        } catch (\Illuminate\Validation\ValidationException $e) {
            $errorMessages = [];
            
            if ($e->has('files.*')) {
                foreach ($request->file('files') as $index => $file) {
                    $errors = $e->errors();
                    if (isset($errors["files.{$index}"])) {
                        foreach ($errors["files.{$index}"] as $error) {
                            $errorMessages[] = "{$file->getClientOriginalName()}: {$error}";
                        }
                    }
                }
            }

            return response()->json([
                'success' => false,
                'error' => 'File validation failed',
                'messages' => !empty($errorMessages) ? $errorMessages : $e->errors(),
            ], 422);

        } catch (\Exception $e) {
            \Log::error('File upload error: ' . $e->getMessage() . ' ' . $e->getTraceAsString());
            return response()->json([
                'success' => false,
                'error' => 'File upload failed',
                'message' => config('app.debug') ? $e->getMessage() : 'An error occurred',
            ], 500);
        }
    }

    public function createRequestApi(Request $request): JsonResponse
    {
        try {
            $validated = $request->validate([
                'title'                                           => 'required|string|max:255',
                'description'                                     => 'nullable|string',
                'priority_level'                                  => 'nullable|integer|in:0,1,2,3',
                'priority_reason'                                 => 'nullable|string|max:512',
                'facility_bookings'                               => 'required|array|min:1',
                'facility_bookings.*.facility_id'                 => 'required|exists:facilities,id',
                'facility_bookings.*.date'                        => 'required|date',
                'facility_bookings.*.time_start'                  => 'required|regex:/^\d{1,2}:\d{2}(:\d{2})?$/',
                'facility_bookings.*.time_end'                    => 'required|regex:/^\d{1,2}:\d{2}(:\d{2})?$/',
                'facility_bookings.*.equipment'                   => 'sometimes|nullable|array',
                'facility_bookings.*.equipment.*.equipment_id'    => 'required|exists:equipments,id',
                'facility_bookings.*.equipment.*.quantity_needed' => 'required|integer|min:1',
                'files'                                           => 'nullable|array',
                'files.*'                                         => 'nullable|string',
            ]);

            $priorityLevel  = (int) ($validated['priority_level'] ?? 0);
            $priorityReason = $validated['priority_reason'] ?? null;

            $facilityRequest = RequestModel::create([
                'user_id'         => Auth::id(),
                'title'           => $validated['title'],
                'description'     => $validated['description'] ?? null,
                'status'          => RequestStatus::PENDING,
                'priority_level'  => $priorityLevel,
                'priority_reason' => $priorityReason,
            ]);

            foreach ($validated['facility_bookings'] as $booking) {
                $dateOnly = \Illuminate\Support\Carbon::parse($booking['date'])->format('Y-m-d');
                $facilityRequest->requestFacilities()->create([
                    'facility_id'    => $booking['facility_id'],
                    'date_requested' => $dateOnly,
                    'time_start'     => $booking['time_start'],
                    'time_end'       => $booking['time_end'],
                ]);

                if (!empty($booking['equipment'])) {
                    foreach ($booking['equipment'] as $equipment) {
                        $facilityRequest->equipment()->attach($equipment['equipment_id'], [
                            'quantity_needed' => $equipment['quantity_needed'],
                        ]);
                    }
                }
            }

            // Handle file uploads - move from temp storage to permanent
            $userId = Auth::id();
            $sessionId = session()->getId();
            $tempDir = "chat-uploads/{$userId}/{$sessionId}";
            $fileCount = 0;

            if (!empty($validated['files'])) {
                foreach ($validated['files'] as $fileId) {
                    try {
                        $tempFiles = Storage::disk('public')->files($tempDir);
                        $tempFilePath = null;

                        foreach ($tempFiles as $file) {
                            if (str_contains($file, $fileId)) {
                                $tempFilePath = $file;
                                break;
                            }
                        }

                        if ($tempFilePath) {
                            $originalName = basename($tempFilePath);
                            $permanentPath = "request-files/{$originalName}";
                            
                            $content = Storage::disk('public')->get($tempFilePath);
                            Storage::disk('public')->put($permanentPath, $content);

                            $facilityRequest->files()->create([
                                'path'          => $permanentPath,
                                'original_name' => $originalName,
                                'mime_type'     => Storage::disk('public')->mimeType($tempFilePath),
                                'size'          => Storage::disk('public')->size($tempFilePath),
                            ]);

                            Storage::disk('public')->delete($tempFilePath);
                            $fileCount++;
                        }
                    } catch (\Exception $e) {
                        \Log::warning("Failed to process file {$fileId}: " . $e->getMessage());
                    }
                }

                try {
                    $remainingFiles = Storage::disk('public')->files($tempDir);
                    if (empty($remainingFiles)) {
                        Storage::disk('public')->deleteDirectory($tempDir);
                    }
                } catch (\Exception $e) {
                    \Log::warning("Failed to clean temp directory: " . $e->getMessage());
                }
            }

            $heldCount = 0;
            if ($priorityLevel > 0) {
                try {
                    $bookingsForConflict = array_map(fn($booking) => [
                        'facility_id' => $booking['facility_id'],
                        'date'        => $booking['date'],
                        'time_start'  => $booking['time_start'],
                        'time_end'    => $booking['time_end'],
                    ], $validated['facility_bookings']);

                    $requestService      = app(\App\Services\RequestService::class);
                    $notificationService = app(\App\Services\NotificationService::class);
                    $conflicting         = $requestService->findConflictingLowerPriorityRequests($bookingsForConflict, $priorityLevel);
                    $holdReason          = $priorityReason ?? 'Higher-priority event submitted for the same time slot.';

                    foreach ($conflicting as $conflictingRequest) {
                        $requestService->putOnHold($conflictingRequest, $facilityRequest, $holdReason);
                        $notificationService->notifyOnHold($conflictingRequest, $facilityRequest, $holdReason);
                        $heldCount++;
                        \Log::info("AI: Request #{$conflictingRequest->id} put on hold by high-priority request #{$facilityRequest->id}");
                    }
                } catch (\Exception $e) {
                    \Log::warning('AI createRequestApi: priority override failed: ' . $e->getMessage());
                }
            }

            $this->clearSession();

            return response()->json([
                'success'        => true,
                'message'        => 'Request created successfully' . ($heldCount > 0 ? " ({$heldCount} conflicting request(s) put on hold)" : ''),
                'request_id'     => $facilityRequest->id,
                'priority_level' => $priorityLevel,
                'held_count'     => $heldCount,
                'files_attached' => $fileCount,
            ]);

        } catch (\Illuminate\Validation\ValidationException $e) {
            \Log::warning('Validation error in createRequestApi: ' . json_encode($e->errors()));
            return response()->json(['error' => 'Validation failed', 'errors' => $e->errors()], 422);
        } catch (\Exception $e) {
            \Log::error('Request creation error: ' . $e->getMessage());
            return response()->json([
                'error'   => 'Failed to create request',
                'message' => config('app.debug') ? $e->getMessage() : 'An error occurred',
            ], 500);
        }
    }
}