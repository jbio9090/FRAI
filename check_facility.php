<?php

require 'vendor/autoload.php';

$facility = \App\Models\Facility::find(6);
echo "Facility ID 6: ";
var_dump($facility ? $facility->name : 'not found');

$facility = \App\Models\Facility::where('name', 'MPHC 6C')->first();
echo "MPHC 6C facility: ";
var_dump($facility ? $facility->id : 'not found');

$facility = \App\Models\Facility::where('name', 'MPH 6C')->first();
echo "MPH 6C facility: ";
var_dump($facility ? $facility->id : 'not found');