<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>IRB Submission Review Request</title>
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
            <h2>IRB Submission Review Request</h2>
        </div>

        <p>Dear {{ $expertName }},</p>
        <p>You have been requested to review an IRB submission and provide your recommendation.</p>

        <div class="details">
            <p><strong>Student:</strong> {{ $studentName }}</p>
            <p><strong>Title:</strong> {{ $title }}</p>
            <p><strong>Reference:</strong> #{{ $formId }}</p>
        </div>

        <p>The submission PDF is attached for your review. Please click below to open the secure
        review page and record your recommendation.</p>

        <div style="text-align: center;">
            <a href="{{ $reviewUrl }}" class="button">Review &amp; Respond</a>
        </div>

        <p class="muted">If the button does not work, copy and paste this link into your browser:<br>{{ $reviewUrl }}</p>

        <p>Thank you,<br>
        Thapar Institute - IRB Coordination Team</p>
    </div>
</body>
</html>
