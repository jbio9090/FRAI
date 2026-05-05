<?php foreach((new ReflectionClass("Intervention\Image\ImageManager"))->getMethods() as $m) { echo $m->name . PHP_EOL; }
