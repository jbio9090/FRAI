<x-mail::message>
# AI Recommendation Ready

A facility request is ready for admin review.

**Event title:** {{ $requestModel->title }}

**Requester:** {{ $requestModel->user?->name ?? 'Unknown requester' }} ({{ $requestModel->user?->email ?? 'No email' }})

**Attached file:** {{ $hasFiles ? 'Yes' : 'No' }}

## Booked facilities

@forelse ($requestModel->requestFacilities as $booking)
- **{{ $booking->facility?->name ?? 'Unknown facility' }}** — {{ \Illuminate\Support\Carbon::parse($booking->date_requested)->format('F j, Y') }}, {{ \Illuminate\Support\Carbon::parse($booking->time_start)->format('g:i A') }} - {{ \Illuminate\Support\Carbon::parse($booking->time_end)->format('g:i A') }}
@empty
No facility bookings were found for this request.
@endforelse

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
