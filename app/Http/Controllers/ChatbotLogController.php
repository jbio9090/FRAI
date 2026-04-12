<?php

namespace App\Http\Controllers;

use App\Models\ChatbotInteractionLog;
use App\Models\User;
use Illuminate\Http\Request;
use Inertia\Inertia;

class ChatbotLogController extends Controller
{
    public function index(Request $request)
    {
        $filters = [
            'user' => $request->string('user')->toString(),
            'status' => $request->string('status')->toString(),
            'intent' => $request->string('intent')->toString(),
            'date' => $request->string('date')->toString(),
            'search' => $request->string('search')->toString(),
        ];

        $logs = ChatbotInteractionLog::query()
            ->with(['user:id,name,email', 'facilityRequest:id,title'])
            ->when($filters['user'] !== '', fn($query) => $query->where('user_id', $filters['user']))
            ->when($filters['status'] !== '', fn($query) => $query->where('status', $filters['status']))
            ->when($filters['intent'] !== '', fn($query) => $query->where(function ($subQuery) use ($filters) {
                $subQuery->where('intent', $filters['intent'])
                    ->orWhere('interaction_type', $filters['intent']);
            }))
            ->when($filters['date'] !== '', fn($query) => $query->whereDate('created_at', $filters['date']))
            ->when($filters['search'] !== '', function ($query) use ($filters) {
                $search = $filters['search'];
                $query->where(function ($subQuery) use ($search) {
                    $subQuery->where('user_message', 'like', "%{$search}%")
                        ->orWhere('assistant_message', 'like', "%{$search}%")
                        ->orWhereHas('user', fn($userQuery) => $userQuery->where('name', 'like', "%{$search}%"));
                });
            })
            ->latest()
            ->paginate(20)
            ->withQueryString();

        $statusOptions = ChatbotInteractionLog::query()
            ->select('status')
            ->distinct()
            ->orderBy('status')
            ->pluck('status')
            ->values();

        $intentOptions = ChatbotInteractionLog::query()
            ->select('intent', 'interaction_type')
            ->get()
            ->flatMap(fn($log) => array_filter([$log->intent, $log->interaction_type]))
            ->unique()
            ->sort()
            ->values();

        return Inertia::render('chatbot/logs/index', [
            'logs' => $logs,
            'filters' => $filters,
            'users' => User::query()->select('id', 'name')->orderBy('name')->get(),
            'statusOptions' => $statusOptions,
            'intentOptions' => $intentOptions,
        ]);
    }
}
