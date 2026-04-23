<?php

namespace App\Services;

use App\Models\ChatbotInteractionLog;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class ChatbotLogService
{
    public function logAssistantReply(
        ?string $userMessage,
        ?string $assistantMessage,
        array $context = [],
        ?string $sessionId = null,
        ?string $interactionType = null,
        ?string $intent = null,
    ): ChatbotInteractionLog {
        return $this->create([
            'session_id' => $sessionId,
            'interaction_type' => $interactionType ?? $this->inferInteractionType($userMessage, $context),
            'intent' => $intent ?? $this->inferIntent($userMessage, $context),
            'user_message' => $userMessage,
            'assistant_message' => $assistantMessage,
            'context_data' => $this->compactContext($context),
            'status' => 'answered',
        ]);
    }

    public function logPayloadGenerated(
        ?string $userMessage,
        ?string $assistantMessage,
        array $payload,
        array $context = [],
        ?string $sessionId = null,
    ): ChatbotInteractionLog {
        return $this->create([
            'session_id' => $sessionId,
            'interaction_type' => 'request_creation',
            'intent' => 'request_creation',
            'user_message' => $userMessage,
            'assistant_message' => $assistantMessage,
            'context_data' => $this->compactContext($context),
            'generated_payload' => $payload,
            'status' => 'payload_generated',
        ]);
    }

    public function logSubmissionResult(
        array $payload,
        array $validationResult,
        array $context = [],
        ?string $sessionId = null,
        ?int $facilityRequestId = null,
    ): ChatbotInteractionLog {
        return $this->create([
            'session_id' => $sessionId,
            'interaction_type' => 'submission_validation',
            'intent' => 'submission_validation',
            'user_message' => Arr::get($context, 'user_message'),
            'assistant_message' => Arr::get($context, 'assistant_message'),
            'context_data' => $this->compactContext($context),
            'generated_payload' => $payload,
            'validation_result' => $validationResult,
            'facility_request_id' => $facilityRequestId,
            'status' => 'submitted',
        ]);
    }

    public function logValidationFailure(
        array $payload,
        array $validationResult,
        array $context = [],
        ?string $sessionId = null,
    ): ChatbotInteractionLog {
        return $this->create([
            'session_id' => $sessionId,
            'interaction_type' => 'submission_validation',
            'intent' => 'submission_validation',
            'user_message' => Arr::get($context, 'user_message'),
            'assistant_message' => Arr::get($context, 'assistant_message'),
            'context_data' => $this->compactContext($context),
            'generated_payload' => $payload,
            'validation_result' => $validationResult,
            'status' => 'validation_failed',
        ]);
    }

    public function logError(
        ?string $userMessage,
        string $errorMessage,
        array $context = [],
        ?string $sessionId = null,
        ?string $interactionType = null,
        ?string $intent = null,
        ?array $payload = null,
        ?array $validationResult = null,
    ): ChatbotInteractionLog {
        $context['error_message'] = $errorMessage;

        return $this->create([
            'session_id' => $sessionId,
            'interaction_type' => $interactionType ?? $this->inferInteractionType($userMessage, $context),
            'intent' => $intent ?? $this->inferIntent($userMessage, $context),
            'user_message' => $userMessage,
            'assistant_message' => Arr::get($context, 'assistant_message'),
            'context_data' => $this->compactContext($context),
            'generated_payload' => $payload,
            'validation_result' => $validationResult,
            'status' => 'error',
        ]);
    }

    public function inferInteractionType(?string $userMessage, array $context = []): string
    {
        if (!empty($context['faq_match_rule_id']) || !empty($context['faq_mode'])) {
            return 'faq_answer';
        }

        if (!empty($context['generated_payload']) || !empty($context['request_creation'])) {
            return 'request_creation';
        }

        if (!empty($context['booking_context'])) {
            return 'booking_assistance';
        }

        $message = Str::lower((string) $userMessage);

        if ($message === '') {
            return 'general_chat';
        }

        if (Str::contains($message, ['recommend', 'suggest', 'what room', 'which facility', 'which room'])) {
            return 'facility_recommendation';
        }

        if (Str::contains($message, ['available', 'availability', 'free on', 'vacant'])) {
            return 'availability_check';
        }

        if (Str::contains($message, ['rule', 'guideline', 'policy', 'allowed', 'prohibited'])) {
            return 'rules_inquiry';
        }

        if (Str::contains($message, ['faq', 'frequently asked', 'common question'])) {
            return 'faq_answer';
        }

        if (Str::contains($message, ['book', 'booking', 'reserve', 'reservation', 'create request', 'submit request'])) {
            return 'booking_assistance';
        }

        return 'general_chat';
    }

    public function inferIntent(?string $userMessage, array $context = []): string
    {
        return $context['intent'] ?? $this->inferInteractionType($userMessage, $context);
    }

    private function create(array $attributes): ChatbotInteractionLog
    {
        $payload = [
            'user_id' => Auth::id(),
            ...$attributes,
        ];

        try {
            return ChatbotInteractionLog::create($payload);
        } catch (\Throwable $exception) {
            Log::warning('Failed to write chatbot interaction log: ' . $exception->getMessage());

            return new ChatbotInteractionLog($payload);
        }
    }

    private function compactContext(array $context): ?array
    {
        $normalized = [
            'participant_count' => Arr::get($context, 'participant_count'),
            'booking_context' => Arr::get($context, 'booking_context'),
            'selected_facility' => Arr::get($context, 'selected_facility'),
            'selected_date' => Arr::get($context, 'selected_date'),
            'selected_time_start' => Arr::get($context, 'selected_time_start'),
            'selected_time_end' => Arr::get($context, 'selected_time_end'),
            'rules_injected' => Arr::get($context, 'rules_injected'),
            'approved_booking_context_injected' => Arr::get($context, 'approved_booking_context_injected'),
            'deterministic_availability_injected' => Arr::get($context, 'deterministic_availability_injected'),
            'facility_filter_applied' => Arr::get($context, 'facility_filter_applied'),
            'facility_count_loaded' => Arr::get($context, 'facility_count_loaded'),
            'equipment_count_loaded' => Arr::get($context, 'equipment_count_loaded'),
            'request_count_loaded' => Arr::get($context, 'request_count_loaded'),
            'approved_request_count' => Arr::get($context, 'approved_request_count'),
            'response_source' => Arr::get($context, 'response_source'),
            'routing_source' => Arr::get($context, 'routing_source'),
            'fallback_counter' => Arr::get($context, 'fallback_counter'),
            'held_count' => Arr::get($context, 'held_count'),
            'files_attached' => Arr::get($context, 'files_attached'),
            'request_id' => Arr::get($context, 'request_id'),
            'error_message' => Arr::get($context, 'error_message'),
            'faq_mode' => Arr::get($context, 'faq_mode'),
            'faq_match_rule_id' => Arr::get($context, 'faq_match_rule_id'),
            'faq_match_question' => Arr::get($context, 'faq_match_question'),
            'faq_match_similarity' => Arr::get($context, 'faq_match_similarity'),
            'faq_match_type' => Arr::get($context, 'faq_match_type'),
            'faq_paraphrased' => Arr::get($context, 'faq_paraphrased'),
            'faq_no_match' => Arr::get($context, 'faq_no_match'),
            'faq_near_match_question' => Arr::get($context, 'faq_near_match_question'),
            'faq_near_match_similarity' => Arr::get($context, 'faq_near_match_similarity'),
            'faq_near_match_type' => Arr::get($context, 'faq_near_match_type'),
            'faq_near_match_confirmed' => Arr::get($context, 'faq_near_match_confirmed'),
            'faq_near_match_confirmation_source' => Arr::get($context, 'faq_near_match_confirmation_source'),
            'faq_near_match_confirmation_intent' => Arr::get($context, 'faq_near_match_confirmation_intent'),
        ];

        if (Arr::has($context, 'validation_passed')) {
            $normalized['validation_passed'] = Arr::get($context, 'validation_passed');
        }

        if (Arr::has($context, 'rules_loaded')) {
            $normalized['rules_loaded'] = Arr::get($context, 'rules_loaded');
        }

        return array_filter($normalized, static fn($value) => $value !== null && $value !== '' && $value !== []);
    }
}
