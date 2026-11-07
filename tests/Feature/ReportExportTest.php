<?php

namespace Tests\Feature;

use App\Enums\PriorityLevel;
use App\Enums\RequestStatus;
use App\Models\Facility;
use App\Models\Request as FacilityRequest;
use App\Models\RequestFacility;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;
use ZipArchive;

class ReportExportTest extends TestCase
{
    use RefreshDatabase;

    public function test_authorized_user_can_download_a_filled_report(): void
    {
        $this->seedReportData();

        $user = User::factory()->create();
        $user->givePermissionTo(Permission::findOrCreate('approve requests'));

        $response = $this->actingAs($user)->get(route('reports.export', ['year' => 2026, 'month' => 11]));

        $response->assertOk();
        $response->assertHeader('content-type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');

        $path = $response->baseResponse->getFile()->getPathname();

        $this->assertFileExists($path);

        $zip = new ZipArchive;
        $this->assertTrue($zip->open($path) === true);

        $document = $zip->getFromName('word/document.xml');
        $volumeChart = $zip->getFromName('word/charts/chart1.xml');
        $facilityChart = $zip->getFromName('word/charts/chart4.xml');

        $zip->close();

        $this->assertIsString($document);
        $this->assertStringNotContainsString('{Period Range}', $document);
        $this->assertStringNotContainsString('{Text Summary}', $document);
        $this->assertStringNotContainsString('{Text analysis', $document);
        $this->assertStringNotContainsString('{Copy the values', $document);
        $this->assertStringContainsString('November 1-30, 2026', $document);
        $this->assertStringContainsString('2 requests were received from 1 requester', $document);
        $this->assertStringContainsString('<w:t>2</w:t>', $document);

        $this->assertIsString($volumeChart);
        $this->assertStringContainsString('<c:ptCount val="30"/>', $volumeChart);

        $this->assertIsString($facilityChart);
        $this->assertStringContainsString('<c:ptCount val="2"/>', $facilityChart);

        @unlink($path);
    }

    public function test_embedded_workbook_is_updated(): void
    {
        $this->seedReportData();

        $user = User::factory()->create();
        $user->givePermissionTo(Permission::findOrCreate('approve requests'));

        $response = $this->actingAs($user)->get(route('reports.export', ['year' => 2026, 'month' => 11]));

        $path = $response->baseResponse->getFile()->getPathname();

        $zip = new ZipArchive;
        $zip->open($path);

        $workbook = $zip->getFromName('word/embeddings/Microsoft_Excel_Worksheet.xlsx');

        $zip->close();

        $this->assertIsString($workbook);

        $temporary = tempnam(sys_get_temp_dir(), 'report_workbook_');
        file_put_contents($temporary, $workbook);

        $nested = new ZipArchive;
        $nested->open($temporary);

        $sheet = $nested->getFromName('xl/worksheets/sheet1.xml');
        $strings = $nested->getFromName('xl/sharedStrings.xml');
        $table = $nested->getFromName('xl/tables/table1.xml');

        $nested->close();
        @unlink($temporary);
        @unlink($path);

        $this->assertIsString($sheet);
        $this->assertStringContainsString('<dimension ref="A1:B31"/>', $sheet);

        $this->assertIsString($strings);
        $this->assertStringContainsString('November 1, 2026', $strings);

        $this->assertIsString($table);
        $this->assertStringContainsString('ref="A1:B31"', $table);
    }

    public function test_user_without_permission_cannot_export(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->get(route('reports.export', ['year' => 2026, 'month' => 11]))
            ->assertForbidden();
    }

    public function test_comparison_placeholder_is_replaced_in_export(): void
    {
        $this->seedReportData();

        $user = User::factory()->create();
        FacilityRequest::factory()->create([
            'user_id' => $user->id,
            'status' => RequestStatus::APPROVED,
            'priority_level' => PriorityLevel::Academic,
            'created_at' => '2026-10-10 08:00:00',
            'processed_at' => '2026-10-11 08:00:00',
        ]);

        $exporter = User::factory()->create();
        $exporter->givePermissionTo(Permission::findOrCreate('approve requests'));

        $response = $this->actingAs($exporter)->get(route('reports.export', ['year' => 2026, 'month' => 11]));

        $path = $response->baseResponse->getFile()->getPathname();

        $zip = new ZipArchive;
        $this->assertTrue($zip->open($path) === true);
        $document = $zip->getFromName('word/document.xml');
        $zip->close();

        $this->assertIsString($document);
        $this->assertStringNotContainsString('{Comparison to previous month}', $document);
        $this->assertStringContainsString('Requests received', $document);

        @unlink($path);
    }

    public function test_facility_usage_is_capped_to_top_six_plus_other(): void
    {
        $user = User::factory()->create();
        $user->givePermissionTo(Permission::findOrCreate('approve requests'));

        for ($index = 0; $index < 7; $index++) {
            $facility = Facility::factory()->create();
            $request = FacilityRequest::factory()->create([
                'user_id' => $user->id,
                'status' => RequestStatus::APPROVED,
                'priority_level' => PriorityLevel::Academic,
            ]);

            RequestFacility::create([
                'request_id' => $request->id,
                'facility_id' => $facility->id,
                'date_requested' => '2026-11-05',
                'time_start' => '08:00:00',
                'time_end' => '10:00:00',
                'status' => RequestStatus::APPROVED,
            ]);
        }

        $response = $this->actingAs($user)->get(route('reports.export', ['year' => 2026, 'month' => 11]));

        $path = $response->baseResponse->getFile()->getPathname();

        $zip = new ZipArchive;
        $zip->open($path);

        $document = $zip->getFromName('word/document.xml');
        $chart = $zip->getFromName('word/charts/chart4.xml');

        $zip->close();
        @unlink($path);

        $this->assertIsString($document);
        $this->assertStringContainsString('Other', $document);

        $this->assertIsString($chart);
        $this->assertSame(7, substr_count($chart, '<c:dPt>'));
        $this->assertStringContainsString('<c:ptCount val="7"/>', $chart);
    }

    private function seedReportData(): void
    {
        $user = User::factory()->create();
        $firstFacility = Facility::factory()->create(['name' => 'COED AVR']);
        $secondFacility = Facility::factory()->create(['name' => 'Main Auditorium']);

        $approved = FacilityRequest::factory()->create([
            'user_id' => $user->id,
            'status' => RequestStatus::APPROVED,
            'priority_level' => PriorityLevel::Academic,
            'created_at' => '2026-11-20 08:00:00',
            'processed_at' => '2026-11-22 08:00:00',
        ]);

        $denied = FacilityRequest::factory()->create([
            'user_id' => $user->id,
            'status' => RequestStatus::DENIED,
            'priority_level' => PriorityLevel::Organization,
            'created_at' => '2026-11-25 08:00:00',
            'processed_at' => '2026-11-27 08:00:00',
        ]);

        RequestFacility::create([
            'request_id' => $approved->id,
            'facility_id' => $firstFacility->id,
            'date_requested' => '2026-11-05',
            'time_start' => '08:00:00',
            'time_end' => '10:00:00',
            'status' => RequestStatus::APPROVED,
        ]);

        RequestFacility::create([
            'request_id' => $denied->id,
            'facility_id' => $secondFacility->id,
            'date_requested' => '2026-11-06',
            'time_start' => '13:00:00',
            'time_end' => '15:00:00',
            'status' => RequestStatus::DENIED,
        ]);
    }
}
