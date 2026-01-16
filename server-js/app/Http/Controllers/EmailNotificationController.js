// TODO: Implement EmailService equivalent
// This service should handle email sending with support for:
// - Template-based emails
// - Scheduled emails
// - Attachments
// - Various email types (approval, reminder, etc.)

export const sendWelcomeEmail = async (req, res) => {
  try {
    const userEmail = "akarsh91140@gmail.com";
    const userName = "Abhinav";

    // TODO: Implement email service
    // const pdfPath = path.join(__dirname, '../../../storage/uploads/irb_sub_rev/irb_sub_rev_100003570_202504040238399491.pdf');

    // const success = await emailService.sendEmail({
    //   to: userEmail,
    //   template: 'approval',
    //   data: {
    //     user: {
    //       name: userName,
    //       email: userEmail,
    //     },
    //     name: userName,
    //     email: userEmail,
    //     approverName: "Dr. Tarunpreet Bhatia",
    //     formId: 2,
    //     approvalKey: 'fe6160cde4d63d587ca56e71f24ff5c4014531c1cea0d858ab71e9402e7dcca0',
    //   },
    //   scheduled: false,
    //   sendAt: '2025-04-01 11:13:00',
    //   subject: "IRB Submission Approval Request",
    //   attachments: [pdfPath]
    // });

    // if (success) {
    //   return res.status(200).json({
    //     success: true,
    //     message: 'Approval email sent successfully.'
    //   });
    // } else {
    //   return res.status(500).json({
    //     success: false,
    //     message: 'Failed to send approval email.'
    //   });
    // }

    return res.status(501).json({
      success: false,
      message: 'Email service not yet implemented'
    });
  } catch (error) {
    console.error('Error sending email:', error);
    return res.status(500).json({
      success: false,
      message: `Error: ${error.message}`
    });
  }
};

export const scheduleReminder = async (req, res) => {
  try {
    const { email, event, details, send_at } = req.body;

    if (!email || !event || !send_at) {
      return res.status(400).json({
        success: false,
        message: 'email, event, and send_at are required'
      });
    }

    // TODO: Implement email service for scheduled reminders
    // const success = await emailService.sendEmail({
    //   to: email,
    //   template: 'reminder',
    //   data: {
    //     event: event,
    //     details: details
    //   },
    //   scheduled: true,
    //   sendAt: send_at, // Format: '2025-04-15 14:30:00'
    //   subject: `Reminder: ${event}`
    // });

    // return res.status(200).json({ success: success });

    return res.status(501).json({
      success: false,
      message: 'Email scheduling service not yet implemented'
    });
  } catch (error) {
    console.error('Error scheduling reminder:', error);
    return res.status(500).json({
      success: false,
      message: `Error: ${error.message}`
    });
  }
};
