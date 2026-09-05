<x-mail::message>
    <x-mail::heading>
        Reschedule Options for: {{ $requestTitle }}
    </x-mail::heading>

    <x-mail::panel>
        An admin has selected reschedule options for your request. Please review the suggested alternatives below and choose one when you edit your request.
    </x-mail::panel>

    @foreach ($alternatives as $facilityGroup)
        <x-mail::panel>
            <strong>{{ $facilityGroup['facility_name'] }}</strong>
            <br><br>
            @foreach ($facilityGroup['options'] as $option)
                <div style="margin-bottom: 12px; padding: 12px; background-color: #f9fafb; border-radius: 6px;">
                    <strong>{{ \Carbon\Carbon::parse($option['date'])->format('F j, Y') }}</strong>
                    &nbsp;|&nbsp;
                    {{ \Carbon\Carbon::parse($option['time_start'])->format('g:i A') }} - {{ \Carbon\Carbon::parse($option['time_end'])->format('g:i A') }}
                    <br>
                    <small style="color: #6b7280;">
                        {{ ucfirst(str_replace('_', ' ', $option['type'])) }}
                        &bull; Capacity: {{ $option['capacity_fit'] }}
                        &bull; Equipment: {{ $option['equipment_available'] ? 'Available' : 'Not Available' }}
                        &bull; Suggested by: {{ $option['chosen_by'] }}
                    </small>
                </div>
            @endforeach
        </x-mail::panel>
    @endforeach

    <x-mail::button :url="$url" color="primary">
        View Request & Select Option
    </x-mail::button>

    <x-mail::subcopy>
        You can also view these options in the app by going to the request detail page and selecting the "Suggested Reschedule Options" tab.
    </x-mail::subcopy>
</x-mail::message>