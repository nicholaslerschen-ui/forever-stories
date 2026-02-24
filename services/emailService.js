const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

const sesClient = new SESClient({
  region: process.env.AWS_REGION || 'us-west-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const FROM_EMAIL = process.env.EMAIL_FROM || 'noreply@foreverstories.co';

/**
 * Send welcome email to new users
 */
async function sendWelcomeEmail(userEmail, userName) {
  const subject = 'Welcome to Forever Stories! 📖';

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #e11d48; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .header h1 { margin: 0; font-size: 28px; }
    .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
    .button { display: inline-block; background-color: #e11d48; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Welcome to Forever Stories!</h1>
    </div>
    <div class="content">
      <h2>Hi ${userName || 'there'}! 👋</h2>

      <p>Welcome to Forever Stories – your personal space to preserve memories, share stories, and create a lasting legacy for the people you love.</p>

      <h3>Here's what you can do:</h3>
      <ul>
        <li><strong>Answer Daily Prompts</strong> – Receive thoughtful questions each day to capture your life stories</li>
        <li><strong>Write Free-Form Stories</strong> – Share memories whenever inspiration strikes</li>
        <li><strong>Add Photos & Videos</strong> – Attach media to bring your stories to life</li>
        <li><strong>Invite Loved Ones</strong> – Share your stories with family and friends</li>
      </ul>

      <p>Your stories matter. Start preserving them today!</p>

      <p style="margin-top: 30px;">
        <strong>Ready to get started?</strong><br>
        Open the Forever Stories app and answer your first prompt!
      </p>
    </div>
    <div class="footer">
      <p>Forever Stories • Preserving memories for generations</p>
      <p style="font-size: 12px; margin-top: 10px;">
        If you didn't create this account, please ignore this email.
      </p>
    </div>
  </div>
</body>
</html>
  `;

  const textBody = `
Welcome to Forever Stories!

Hi ${userName || 'there'}!

Welcome to Forever Stories – your personal space to preserve memories, share stories, and create a lasting legacy for the people you love.

Here's what you can do:
- Answer Daily Prompts – Receive thoughtful questions each day to capture your life stories
- Write Free-Form Stories – Share memories whenever inspiration strikes
- Add Photos & Videos – Attach media to bring your stories to life
- Invite Loved Ones – Share your stories with family and friends

Your stories matter. Start preserving them today!

Ready to get started? Open the Forever Stories app and answer your first prompt!

---
Forever Stories • Preserving memories for generations

If you didn't create this account, please ignore this email.
  `;

  try {
    const command = new SendEmailCommand({
      Source: FROM_EMAIL,
      Destination: {
        ToAddresses: [userEmail]
      },
      Message: {
        Subject: {
          Data: subject,
          Charset: 'UTF-8'
        },
        Body: {
          Html: {
            Data: htmlBody,
            Charset: 'UTF-8'
          },
          Text: {
            Data: textBody,
            Charset: 'UTF-8'
          }
        }
      }
    });

    const response = await sesClient.send(command);
    console.log('✅ Welcome email sent to:', userEmail, '- MessageId:', response.MessageId);
    return { success: true, messageId: response.MessageId };
  } catch (error) {
    console.error('❌ Failed to send welcome email to:', userEmail, error);
    // Don't throw - we don't want signup to fail if email fails
    return { success: false, error: error.message };
  }
}

/**
 * Send invite email to family members
 */
async function sendInviteEmail(recipientEmail, senderName, inviteCode) {
  const subject = `${senderName} invited you to Forever Stories`;

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #e11d48; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
    .invite-code { background-color: #fff; border: 2px dashed #e11d48; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0; }
    .invite-code-text { font-size: 32px; font-weight: bold; color: #e11d48; letter-spacing: 4px; font-family: 'Courier New', monospace; }
    .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>💝 You've Been Invited!</h1>
    </div>
    <div class="content">
      <h2>Hi there!</h2>

      <p><strong>${senderName}</strong> has invited you to view their stories on Forever Stories.</p>

      <p>Forever Stories is a personal memory preservation platform where ${senderName} is sharing their life experiences, memories, and wisdom with loved ones.</p>

      <div class="invite-code">
        <p style="margin: 0; font-size: 14px; color: #6b7280; margin-bottom: 10px;">Your Invite Code:</p>
        <div class="invite-code-text">${inviteCode}</div>
      </div>

      <h3>What you can do:</h3>
      <ul>
        <li><strong>Read Their Stories</strong> – Explore memories and life experiences shared by ${senderName}</li>
        <li><strong>Submit Questions</strong> – Ask questions you'd like them to answer</li>
      </ul>

      <p style="margin-top: 30px;">
        <strong>Ready to get started?</strong><br>
        Download the Forever Stories app and create an account using your invite code: <strong>${inviteCode}</strong>
      </p>

      <div style="text-align: center; margin-top: 30px;">
        <a href="https://foreverstories.co/download" style="display: inline-block; background-color: #e11d48; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 10px;">
          📱 Download the App
        </a>
      </div>

      <p style="text-align: center; margin-top: 20px; font-size: 14px; color: #6b7280;">
        Available on iOS and Android
      </p>
    </div>
    <div class="footer">
      <p>Forever Stories • Preserving memories for generations</p>
    </div>
  </div>
</body>
</html>
  `;

  const textBody = `
You've Been Invited to Forever Stories!

${senderName} has invited you to view their stories on Forever Stories.

Your Invite Code: ${inviteCode}

What you can do:
- Read Their Stories – Explore memories and life experiences shared by ${senderName}
- Submit Questions – Ask questions you'd like them to answer

Ready to get started?
Download the Forever Stories app and create an account using your invite code: ${inviteCode}

Download the app: https://foreverstories.co/download
Available on iOS and Android

---
Forever Stories • Preserving memories for generations
  `;

  try {
    const command = new SendEmailCommand({
      Source: FROM_EMAIL,
      Destination: {
        ToAddresses: [recipientEmail]
      },
      Message: {
        Subject: {
          Data: subject,
          Charset: 'UTF-8'
        },
        Body: {
          Html: {
            Data: htmlBody,
            Charset: 'UTF-8'
          },
          Text: {
            Data: textBody,
            Charset: 'UTF-8'
          }
        }
      }
    });

    const response = await sesClient.send(command);
    console.log('✅ Invite email sent to:', recipientEmail, '- MessageId:', response.MessageId);
    return { success: true, messageId: response.MessageId };
  } catch (error) {
    console.error('❌ Failed to send invite email to:', recipientEmail, error);
    throw error; // Throw here since invite sending should notify user of failures
  }
}

module.exports = {
  sendWelcomeEmail,
  sendInviteEmail
};
