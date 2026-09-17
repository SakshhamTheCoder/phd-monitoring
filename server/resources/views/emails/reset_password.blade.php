<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Reset Password</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: #f5eaea;
            padding: 40px 20px;
            color: #333;
            margin: 0;
        }
        .email-container {
            background-color: #ffffff;
            border-radius: 10px;
            padding: 30px 40px;
            max-width: 600px;
            margin: auto;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
        }
        .logo {
            text-align: center;
            margin-bottom: 25px;
        }
        .logo img {
            max-height: 120px;
        }
        h2 {
            font-size: 24px;
            color: #2c3e50;
            margin-bottom: 15px;
        }
        p {
            font-size: 16px;
            line-height: 1.6;
            margin-bottom: 15px;
        }
        a {
            color: #792c2c;
            text-decoration: none;
        }
        .button {
            display: inline-block;
            background-color: #792c2c;
            color: #ffffff;
            padding: 14px 28px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: bold;
            margin-top: 20px;
            transition: background-color 0.3s ease;
        }
        .button:hover {
            background-color: #792c2c;
            color: #ffffff
        }
        .ii a[href] {
            color: white;
        }
        @media (max-width: 600px) {
            .email-container {
                padding: 20px;
            }
            h2 {
                font-size: 20px;
            }
            .button {
                padding: 12px 20px;
                font-size: 15px;
                color: #ffffff;
            }
        }
    </style>
</head>
<body>
<div class="email-container">
    <div class="logo">
        <img src="https://phdportal.thapar.edu/images/tiet_logo.png" alt="PhD Portal Logo">
    </div>
    <h2>Hello {{ $user->name }},</h2>
    <p>We received a request to reset your password for your <strong>PhD Coordination Portal</strong> account at 
        <a href="https://phdportal.thapar.edu/login" target="_blank">phdportal.thapar.edu</a>.
    </p>

    <p>If you made this request, please click the button below to reset your password. This link will remain valid for 24 hours.</p>

    <a href="{{ $resetUrl }}" class="button">Reset Password</a>

    <p>If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>

    <p>For security reasons, this link expires after 24 hours. If it has expired, ask for a new one from the Forgot Password page.</p>

    <p>Best regards,<br>
    PhD Coordination Team<br>
    Thapar Institute of Engineering & Technology</p>
</div>
</body>
</html>
