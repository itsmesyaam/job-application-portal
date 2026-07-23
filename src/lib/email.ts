import nodemailer from 'nodemailer';

/**
 * Creates the Nodemailer Transporter if SMTP host config is defined.
 * If credentials are not set, returns null (falls back to console log printing).
 */
function getTransporter() {
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASSWORD || '',
      },
    });
  }
  return null;
}

/**
 * Global Email Dispatcher
 */
async function sendMail(to: string, subject: string, htmlContent: string, textFallback: string) {
  const from = process.env.SMTP_FROM || 'Acme Recruitment <noreply@example.com>';
  const transporter = getTransporter();

  if (transporter) {
    try {
      await transporter.sendMail({
        from,
        to,
        subject,
        text: textFallback,
        html: htmlContent,
      });
      console.log(`[SMTP Email] Sent successfully to: ${to} (Subject: "${subject}")`);
    } catch (error) {
      console.error(`[SMTP Email Error] Failed to send email to ${to}:`, error);
    }
  } else {
    // Beautiful local console log fallback
    console.log('\n');
    console.log('=================== LOCAL MOCK EMAIL SIMULATOR ===================');
    console.log(`FROM:     ${from}`);
    console.log(`TO:       ${to}`);
    console.log(`SUBJECT:  ${subject}`);
    console.log('------------------------------------------------------------------');
    console.log('TEXT FALLBACK:');
    console.log(textFallback);
    console.log('------------------------------------------------------------------');
    console.log('HTML CONTENT (Rendered Template):');
    console.log(htmlContent);
    console.log('==================================================================');
    console.log('\n');
  }
}

/**
 * template wrapper for consistent branding
 */
function getEmailWrapper(title: string, bodyHtml: string) {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>${title}</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            background-color: #f8fafc;
            color: #334155;
            margin: 0;
            padding: 0;
          }
          .container {
            max-width: 600px;
            margin: 30px auto;
            background-color: #ffffff;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 4px 12px rgba(15, 23, 42, 0.05);
            border: 1px solid #e2e8f0;
          }
          .header {
            background-color: #4f46e5;
            padding: 24px;
            text-align: center;
          }
          .logo {
            font-size: 20px;
            font-weight: 800;
            color: #ffffff;
            letter-spacing: 0.5px;
          }
          .body {
            padding: 35px 24px;
            line-height: 1.6;
          }
          .title {
            font-size: 18px;
            font-weight: 700;
            color: #0f172a;
            margin-top: 0;
            margin-bottom: 20px;
          }
          .footer {
            background-color: #f1f5f9;
            padding: 20px;
            text-align: center;
            font-size: 11px;
            color: #64748b;
            border-top: 1px solid #e2e8f0;
          }
          .button {
            display: inline-block;
            background-color: #4f46e5;
            color: #ffffff !important;
            font-weight: 600;
            font-size: 13px;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 8px;
            margin: 20px 0;
          }
          .highlight-box {
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            padding: 18px;
            margin: 20px 0;
          }
          .highlight-item {
            margin: 8px 0;
            font-size: 13px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">ACME ENTERPRISE CAREERS</div>
          </div>
          <div class="body">
            ${bodyHtml}
          </div>
          <div class="footer">
            &copy; ${new Date().getFullYear()} Acme Enterprise Inc. All rights reserved.<br>
            123 Corporate Blvd, Silicon Valley, CA 94025
          </div>
        </div>
      </body>
    </html>
  `;
}

/**
 * 1. Welcome Email (on initial application form submission)
 */
export async function sendWelcomeEmail(to: string, name: string, position: string) {
  const subject = `Application Received - ${position}`;
  
  const text = `Dear ${name},\n\nThank you for applying for the ${position} position at Acme Enterprise.\n\nWe have successfully received your resume and application. Our recruitment coordinators will review your details shortly.\n\nYou can track the live status of your application on your portal:\nhttp://localhost:3000/dashboard\n\nBest regards,\nAcme Recruitment Team`;

  const html = getEmailWrapper(
    'Application Received',
    `
      <h3 class="title">Thank you for applying, ${name}!</h3>
      <p>We are delighted to confirm that we have successfully received your application for the position of <strong>${position}</strong>.</p>
      <p>Our hiring team is currently reviewing your resume and cover letter against the role requirements. We value your interest and time, and will contact you regarding next assessment phases.</p>
      <p>In the meantime, you can sign in to monitor status updates or communicate with recruiter managers using your live candidate dashboard:</p>
      <div style="text-align: center;">
        <a href="http://localhost:3000/dashboard" class="button">Access Candidate Dashboard</a>
      </div>
      <p>Best regards,<br>The Acme Recruiting Team</p>
    `
  );

  await sendMail(to, subject, html, text);
}

