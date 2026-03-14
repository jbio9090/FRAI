<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use App\Models\Request as RequestModel;
use App\Models\Rule as RuleModel;
use App\Models\Facility;
use App\Models\Equipment;
use App\RequestStatus;
use GuzzleHttp\Client;
use GuzzleHttp\Exception\RequestException;

class ChatController extends Controller
{
    private string $ollamaUrl;
    private string $model;

    public function __construct()
    {
        $this->ollamaUrl  = config("ollama-laravel.url");
        $this->model = config("ollama-laravel.model", "FRAI");
    }
    /**
     * Filter facilities by participant count
     */
    private function filterFacilitiesByCapacity($facilities, $participants)
    {
        return $facilities->filter(function ($facility) use ($participants) {
            return $participants <= $facility->capacity
                && $participants >= ($facility->capacity * 0.5);
        });
    }

    /**
     * Handle chat messages - simple non-streaming version
     */
    public function chat(Request $request): JsonResponse
    {
        try {
            set_time_limit(300); // 5 minutes
            $messages = $request->input('messages', []);
            $participantCount = $request->input('participant_count'); // Optional: for capacity-based filtering

            // Always inject current requests from DB as context (for priority override awareness)
            try {
                $allRequests = RequestModel::with(['user', 'requestFacilities', 'facilities'])
                    ->whereIn('status', ['pending', 'approved'])
                    ->latest()
                    ->limit(30)
                    ->get();

                $lines = $allRequests->map(function ($r) {
                    $facilities = $r->requestFacilities->map(function ($rf) use ($r) {
                        $facilityName = $r->facilities->firstWhere('id', $rf->facility_id)?->name ?? 'Unknown';
                        return sprintf(
                            "%s on %s (%s - %s)",
                            $facilityName,
                            $rf->date_requested,
                            $rf->time_start,
                            $rf->time_end
                        );
                    })->implode('; ');

                    $priorityLabel = match ((int) $r->priority_level) {
                        1 => 'School Event',
                        2 => 'Government/High Authority',
                        default => 'Normal',
                    };

                    $holdInfo = $r->on_hold ? ' [ON HOLD]' : '';

                    return sprintf(
                        "Request #%s \"%s\" — Status: %s%s — Priority: %s — By: %s — Facilities: %s",
                        $r->id,
                        $r->title,
                        $r->status->value,
                        $holdInfo,
                        $priorityLabel,
                        $r->user?->name ?? 'Unknown',
                        $facilities ?: 'N/A'
                    );
                })->toArray();

                $requestsSummary = "CURRENT FACILITY REQUESTS (pending & approved):\n- " . implode("\n- ", $lines);

                array_unshift($messages, [
                    'role' => 'system',
                    'content' => $requestsSummary,
                ]);
            } catch (\Exception $e) {
                \Log::warning('Failed to fetch requests for chat: ' . $e->getMessage());
            }

            // Always include facilities and equipment as context, plus request creation guidance
            try {
                // Fetch all facilities first
                $allFacilities = Facility::orderBy('id', 'asc')
                    ->limit(50)
                    ->get(['id', 'name', 'building', 'capacity']);

                // Filter by participant count if provided
                $facilitiesToDisplay = $allFacilities;
                $filterApplied = false;
                if ($participantCount && is_numeric($participantCount) && $participantCount > 0) {
                    $participantCount = (int) $participantCount;
                    $facilitiesToDisplay = $this->filterFacilitiesByCapacity($allFacilities, $participantCount);
                    $filterApplied = true;
                }

                // Format facilities for display
                $facilities = $facilitiesToDisplay->map(function ($f) {
                    return "ID {$f->id}: {$f->name} (Building: {$f->building}, Capacity: {$f->capacity})";
                })->toArray();

                if (!empty($facilities)) {
                    $facilititiesSummary = "Available Facilities" . ($filterApplied ? " (filtered for {$participantCount} participants)" : "") . ":\n- " . implode("\n- ", $facilities);
                    array_unshift($messages, [
                        'role' => 'system',
                        'content' => $facilititiesSummary,
                    ]);
                } elseif ($filterApplied) {
                    // No facilities match the capacity filter
                    array_unshift($messages, [
                        'role' => 'system',
                        'content' => "No facilities available with capacity suitable for {$participantCount} participants. The recommended capacity range is " . floor($participantCount * 2) . " or less, with at least 50% utilization. Please consider a different date, different participant count, or combination of multiple facilities.",
                    ]);
                }

                // Fetch equipment
                $equipment = Equipment::orderBy('id', 'asc')
                    ->limit(50)
                    ->get(['id', 'name', 'quantity', 'facility_id'])
                    ->map(function ($e) {
                        $facilityName = $e->facility->name ?? 'Unknown';
                        return "ID {$e->id}: {$e->name} (Facility: {$facilityName}, Available: {$e->quantity})";
                    })->toArray();

                if (!empty($equipment)) {
                    $equipmentSummary = "Available Equipment:\n- " . implode("\n- ", $equipment);
                    array_unshift($messages, [
                        'role' => 'system',
                        'content' => $equipmentSummary,
                    ]);
                }

                // Add facility matching guidance
                $facilityGuidance = "FACILITY CAPACITY MATCHING:\nWhen the user mentions the number of participants or people they plan to host, ask for this information early if not provided. After learning the participant count, the system will automatically filter and show ONLY suitable facilities. Facilities are recommended based on:\n- Minimum: At least 50% capacity utilization (to avoid empty rooms)\n- Maximum: Can accommodate all participants\nFor example, for 40 participants, recommend rooms with capacity 40-80. Always present the filtered results and explain why those facilities are recommended.";
                array_unshift($messages, [
                    'role' => 'system',
                    'content' => $facilityGuidance,
                ]);

                // Add guidance for request creation with priority support
                $requestGuidance = "IMPORTANT REQUEST CREATION CAPABILITY:\nYou can create facility requests for the user. When they ask to create a request, collect the following information:\n1. Title (brief request name)\n2. Description (detailed explanation)\n3. Facility ID (from the available facilities list above)\n4. Equipment (optional list of equipment IDs and quantities needed, from the available equipment list above)\n5. Date (YYYY-MM-DD format)\n6. Start Time (HH:MM format in 24-hour)\n7. End Time (HH:MM format in 24-hour)\n8. Priority Level (IMPORTANT - determine from context):\n   - 0 = Normal (default, regular events)\n   - 1 = School Event (department heads, school-wide events, official school activities)\n   - 2 = Government / High Authority (government officials, external government events, high-authority visits)\n9. Priority Reason (brief explanation if priority > 0)\n\nPRIORITY OVERRIDE SYSTEM: If the user's event is a school event (priority 1) or government/high-authority event (priority 2), and there are existing requests at the same time with lower priority, the system will AUTOMATICALLY put those lower-priority requests on hold. You must detect the priority from the user's description — look for keywords like 'government', 'official', 'mayor', 'senator', 'department head', 'school event', 'university event', 'board meeting', 'accreditation', etc.\n\nAfter collecting all required information, construct the JSON payload exactly as shown below and present it to the user for confirmation:\n{\"title\": \"...\", \"description\": \"...\", \"priority_level\": 0, \"priority_reason\": \"...\", \"facility_bookings\": [{\"facility_id\": ID, \"date\": \"YYYY-MM-DD\", \"time_start\": \"HH:MM\", \"time_end\": \"HH:MM\", \"equipment\": [{\"equipment_id\": ID, \"quantity_needed\": number}]}]}\n\nWait for the user to confirm 'yes' or 'proceed' before submitting the JSON. Once confirmed, output ONLY the JSON payload (no additional text) to trigger automatic submission to the database.";
                array_unshift($messages, [
                    'role' => 'system',
                    'content' => $requestGuidance,
                ]);
            } catch (\Exception $e) {
                \Log::warning('Failed to fetch facilities/equipment for chat: ' . $e->getMessage());
            }

            // Always include rules from DB as mandatory system context (cannot be disabled)
            $rules = [];
            try {
                $limitRules = (int) $request->input('rules_limit', 50);
                $limitRules = max(1, min(200, $limitRules));

                $rules = RuleModel::orderBy('id', 'asc')
                    ->limit($limitRules)
                    ->get(['id', 'rule'])
                    ->map(function ($r) {
                        return trim($r->rule);
                    })->filter()->toArray();

                // Strong binding instruction + rules list (always applied)
                $rulesListText = !empty($rules) ? implode("\n- ", $rules) : '';
                $rulesSummary = "You MUST follow the following rules exactly. If a user request would violate any rule, you MUST refuse and reply with a short explanation stating which rule would be violated. Do NOT provide prohibited content.";
                if (!empty($rulesListText)) {
                    $rulesSummary .= "\nRules:\n- " . $rulesListText;
                } else {
                    $rulesSummary .= "\n(There are currently no configured rules.)";
                }

                array_unshift($messages, [
                    'role' => 'system',
                    'content' => $rulesSummary,
                ]);
            } catch (\Exception $e) {
                \Log::warning('Failed to fetch Rules for chat: ' . $e->getMessage());
                // If rules fetch fails, still add a strict instruction to refuse if rules are present
                array_unshift($messages, [
                    'role' => 'system',
                    'content' => "You MUST follow rules stored in the system database. If a user request would violate any configured rule, you MUST refuse and explain which rule would be violated. Do NOT provide prohibited content."
                ]);
            }

            if (empty($messages)) {
                return response()->json([
                    'error' => 'No messages provided'
                ], 400);
            }

            $client = new Client(['timeout' => 1200]);

            $response = $client->post($this->ollamaUrl . '/api/chat', [
                'json' => [
                    'model' => $this->model,
                    'messages' => $messages,
                    'stream' => false,
                ],
            ]);

            $data = json_decode($response->getBody(), true);

            // Validate the assistant's reply against rules using a validator prompt (rules enforced always)
            if (!empty($rules)) {
                try {
                    // Extract assistant output text
                    $assistantText = '';
                    if (is_array($data) && isset($data['message']['content'])) {
                        $assistantText = $data['message']['content'];
                    } elseif (is_array($data) && isset($data['response'])) {
                        $assistantText = $data['response'];
                    } elseif (is_string($data)) {
                        $assistantText = $data;
                    }

                    $validatorMessages = [
                        [
                            'role' => 'system',
                            'content' => "You are a careful rules validator. Analyze if the assistant response CLEARLY AND DIRECTLY VIOLATES any hard constraints in the rules. Important distinctions:\n\n- VIOLATIONS (hard constraints): Explicit prohibitions like 'do not mention X', 'never do Y', 'forbidden topic', 'cannot discuss Z'\n- NOT VIOLATIONS (soft guidelines): Style preferences like 'be brief', 'be concise', 'use simple language', 'be friendly' - these are aspirational, not absolute prohibitions\n\nOnly flag something as a violation if it DIRECTLY contradicts a strict prohibition. Stylistic guidelines or tone suggestions should NOT be flagged. Return ONLY valid JSON with key \"violations\" (array of rule indices, 0-based). Example: {\"violations\": [0,2]} or {\"violations\": []}. No extra text."
                        ],
                        [
                            'role' => 'user',
                            'content' => "Rules:\n- " . implode("\n- ", $rules) . "\n\nAssistant Response:\n" . $assistantText
                        ]
                    ];

                    try {
                        $validatorResp = $client->post($this->ollamaUrl . '/api/chat', [
                            'json' => [
                                'model' => $this->model,
                                'messages' => $validatorMessages,
                                'stream' => false,
                            ],
                        ]);

                        // Check if the response is successful
                        if (!$validatorResp->getStatusCode() || $validatorResp->getStatusCode() >= 400) {
                            \Log::warning('Validator API returned error status: ' . $validatorResp->getStatusCode());
                            // Skip validation if validator fails
                            return response()->json($data);
                        }

                        $validatorData = json_decode($validatorResp->getBody(), true);
                        $jsonText = '';
                        if (is_array($validatorData) && isset($validatorData['message']['content'])) {
                            $jsonText = $validatorData['message']['content'];
                        } elseif (is_array($validatorData) && isset($validatorData['response'])) {
                            $jsonText = $validatorData['response'];
                        } else {
                            $jsonText = is_string($validatorData) ? $validatorData : '';
                        }

                        $parsed = @json_decode($jsonText, true);
                        if (is_array($parsed) && isset($parsed['violations']) && is_array($parsed['violations']) && !empty($parsed['violations'])) {
                            // Build detailed violation message with rule indices and text
                            $violationDetails = [];
                            foreach ($parsed['violations'] as $ruleIndex) {
                                if (isset($rules[$ruleIndex])) {
                                    $violationDetails[] = "Rule #" . ($ruleIndex + 1) . ": " . $rules[$ruleIndex];
                                }
                            }

                            $violationMessage = "I cannot comply with that request because it would violate the following rules:\n\n" . implode("\n\n", $violationDetails);

                            // Replace assistant response with refusal message
                            $data = [
                                'message' => [
                                    'content' => $violationMessage,
                                    'role' => 'assistant',
                                ]
                            ];
                        }
                    } catch (RequestException $ve) {
                        // Validator API call failed
                        \Log::warning('Validator API request failed: ' . $ve->getMessage());
                        // Skip validation and return original response
                        return response()->json($data);
                    }
                } catch (\Exception $e) {
                    \Log::warning('Rule validation failed: ' . $e->getMessage());
                    // If validation fails, keep original response
                }
            }

            return response()->json($data);
        } catch (RequestException $e) {
            \Log::error('Chat error: ' . $e->getMessage());

            return response()->json([
                'error' => 'Failed to connect to Ollama',
                'message' => config('app.debug') ? $e->getMessage() : 'An error occurred'
            ], 500);
        } catch (\Exception $e) {
            \Log::error('Chat error: ' . $e->getMessage());

            return response()->json([
                'error' => 'Failed to process chat request',
                'message' => config('app.debug') ? $e->getMessage() : 'An error occurred'
            ], 500);
        }
    }

