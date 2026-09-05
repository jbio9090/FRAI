<?php

namespace Database\Seeders;

use App\Models\Equipment;
use App\Models\Facility;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class EquipmentSeeder extends Seeder
{
    public function run(): void
    {
        // --- GLOBAL EQUIPMENT POOL ---
        // Each piece of equipment exists once with a global quantity total
        $equipments = [
            ['name' => 'Padded Seats',                          'quantity' => 500],
            ['name' => 'Built-in Sound System',                 'quantity' => 1],
            ['name' => 'Built-in Motorized Projector',          'quantity' => 1],
            ['name' => 'Tables for Laptop',                     'quantity' => 3],
            ['name' => 'Mic Stand',                             'quantity' => 4],  // 3 in Main Audit + 1 in Assembly Hall
            ['name' => 'Microphone',                            'quantity' => 4],  // 3 in Main Audit + 1 in COED AVR
            ['name' => 'Podium w/ PLV Logo',                    'quantity' => 2],  // 1 Main Audit + 1 Assembly Hall
            ['name' => 'Folding Table',                         'quantity' => 10],
            ['name' => 'Monoblock Chairs',                      'quantity' => 900], // 800 Assembly + 100 COED AVR
            ['name' => 'Sound System with 4 slot audio board',  'quantity' => 1],
            ['name' => 'Wireless Microphone',                   'quantity' => 4],  // 2 Assembly + 2 CEIT
            ['name' => 'Wired Microphone',                      'quantity' => 2],
            ['name' => 'Projector Screen',                      'quantity' => 1],
            ['name' => '8x12ft Tarpaulin Backdrop',             'quantity' => 1],
            ['name' => 'Mobile Fender System w/o Bluetooth',    'quantity' => 1],
            ['name' => 'Seats with working Tables',             'quantity' => 320], // 160 CEIT + 160 CABA
            ['name' => '9x12 Built-in LED Wall',                'quantity' => 2],  // 1 CEIT + 1 CABA
            ['name' => 'Built-in Sound Systems',                'quantity' => 2],  // 1 CEIT + 1 CABA
            ['name' => 'Wireless Microphones',                  'quantity' => 4],  // 2 CEIT + 2 CABA
            ['name' => 'Podium w/o PLV Logo',                   'quantity' => 2],  // 1 CEIT + 1 CABA
        ];

        foreach ($equipments as $eq) {
            Equipment::updateOrCreate(
                ['name' => $eq['name']],
                ['quantity' => $eq['quantity']]
            );
        }

        // --- FACILITY EQUIPMENT PIVOT ---
        // Maps how many of each equipment each facility holds
        $facilities = Facility::pluck('id', 'name');
        $equipment = Equipment::pluck('id', 'name');

        $pivot = [
            // Main Auditorium (index 0)
            [$facilities['Main Auditorium'], $equipment['Padded Seats'],                         500],
            [$facilities['Main Auditorium'], $equipment['Built-in Sound System'],                1],
            [$facilities['Main Auditorium'], $equipment['Built-in Motorized Projector'],         1],
            [$facilities['Main Auditorium'], $equipment['Tables for Laptop'],                    3],
            [$facilities['Main Auditorium'], $equipment['Mic Stand'],                            3],
            [$facilities['Main Auditorium'], $equipment['Microphone'],                           3],
            [$facilities['Main Auditorium'], $equipment['Podium w/ PLV Logo'],                   1],
            [$facilities['Main Auditorium'], $equipment['Folding Table'],                        10],

            // Assembly Hall
            [$facilities['Assembly Hall'],   $equipment['Monoblock Chairs'],                     800],
            [$facilities['Assembly Hall'],   $equipment['Sound System with 4 slot audio board'], 1],
            [$facilities['Assembly Hall'],   $equipment['Wireless Microphone'],                  2],
            [$facilities['Assembly Hall'],   $equipment['Wired Microphone'],                     2],
            [$facilities['Assembly Hall'],   $equipment['Mic Stand'],                            1],
            [$facilities['Assembly Hall'],   $equipment['Projector Screen'],                     1],
            [$facilities['Assembly Hall'],   $equipment['8x12ft Tarpaulin Backdrop'],            1],
            [$facilities['Assembly Hall'],   $equipment['Podium w/ PLV Logo'],                   1],

            // COED AVR
            [$facilities['COED AVR'],        $equipment['Monoblock Chairs'],                     100],
            [$facilities['COED AVR'],        $equipment['Mobile Fender System w/o Bluetooth'],   1],
            [$facilities['COED AVR'],        $equipment['Microphone'],                           1],

            // CEIT Lecture Hall
            [$facilities['CEIT Lecture Hall'], $equipment['Seats with working Tables'],          160],
            [$facilities['CEIT Lecture Hall'], $equipment['9x12 Built-in LED Wall'],             1],
            [$facilities['CEIT Lecture Hall'], $equipment['Built-in Sound Systems'],             1],
            [$facilities['CEIT Lecture Hall'], $equipment['Wireless Microphones'],               2],
            [$facilities['CEIT Lecture Hall'], $equipment['Podium w/o PLV Logo'],                1],

            // CABA Lecture Hall
            [$facilities['CABA Lecture Hall'], $equipment['Seats with working Tables'],          160],
            [$facilities['CABA Lecture Hall'], $equipment['9x12 Built-in LED Wall'],             1],
            [$facilities['CABA Lecture Hall'], $equipment['Built-in Sound Systems'],             1],
            [$facilities['CABA Lecture Hall'], $equipment['Wireless Microphones'],               2],
            [$facilities['CABA Lecture Hall'], $equipment['Podium w/o PLV Logo'],                1],
        ];

        foreach ($pivot as [$facilityId, $equipmentId, $quantity]) {
            $exists = DB::table('facility_equipment')
                ->where('facility_id', $facilityId)
                ->where('equipment_id', $equipmentId)
                ->exists();

            if ($exists) {
                DB::table('facility_equipment')
                    ->where('facility_id', $facilityId)
                    ->where('equipment_id', $equipmentId)
                    ->update([
                        'quantity' => $quantity,
                        'updated_at' => now(),
                    ]);
            } else {
                DB::table('facility_equipment')->insert([
                    'facility_id' => $facilityId,
                    'equipment_id' => $equipmentId,
                    'quantity' => $quantity,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }
    }
}
