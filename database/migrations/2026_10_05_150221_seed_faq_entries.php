<?php

use App\Models\Rule;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $faqs = [
            [
                'rule' => 'How do I create a new facility request?',
                'faq_answer' => 'Go to **Requests → Create Request** (`/requests/create`). Fill **Details tab** (title, description, event type, approvers, attachments) and **Facility tab** (dates, times, facility, equipment). **Click "Add Facility Booking"** — you can add more for different facility schedules under a single request. Then **click "Submit Request"** at bottom.',
                'priority' => 0,
            ],
            [
                'rule' => 'How do I get another account?',
                'faq_answer' => 'Only **Admin accounts** (handled by the GSO) can create accounts on the **Account page**.',
                'priority' => 1,
            ],
            [
                'rule' => 'What information do I need before starting?',
                'faq_answer' => 'Event title, description, preferred dates/times, expected attendees, required equipment, and any supporting files. **Also ensure that you have the approved letter/s to have a smoother process.**',
                'priority' => 2,
            ],
            [
                'rule' => 'What is the "Request Title" and is it required?',
                'faq_answer' => '**Yes, required.** Clear name like "Gamecon 2024" or "Department Meeting". Max 255 chars.',
                'priority' => 3,
            ],
            [
                'rule' => 'What are the Event Type/Priority levels?',
                'faq_answer' => '**Academic (0)** = normal; **Organization (1)** = important; **University (2)** = time-sensitive; **Government (3)** = auto-approved, highest priority.',
                'priority' => 4,
            ],
            [
                'rule' => 'Do I need a Priority Reason?',
                'faq_answer' => 'Optional but recommended for Organization/University/Government to justify priority.',
                'priority' => 5,
            ],
            [
                'rule' => 'What is "Approved By"?',
                'faq_answer' => 'Optional checklist of required approvers. Check names if your event needs specific sign-offs.',
                'priority' => 6,
            ],
            [
                'rule' => 'What files can I attach?',
                'faq_answer' => '**Letters that prove the event has been approved.** Up to 10 files: JPG, PNG, PDF, DOC/DOCX, XLSX, PPTX. Max size shown on upload area.',
                'priority' => 7,
            ],
            [
                'rule' => 'How do I select dates and times?',
                'faq_answer' => 'Click **Date** field → pick one/multiple dates. Then choose **Start Time** → **End Time** (dropdowns update). Both required.',
                'priority' => 8,
            ],
            [
                'rule' => 'What is "Expected Attendees" and "Has Outsiders"?',
                'faq_answer' => 'Attendees = optional headcount for capacity check. Outsiders = check if non-PLV guests attend **(to inform the GSO)**.',
                'priority' => 9,
            ],
            [
                'rule' => 'Why do I see "Time Conflict Detected"?',
                'faq_answer' => 'Your time overlaps an existing booking. **You can still submit, more so if your request is of higher priority**; admins will review. Try different times/dates to avoid.',
                'priority' => 10,
            ],
            [
                'rule' => 'What does "Short Notice Schedule" warning mean?',
                'faq_answer' => 'Selected date is near minimum lead time. Ensure requirements can be prepared before submitting **and is highly discouraged.**',
                'priority' => 11,
            ],
            [
                'rule' => 'How do I choose a facility and add equipment?',
                'faq_answer' => 'Required: pick **Facility** from dropdown (shows capacity/status). Then check equipment boxes, set **Quantity** (max available shown).',
                'priority' => 12,
            ],
            [
                'rule' => 'What is "External Equipment"?',
                'faq_answer' => '**Outside Items that will be brought to the campus.** Click to add custom items with name/quantity.',
                'priority' => 13,
            ],
            [
                'rule' => 'What is "Borrow Equipment"?',
                'faq_answer' => 'Borrow from **other facilities**. Select source facility and equipment.',
                'priority' => 14,
            ],
            [
                'rule' => 'Can I book multiple facilities in one request?',
                'faq_answer' => 'Yes! After filling one facility\'s schedule+equipment, click **"Add Facility Booking"**. Repeat for each. All appear in list.',
                'priority' => 15,
            ],
            [
                'rule' => 'What happens after I click "Submit Request"?',
                'faq_answer' => 'Request created as **Pending**. Conflicts auto-checked. Email confirmation sent (if enabled). Admins review → approve/reject.',
                'priority' => 16,
            ],
            [
                'rule' => 'Can I edit a submitted request?',
                'faq_answer' => 'Yes, if status is **Pending** or **For Reschedule**. Go to request detail → click **Edit**. Government priority = auto-approved (not editable).',
                'priority' => 17,
            ],
        ];

        foreach ($faqs as $faq) {
            Rule::firstOrCreate(
                ['rule' => $faq['rule'], 'forPolicy' => 1],
                [
                    'faq_answer' => $faq['faq_answer'],
                    'priority' => $faq['priority'],
                ]
            );
        }

        // Normalize priorities to ensure sequential ordering (0, 1, 2, ...)
        Rule::where('forPolicy', 1)
            ->orderBy('priority')
            ->orderBy('id')
            ->get()
            ->each(function (Rule $rule, int $index) {
                if ((int) $rule->priority !== $index) {
                    $rule->update(['priority' => $index]);
                }
            });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Remove only the FAQ entries we seeded (by matching the exact questions)
        $questions = [
            'How do I create a new facility request?',
            'How do I get another account?',
            'What information do I need before starting?',
            'What is the "Request Title" and is it required?',
            'What are the Event Type/Priority levels?',
            'Do I need a Priority Reason?',
            'What is "Approved By"?',
            'What files can I attach?',
            'How do I select dates and times?',
            'What is "Expected Attendees" and "Has Outsiders"?',
            'Why do I see "Time Conflict Detected"?',
            'What does "Short Notice Schedule" warning mean?',
            'How do I choose a facility and add equipment?',
            'What is "External Equipment"?',
            'What is "Borrow Equipment"?',
            'Can I book multiple facilities in one request?',
            'What happens after I click "Submit Request"?',
            'Can I edit a submitted request?',
        ];

        Rule::where('forPolicy', 1)
            ->whereIn('rule', $questions)
            ->delete();

        // Re-normalize remaining FAQ priorities
        Rule::where('forPolicy', 1)
            ->orderBy('priority')
            ->orderBy('id')
            ->get()
            ->each(function (Rule $rule, int $index) {
                if ((int) $rule->priority !== $index) {
                    $rule->update(['priority' => $index]);
                }
            });
    }
};