    /**
     * Test endpoint to verify connection to Ollama
     */
    public function testCsrf(): JsonResponse
    {
        try {
            $client = new Client(['timeout' => 10]);

            $response = $client->get($this->ollamaUrl . '/api/tags');
            $data = json_decode($response->getBody(), true);

            return response()->json([
                'message' => 'Connected to Ollama',
                'models' => $data['models'] ?? [],
                'timestamp' => now(),
            ]);
        } catch (\Exception $e) {
            \Log::error('Ollama connection test failed: ' . $e->getMessage());

            return response()->json([
                'error' => 'Cannot connect to Ollama at ' . $this->ollamaUrl,
                'message' => config('app.debug') ? $e->getMessage() : 'Connection failed'
            ], 500);
        }
    }

    /**
     * Get available models from Ollama
     */
    public function models(): JsonResponse
    {
        try {
            $client = new Client(['timeout' => 10]);

            $response = $client->get($this->ollamaUrl . '/api/tags');
            $data = json_decode($response->getBody(), true);

            return response()->json([
                'models' => $data['models'] ?? []
            ]);
        } catch (\Exception $e) {
            \Log::error('Models fetch error: ' . $e->getMessage());

            return response()->json([
                'error' => 'Failed to fetch models',
                'message' => config('app.debug') ? $e->getMessage() : 'An error occurred'
            ], 500);
        }
    }

