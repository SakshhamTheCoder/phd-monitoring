// Ported from PHP EmailNotificationController
// Uses EmailService for email sending with template support,
// scheduled emails, and attachments.
import EmailService from '../../Services/EmailService.js';
import path from 'path';

export const sendWelcomeEmail = async (req, res) => {
  try {
    const { email, name, approver_name, form_id, approval_key, subject, template, attachments } = req.body;

    const userEmail = email || "akarsh91140@gmail.com";
    const userName = name || "User";

    // Build attachments array
    const attachmentPaths = [];
    if (attachments && Array.isArray(attachments)) {
      for (const attachment of attachments) {
        attachmentPaths.push(attachment);
      }
    }

    const success = await EmailService.sendEmail(
      userEmail,
      template || 'approval',
      {
        user: { name: userName, email: userEmail },
        name: userName,
        email: userEmail,
        approverName: approver_name || '',
        formId: form_id || '',
        approvalKey: approval_key || '',
      },
      false,       // not scheduled
      null,        // no scheduled time
      subject || 'Email Notification',
      attachmentPaths
    );

    if (success) {
      return res.status(200).json({
        success: true,
        message: 'Email sent successfully.'
      });
    } else {
      return res.status(500).json({
        success: false,
        message: 'Failed to send email.'
      });
    }
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

    const success = await EmailService.sendEmail(
      email,
      'reminder',
      {
        event: event,
        details: details || ''
      },
      true,         // scheduled
      send_at,      // Format: '2025-04-15 14:30:00'
      `Reminder: ${event}`
    );

    return res.status(200).json({
      success: success,
      message: success ? 'Reminder scheduled successfully.' : 'Failed to schedule reminder.'
    });
  } catch (error) {
    console.error('Error scheduling reminder:', error);
    return res.status(500).json({
      success: false,
      message: `Error: ${error.message}`
    });
  }
};
