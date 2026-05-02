<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ $title }}</title>
    <style>
        body {
            margin: 0;
            min-height: 100vh;
            display: grid;
            place-items: center;
            font-family: Arial, sans-serif;
            background: #f8fafc;
            color: #0f172a;
        }

        main {
            width: min(520px, calc(100% - 32px));
            padding: 32px;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            background: #ffffff;
            box-shadow: 0 12px 30px rgba(15, 23, 42, 0.08);
        }

        h1 {
            margin: 0 0 12px;
            font-size: 28px;
        }

        p {
            margin: 0 0 14px;
            line-height: 1.6;
            color: #475569;
        }

        a {
            display: inline-block;
            margin-top: 10px;
            color: #0f766e;
            font-weight: 700;
            text-decoration: none;
        }
    </style>
</head>
<body>
    <main>
        <h1>{{ $title }}</h1>
        <p>{{ $message }}</p>
        <p><strong>Request:</strong> {{ $requestTitle }}</p>
        <a href="{{ $detailUrl }}">Open request details</a>
    </main>
</body>
</html>