    /**
     * Return a small, sanitized list of recent requests from the database.
     */
    public function latestRequests(Request $request): JsonResponse
    {
        try {
            $limit = (int) $request->input('limit', 5);
            $limit = max(1, min(20, $limit));

            $rows = RequestModel::orderBy('created_at', 'desc')
                ->limit($limit)
                ->get(['id', 'user_id', 'facility_id', 'status', 'created_at'])
                ->map(function ($r) {
                    return [
                        'id' => $r->id,
                        'user_id' => $r->user_id,
                        'facility' => $r->facility->name ?? $r->facility_id ?? null,
                        'status' => $r->status,
                        'created_at' => $r->created_at->toDateTimeString(),
                    ];
                });

            return response()->json(['data' => $rows]);
        } catch (\Exception $e) {
            \Log::error('Latest requests error: ' . $e->getMessage());
            return response()->json([
                'error' => 'Failed to fetch latest requests',
                'message' => config('app.debug') ? $e->getMessage() : 'An error occurred'
            ], 500);
        }
    }

    /**
     * Return sanitized list of rules from the database.
     */
    public function rulesList(Request $request): JsonResponse
    {
        try {
            $limit = (int) $request->input('limit', 50);
            $limit = max(1, min(200, $limit));

            $rows = RuleModel::orderBy('id', 'asc')
                ->limit($limit)
                ->get(['id', 'rule'])
                ->map(function ($r) {
                    return [
                        'id' => $r->id,
                        'rule' => trim($r->rule),
                    ];
                });

            return response()->json(['data' => $rows]);
        } catch (\Exception $e) {
            \Log::error('Rules list error: ' . $e->getMessage());
            return response()->json([
                'error' => 'Failed to fetch rules',
                'message' => config('app.debug') ? $e->getMessage() : 'An error occurred'
            ], 500);
        }
    }

