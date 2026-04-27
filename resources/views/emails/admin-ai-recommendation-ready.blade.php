<x-mail::message>
# AI Recommendation Ready

A facility request is ready for admin review.

**Event title:** {{ $requestModel->title }}

**Requester:** {{ $requestModel->user?->name ?? 'Unknown requester' }} ({{ $requestModel->user?->email ?? 'No email' }})

**Attached file:** {{ $hasFiles ? 'Yes' : 'No' }}

**AI recommended action:** {{ $requestModel->recommended_action instanceof \BackedEnum ? $requestModel->recommended_action->value : $requestModel->recommended_action }}

**AI reason:** {{ $requestModel->recommended_action_reason ?? 'No reason provided.' }}

<x-mail::button :url="$approveUrl" color="success">
Approve
</x-mail::button>

<x-mail::button :url="$rescheduleUrl" color="error">
For reschedule
</x-mail::button>

<x-mail::button :url="$detailUrl">
Visit website
</x-mail::button>

Thanks,<br>
{{ config('app.name') }}
</x-mail::message>
