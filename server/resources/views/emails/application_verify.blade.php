<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Confirm your application</title>
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
        .details {
            margin: 16px 0;
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
            <h2>Confirm your application</h2>
        </div>

        <p>Dear {{ $applicantName }},</p>
        <p>We have received your application. Confirm this email address so the
        principal investigator knows the application is genuine.</p>

        <div class="details">
            <p><strong>Position:</strong> {{ $positionTitle }}</p>
            <p><strong>Project:</strong> {{ $projectTitle }}</p>
        </div>

        <div style="text-align: center;">
            <a href="{{ $verifyUrl }}" class="button">Confirm my application</a>
        </div>

        <p class="muted">If the button does not work, copy and paste this link into your browser:<br>{{ $verifyUrl }}</p>

        <p>You can check the status of your application at any time here:<br>
        <span class="muted">{{ $statusUrl }}</span></p>

        <p>If you did not apply, ignore this email and the application will stay unconfirmed.</p>

        <p>Thank you,<br>
        Thapar Institute</p>
    </div>
</body>
</html>