    /**
     * Return sanitized list of facilities from the database.
     */
    public function facilitiesList(Request $request): JsonResponse
    {
        try {
            $limit = (int) $request->input('limit', 50);
            $limit = max(1, min(200, $limit));

            $rows = Facility::orderBy('id', 'asc')
                ->limit($limit)
                ->get(['id', 'name', 'building', 'capacity'])
                ->map(function ($f) {
                    return [
                        'id' => $f->id,
                        'name' => $f->name,
                        'building' => $f->building,
                        'capacity' => $f->capacity,
                    ];
                });

            return response()->json(['data' => $rows]);
        } catch (\Exception $e) {
            \Log::error('Facilities list error: ' . $e->getMessage());
            return response()->json([
                'error' => 'Failed to fetch facilities',
                'message' => config('app.debug') ? $e->getMessage() : 'An error occurred'
            ], 500);
        }
    }

    /**
     * Return sanitized list of equipment from the database.
     */
    public function equipmentList(Request $request): JsonResponse
    {
        try {
            $limit = (int) $request->input('limit', 50);
            $limit = max(1, min(200, $limit));

            $rows = Equipment::orderBy('id', 'asc')
                ->limit($limit)
                ->get(['id', 'name', 'quantity', 'facility_id'])
                ->map(function ($e) {
                    return [
                        'id' => $e->id,
                        'name' => $e->name,
                        'quantity' => $e->quantity,
                        'facility' => $e->facility->name ?? $e->facility_id ?? null,
                    ];
                });

            return response()->json(['data' => $rows]);
        } catch (\Exception $e) {
            \Log::error('Equipment list error: ' . $e->getMessage());
            return response()->json([
                'error' => 'Failed to fetch equipment',
                'message' => config('app.debug') ? $e->getMessage() : 'An error occurred'
            ], 500);
        }
    }

