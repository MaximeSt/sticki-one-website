// In api/dsar.js

import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Helper function to prevent HTML injection
function sanitize(text) {
  if (!text) return '';
  return text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { name, email, type, message, 'g-recaptcha-response': recaptchaToken } = req.body;

  // 1. Server-side validation
  if (!name || !email || !type || !recaptchaToken) {
    return res.status(400).json({ message: 'Please fill out all required fields and complete the reCAPTCHA.' });
  }

  // 2. reCAPTCHA Verification
  try {
    const recaptchaResponse = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${recaptchaToken}`,
    });
    const recaptchaData = await recaptchaResponse.json();

    if (!recaptchaData.success) {
      return res.status(400).json({ message: 'reCAPTCHA verification failed. Please try again.' });
    }

    // 3. Prepare and send email
    const subject = `New Privacy Request (DSAR): ${sanitize(type)}`;
    const emailBody = `
      <p>A new data subject access request has been submitted.</p>
      <ul>
        <li><strong>Name:</strong> ${sanitize(name)}</li>
        <li><strong>Email:</strong> ${sanitize(email)}</li>
        <li><strong>Request Type:</strong> ${sanitize(type)}</li>
      </ul>
      <p><strong>Message:</strong></p>
      <p>${sanitize(message)}</p>
    `;

    await resend.emails.send({
      from: 'Sticki.one Privacy <privacy@firstdrop.sticki.one>',
      to: 'privacy@sticki.one', // As specified in your privacy policy
      subject: subject,
      html: emailBody,
    });

    // 4. Send success response
    return res.status(200).json({ message: 'Your request has been submitted successfully. We will respond within 30 days.' });

  } catch (error) {
    console.error('DSAR form error:', error);
    return res.status(500).json({ message: 'An internal error occurred. Please try again later.' });
  }
}