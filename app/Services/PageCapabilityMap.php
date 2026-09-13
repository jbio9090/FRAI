<?php

namespace App\Services;

class PageCapabilityMap
{
    public static function forRoute(string $routeName): array
    {
        return match ($routeName) {
            'dashboard' => [
                'has_requests' => true,
                'requests_scope' => 'partial - only recent/flagged requests shown, not the full list',
                'has_facilities' => false,
                'has_equipment' => false,
                'redirect_for_full_requests' => 'requests.index',
            ],
            'requests.index' => [
                'has_requests' => true,
                'requests_scope' => 'full list with filters',
            ],
            'requests.detail' => [
                'has_requests' => true,
                'requests_scope' => 'single request, full detail',
            ],
            'facilities' => [
                'has_facilities' => true,
                'facilities_scope' => 'full directory',
            ],
            'facility.detail' => [
                'has_facilities' => true,
                'facilities_scope' => 'single facility detail',
            ],
            'equipments' => [
                'has_equipment' => true,
                'equipment_scope' => 'full directory',
            ],
            'settings' => [
                'has_requests' => false,
                'requests_scope' => 'N/A - this page has no request data',
                'has_facilities' => false,
                'has_equipment' => false,
            ],
            'request.create' => [
                'has_requests' => false,
                'requests_scope' => 'N/A - creating new request, no list available',
                'has_facilities' => true,
                'facilities_scope' => 'available facilities',
                'has_equipment' => true,
                'equipment_scope' => 'available equipment',
            ],
            'rules' => [
                'has_requests' => false,
                'requests_scope' => 'N/A - rules/FAQ page only',
                'has_facilities' => false,
                'has_equipment' => false,
            ],
            'chatbot.logs.index' => [
                'has_requests' => false,
                'requests_scope' => 'N/A - chatbot logs page only',
                'has_facilities' => false,
                'has_equipment' => false,
            ],
            'accounts.index' => [
                'has_requests' => false,
                'requests_scope' => 'N/A - accounts page only',
                'has_facilities' => false,
                'has_equipment' => false,
            ],
            'request-options' => [
                'has_requests' => false,
                'requests_scope' => 'N/A - request options page only',
                'has_facilities' => false,
                'has_equipment' => false,
            ],
            default => [
                'has_requests' => false,
                'requests_scope' => 'unknown - route not yet mapped',
                'has_facilities' => false,
                'facilities_scope' => 'unknown facilities',
                'has_equipment' => false,
            ],
        };
    }

    public static function summary(array $capability): string
    {
        $parts = [];

        if (isset($capability['has_requests']) && $capability['has_requests']) {
            $parts[] = 'requests: '.$capability['requests_scope'];
        } elseif (isset($capability['has_requests']) && ! $capability['has_requests']) {
            $parts[] = 'requests: not available on this page';
        }

        if (isset($capability['has_facilities']) && $capability['has_facilities']) {
            $parts[] = 'facilities: '.($capability['facilities_scope'] ?? 'available facilities');
        }

        if (isset($capability['has_equipment']) && $capability['has_equipment']) {
            $parts[] = 'equipment: '.($capability['equipment_scope'] ?? 'available equipment');
        }

        return implode(', ', $parts);
    }

    public static function missing(array $capability): string
    {
        $missing = [];

        if (isset($capability['has_requests']) && ! $capability['has_requests']) {
            $missing[] = 'full request list';
        }
        if (isset($capability['has_facilities']) && ! $capability['has_facilities']) {
            $missing[] = 'facilities';
        }
        if (isset($capability['has_equipment']) && ! $capability['has_equipment']) {
            $missing[] = 'equipment';
        }

        return $missing ? 'This page does not have: '.implode(', ', $missing) : '';
    }
}