    /**
     * Create a facility request from AI
     * Expected payload: { title, description, priority_level, priority_reason, facility_bookings: [{ facility_id, date, time_start, time_end, equipment: [{equipment_id, quantity_needed}] }] }
     * Priority levels: 0 = Normal, 1 = School Event, 2 = Government/High Authority
     * High-priority requests (>0) will automatically put conflicting lower-priority requests on hold.
     */
    public function createRequestApi(Request $request): JsonResponse
    {
        try {
            $validated = $request->validate([
                'title'                                           => 'required|string|max:255',
                'description'                                     => 'nullable|string',
                'priority_level'                                  => 'nullable|integer|in:0,1,2',
                'priority_reason'                                 => 'nullable|string|max:512',
                'facility_bookings'                               => 'required|array|min:1',
                'facility_bookings.*.facility_id'                 => 'required|exists:facilities,id',
                'facility_bookings.*.date'                        => 'required|date',
                'facility_bookings.*.time_start'                  => 'required',
                'facility_bookings.*.time_end'                    => 'required',
                'facility_bookings.*.equipment'                   => 'array',
                'facility_bookings.*.equipment.*.equipment_id'    => 'required|exists:equipments,id',
                'facility_bookings.*.equipment.*.quantity_needed' => 'required|integer|min:1',
            ]);

            $priorityLevel  = (int) ($validated['priority_level'] ?? 0);
            $priorityReason = $validated['priority_reason'] ?? null;

            // Create the request
            $facilityRequest = RequestModel::create([
                'user_id'         => Auth::id(),
                'title'           => $validated['title'],
                'description'     => $validated['description'] ?? null,
                'status'          => RequestStatus::PENDING,
                'priority_level'  => $priorityLevel,
                'priority_reason' => $priorityReason,
            ]);

            // Add facility bookings
            foreach ($validated['facility_bookings'] as $booking) {
                $dateOnly = \Illuminate\Support\Carbon::parse($booking['date'])->format('Y-m-d');

                $facilityRequest->requestFacilities()->create([
                    'facility_id'    => $booking['facility_id'],
                    'date_requested' => $dateOnly,
                    'time_start'     => $booking['time_start'],
                    'time_end'       => $booking['time_end'],
                ]);

                // Add equipment if any
                if (!empty($booking['equipment'])) {
                    foreach ($booking['equipment'] as $equipment) {
                        $facilityRequest->equipment()->attach($equipment['equipment_id'], [
                            'quantity_needed' => $equipment['quantity_needed']
                        ]);
                    }
                }
            }

            // If high-priority, find and put conflicting lower-priority requests on hold
            $heldCount = 0;
            if ($priorityLevel > 0) {
                try {
                    // Rebuild bookings array in the format RequestService expects
                    $bookingsForConflict = array_map(function ($booking) {
                        return [
                            'facility_id' => $booking['facility_id'],
                            'date'        => $booking['date'],
                            'time_start'  => $booking['time_start'],
                            'time_end'    => $booking['time_end'],
                        ];
                    }, $validated['facility_bookings']);

                    $requestService = app(\App\Services\RequestService::class);
                    $notificationService = app(\App\Services\NotificationService::class);

                    $conflicting = $requestService->findConflictingLowerPriorityRequests(
                        $bookingsForConflict,
                        $priorityLevel
                    );

                    $holdReason = $priorityReason
                        ?? 'Higher-priority event submitted for the same time slot.';

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

            return response()->json([
                'success'       => true,
                'message'       => 'Request created successfully' . ($heldCount > 0 ? " ({$heldCount} conflicting request(s) put on hold)" : ''),
                'request_id'    => $facilityRequest->id,
                'priority_level' => $priorityLevel,
                'held_count'    => $heldCount,
            ]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            \Log::warning('Validation error in createRequestApi: ' . json_encode($e->errors()));
            return response()->json([
                'error'  => 'Validation failed',
                'errors' => $e->errors(),
            ], 422);
        } catch (\Exception $e) {
            \Log::error('Request creation error: ' . $e->getMessage());
            return response()->json([
                'error'   => 'Failed to create request',
                'message' => config('app.debug') ? $e->getMessage() : 'An error occurred'
            ], 500);
        }
    }
}
