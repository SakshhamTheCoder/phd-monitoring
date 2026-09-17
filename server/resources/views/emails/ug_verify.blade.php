<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Confirm your email</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f4f4f4;
            padding: 20px;
        }
        .email-container {
            max-width: 600px;
            margin: auto;
            padding: 20px;
            background: white;
            border-radius: 10px;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            padding-bottom: 10px;
            border-bottom: 1px solid #ddd;
        }
        .button {
            padding: 12px 24px;
            margin: 10px;
            border-radius: 5px;
            color: white !important;
            background-color: #B22626;
            text-decoration: none;
            display: inline-block;
            font-weight: bold;
        }
        .muted {
            color: #888;
            font-size: 12px;
            word-break: break-all;
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <h2>Confirm your email</h2>
        </div>

        <p>Dear {{ $name }},</p>
        <p>An account was created with this address for the Undergraduate
        Research Fellowship. Confirm the address to sign in and apply.</p>

        <div style="text-align: center;">
            <a href="{{ $verifyUrl }}" class="button">Confirm my email</a>
        </div>

        <p class="muted">If the button does not work, copy and paste this link into your browser:<br>{{ $verifyUrl }}</p>

        <p>The link works for {{ $days }} days. If you did not create this account, ignore this email and nothing further happens.</p>

        <p>Thank you,<br>
        Thapar Institute</p>
    </div>
</body>
</html>
