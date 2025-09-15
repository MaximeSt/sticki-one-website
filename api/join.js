// In api/join.js

import { Resend } from 'resend';

// Initialize Resend with your API key from an environment variable
const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { formData, recaptchaToken, formType } = req.body;
  // --- SERVER-SIDE VALIDATION ---
const { name, email, phone, company, age_confirm, owner_confirm } = formData;
const isDriver = formType === 'driver';

// Basic validation for common fields
if (!name || !email || !phone) {
  return res.status(400).json({ message: 'Name, email, and phone are required.' });
}

// Email format validation
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(email)) {
  return res.status(400).json({ message: 'Please provide a valid email address.' });
}

// Driver-specific validation
if (isDriver) {
  if (age_confirm !== 'on' || owner_confirm !== 'on') {
    return res.status(400).json({ message: 'You must confirm your age and vehicle ownership.' });
  }
} 
// Advertiser-specific validation
else {
  if (!company) {
    return res.status(400).json({ message: 'Company name is required for advertisers.' });
  }
  if (age_confirm !== 'on') { // In the HTML, this is the 'authorized to act' checkbox
    return res.status(400).json({ message: 'You must confirm you are authorized to act for this company.' });
  }
}
// --- END VALIDATION ---

  // 1. reCAPTCHA Verification
  try {
    const recaptchaResponse = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${recaptchaToken}`,
    });
    const recaptchaData = await recaptchaResponse.json();

    if (!recaptchaData.success) {
      // reCAPTCHA verification failed
      return res.status(400).json({ message: 'reCAPTCHA failed. Please try again.' });
    }

    // 2. Data is valid, prepare and send an email
    const subject = formType === 'driver' ? 'New Driver Waitlist Submission!' : 'New Advertiser Interest!';
    const emailBody = Object.entries(formData)
      .map(([key, value]) => `<p><strong>${key}:</strong> ${value}</p>`)
      .join('');

    await resend.emails.send({
      from: 'Sticki.one Waitlist <waitlist@firstdrop.sticki.one>',
      to: 'maxime@sticki.one',
      subject: subject,
      html: `<h1>${subject}</h1>${emailBody}`,
    });

    // 3. Send a success response back to the front-end
    return res.status(200).json({ message: 'Success! Thanks for joining. We will be in touch soon.' });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'An internal error occurred.' });
  }
}