/**
 * 2. Shortlisted & Task Assigned Email (strictly sets 48-Hour deadline parameters)
 */
export async function sendShortlistEmail(
  to: string, 
  name: string, 
  position: string, 
  title: string, 
  deadline: Date
) {
  const formattedDeadline = deadline.toLocaleString(undefined, {
    dateStyle: 'long',
    timeStyle: 'short'
  });
  
  const subject = `Technical Challenge Assigned - Shortlisted for ${position}`;
  
  const text = `Dear ${name},\n\nCongratulations! You have been shortlisted for the ${position} position.\n\nWe invite you to complete a take-home technical challenge:\nAssignment: ${title}\nDeadline: ${formattedDeadline} (Strictly 48 Hours)\n\nAccess details and upload submissions here:\nhttp://localhost:3000/dashboard\n\nBest regards,\nAcme Hiring Committee`;

  const html = getEmailWrapper(
    'Shortlisted & Challenge Assigned',
    `
      <h3 class="title" style="color: #4f46e5;">Congratulations, ${name}!</h3>
      <p>Our hiring coordinators have reviewed your profile and we are thrilled to advance you to the technical assessment phase for the <strong>${position}</strong> position.</p>
      <p>We have assigned a take-home challenge to evaluate your technical skills. Please complete the tasks detailed in the instructions:</p>
      
      <div class="highlight-box">
        <div class="highlight-item"><strong>Assignment:</strong> ${title}</div>
        <div class="highlight-item"><strong>Timeline:</strong> Exactly 48 Hours</div>
        <div class="highlight-item" style="color: #ef4444;"><strong>Strict Deadline:</strong> ${formattedDeadline}</div>
      </div>

      <p>Please note that the system will automatically lock and reject submissions once the 48-Hour countdown runs out. Please plan your schedule accordingly.</p>
      <p>To view detailed instructions, download design briefs, ask questions to HR, and submit your deliverables (archive folder or repository links), proceed to your dashboard:</p>
      <div style="text-align: center;">
        <a href="http://localhost:3000/dashboard" class="button">Start Take-Home Assignment</a>
      </div>
      <p>Best of luck!<br>The Acme Hiring Committee</p>
    `
  );

  await sendMail(to, subject, html, text);
}

/**
 * 3. Task Reminder Email (Warning sent strictly at 12 hours remaining before deadline)
 */
