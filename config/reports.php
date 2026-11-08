<?php

return [

    /*
    |--------------------------------------------------------------------------
    | LibreOffice Binary
    |--------------------------------------------------------------------------
    |
    | The PDF export converts the generated DOCX report with LibreOffice in
    | headless mode. Leave this empty to auto-detect the binary from the
    | usual install locations, or set it to an explicit path/command.
    |
    */

    'libreoffice_binary' => env('LIBREOFFICE_BINARY'),

];
