import nodemailer from 'nodemailer';
import { env } from '../config/env';

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465, // true for 465, false for other ports
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
});

export const sendOTP = async (email: string, otp: string) => {
  try {
    const info = await transporter.sendMail({
      from: env.EMAIL_FROM,
      to: email,
      subject: "Reset your password OTP",
      text: `Your OTP for resetting the password is: ${otp}. It is valid for 10 minutes.`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #111; color: #fff; border-radius: 12px;">
          <h2 style="color: #14B8A6; margin-bottom: 8px;">${env.APP_NAME}</h2>
          <p style="color: #94A3B8; margin-bottom: 24px;">Password Reset Request</p>
          <p>Your one-time password is:</p>
          <div style="font-size: 36px; font-weight: bold; letter-spacing: 8px; text-align: center; padding: 24px; background: #0B1120; border-radius: 8px; margin: 16px 0;">
            ${otp}
          </div>
          <p style="color: #94A3B8; font-size: 14px;">This code is valid for <strong>10 minutes</strong>. If you didn't request this, you can safely ignore this email.</p>
        </div>
      `,
    });

    console.log(`OTP email sent to ${email} — messageId: ${info.messageId}`);

    // If using Ethereal, log the preview URL
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log(`Preview URL: ${previewUrl}`);
    }

    return info;
  } catch (error) {
    console.error(`Failed to send OTP email to ${email}:`, error);
    throw error;
  }
};