export async function sendTaskReminderEmail(to: string, name: string, title: string, deadline: Date) {
  const formattedDeadline = deadline.toLocaleString(undefined, {
    dateStyle: 'long',
    timeStyle: 'short'
  });

  const subject = `Urgent Reminder: 12 Hours Remaining for Technical Challenge`;
  
  const text = `Dear ${name},\n\nThis is an urgent reminder that there are less than 12 hours remaining to submit your take-home challenge: "${title}".\n\nDeadline: ${formattedDeadline}\n\nDeliver work here:\nhttp://localhost:3000/dashboard\n\nBest regards,\nAcme Recruitment`;

  const html = getEmailWrapper(
    'Assignment Deadline Warning',
    `
      <h3 class="title" style="color: #ef4444;">⚠️ Assignment Deadline Warning</h3>
      <p>Dear ${name},</p>
      <p>This is a notification that there are <strong>less than 12 hours remaining</strong> before your technical take-home assignment is due.</p>
      
      <div class="highlight-box" style="border-left: 4px solid #ef4444;">
        <div class="highlight-item"><strong>Challenge:</strong> ${title}</div>
        <div class="highlight-item" style="color: #ef4444; font-weight: bold;">Due Date: ${formattedDeadline}</div>
      </div>

      <p>To prevent automatic disqualification and ensure your work is reviewed, please paste your repository links or upload your ZIP packages before the countdown reaches zero.</p>
      <div style="text-align: center;">
        <a href="http://localhost:3000/dashboard" class="button" style="background-color: #ef4444;">Upload Submission Now</a>
      </div>
      <p>If you encounter technical issues, please message the HR coordinator in the in-app chat.</p>
      <p>Best regards,<br>The Acme Recruitment Team</p>
    `
  );

  await sendMail(to, subject, html, text);
}

/**
 * 4. Submission Confirmation Email (on candidate submission upload)
 */
export async function sendSubmissionConfirmEmail(to: string, name: string, title: string) {
  const subject = `Assignment Submitted Successfully - ${title}`;
  
  const text = `Dear ${name},\n\nThis confirms we have received your technical submission for "${title}".\n\nOur engineering leads will evaluate your work and update your status shortly.\n\nBest regards,\nAcme Recruiting`;

  const html = getEmailWrapper(
    'Submission Confirmation',
    `
      <h3 class="title" style="color: #10b981;">✅ Technical Assignment Submitted</h3>
      <p>Dear ${name},</p>
      <p>This email confirms that we have successfully received your submission deliverables for the <strong>"${title}"</strong> technical assessment.</p>
      <p>Our engineering coordinators and team leads will review your code files and deployment urls. We will notify you as soon as the evaluation is complete.</p>
      <p>You can track review outputs or chat with recruiters in the portal:</p>
      <div style="text-align: center;">
        <a href="http://localhost:3000/dashboard" class="button" style="background-color: #10b981;">Go to Candidate Portal</a>
      </div>
      <p>Thank you for your hard work!<br>The Acme Engineering Team</p>
    `
  );

  await sendMail(to, subject, html, text);
}

/**
 * 5. Admin Alert Email (sent to HR when candidate submits task or sends a chat message)
 */
export async function sendAdminAlertEmail(
  to: string, 
  candidateName: string, 
  eventType: 'SUBMISSION' | 'CHAT', 
  details: string
) {
  const eventString = eventType === 'SUBMISSION' ? 'Assessment Submission' : 'New In-App Message';
  const subject = `[HR Alert] Candidate ${candidateName} - ${eventString}`;
  
  const text = `HR Notification:\n\nCandidate: ${candidateName}\nEvent: ${eventString}\nDetails: ${details}\n\nReview candidate in the Admin Dashboard:\nhttp://localhost:3000/admin/dashboard\n\nAcme Careers`;

  const html = getEmailWrapper(
    'Recruitment System Notification',
    `
      <h3 class="title" style="color: #4f46e5;">🔔 Recruitment Pipeline Update</h3>
      <p>This is an automated notification from the Career application engine regarding candidate activity:</p>
      
      <div class="highlight-box">
        <div class="highlight-item"><strong>Candidate Name:</strong> ${candidateName}</div>
        <div class="highlight-item"><strong>Event:</strong> ${eventString}</div>
        <div class="highlight-item"><strong>Activity Summary:</strong> "${details}"</div>
      </div>

      <p>Please inspect the candidate's portfolio, review the code deliverables, or reply to the chat query on the admin panel workspace:</p>
      <div style="text-align: center;">
        <a href="http://localhost:3000/admin/dashboard" class="button">Open Admin Dashboard</a>
      </div>
      <p>System Mailer engine</p>
    `
  );

  await sendMail(to, subject, html, text);
}
