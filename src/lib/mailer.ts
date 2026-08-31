import { supabase, hasSupabaseKeys, getEnv } from "./supabase";
import * as seed from "@/data/workspace";

/**
 * Helper to identify placeholder values in environment variables.
 */
function isPlaceholder(val: string | undefined): boolean {
  if (!val) return true;
  const lower = val.toLowerCase().trim();
  return (
    lower.length === 0 ||
    lower.includes("placeholder") ||
    lower.includes("your_") ||
    lower.includes("your-") ||
    lower.includes("your_email") ||
    lower.includes("your_app_password") ||
    lower.includes("your_gemini_api_key") ||
    lower.includes("your_resend_api_key") ||
    lower.includes("your_email@gmail.com")
  );
}

/**
 * Drafts a professional notification email using Gemini API if configured,
 * otherwise falls back to a clean template.
 */
async function draftEmailWithGemini(subject: string, rawBody: string): Promise<string> {
  const apiKey = getEnv("GEMINI_API_KEY");
  if (isPlaceholder(apiKey)) {
    return getFallbackHtml(subject, rawBody);
  }

  try {
    const prompt = `You are a professional assistant for the Research Compass project. Please format the following notification into a beautifully styled, modern HTML email body.
Subject: ${subject}
Notification: ${rawBody}

Instructions:
1. Output ONLY the raw HTML code. Do not wrap it in markdown code blocks or \`\`\`html.
2. Use modern inline CSS styling with a professional, clean medical/NLP research theme (emerald/green, slate, and white colors).
3. Include a clear layout with header, body container, card background, and footer.
4. Add a placeholder button linking back to the application.
5. The output must be valid HTML starting with <!DOCTYPE html>.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API returned status ${response.status}`);
    }

    const data = await response.json();
    let html = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    
    // Clean up markdown block wraps if the model returned them
    html = html.trim();
    if (html.startsWith("```html")) {
      html = html.substring(7);
    } else if (html.startsWith("```")) {
      html = html.substring(3);
    }
    if (html.endsWith("```")) {
      html = html.substring(0, html.length - 3);
    }
    html = html.trim();

    if (html) return html;
  } catch (err) {
    console.error("Failed to generate email with Gemini, falling back to template:", err);
  }

  return getFallbackHtml(subject, rawBody);
}

/**
 * Standard fallback HTML template
 */
function getFallbackHtml(subject: string, rawBody: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
        .header { background-color: #059669; color: #ffffff; padding: 24px; text-align: center; }
        .header h1 { margin: 0; font-size: 20px; font-weight: 700; }
        .content { padding: 32px 24px; line-height: 1.6; }
        .subject { font-size: 18px; font-weight: 600; margin-top: 0; color: #0f172a; }
        .body { color: #475569; font-size: 15px; margin-bottom: 24px; }
        .button-wrapper { text-align: center; margin: 32px 0; }
        .btn { background-color: #059669; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; font-size: 14px; display: inline-block; }
        .footer { background-color: #f1f5f9; padding: 16px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Research Compass</h1>
        </div>
        <div class="content">
          <h2 class="subject">${subject}</h2>
          <div class="body">${rawBody}</div>
          <div class="button-wrapper">
            <a href="#" class="btn">View in App</a>
          </div>
        </div>
        <div class="footer">
          This is an automated notification from Research Compass. Please do not reply directly to this email.
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Sends a notification email to the recipient.
 * Formats the email dynamically with Gemini if a key is available,
 * and delivers via SMTP or Resend if credentials are set.
 */
export async function sendEmailNotification(toEmail: string, subject: string, bodyText: string): Promise<void> {
  const htmlBody = await draftEmailWithGemini(subject, bodyText);

  const resendApiKey = getEnv("RESEND_API_KEY");
  const smtpHost = getEnv("SMTP_HOST");
  const smtpUser = getEnv("SMTP_USER");
  const smtpPass = getEnv("SMTP_PASS");

  const hasResend = !isPlaceholder(resendApiKey);
  const hasSmtp = !isPlaceholder(smtpHost) && !isPlaceholder(smtpUser) && !isPlaceholder(smtpPass);

  if (hasResend) {
    try {
      const fromEmail = getEnv("RESEND_FROM_EMAIL") || "onboarding@resend.dev";
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: `Research Compass <${fromEmail}>`,
          to: [toEmail],
          subject: subject,
          html: htmlBody,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Resend API returned status ${response.status}: ${errText}`);
      }

      console.log(`✉️ [EMAIL DISPATCHED VIA RESEND] to: ${toEmail}`);
      return;
    } catch (err) {
      console.error("Failed to send email via Resend API:", err);
    }
  }

  if (hasSmtp) {
    try {
      const nodemailer = await import("nodemailer");
      const smtpPort = parseInt(getEnv("SMTP_PORT") || "587");
      
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      const fromEmail = getEnv("SMTP_FROM_EMAIL") || `"Research Compass" <${smtpUser}>`;

      await transporter.sendMail({
        from: fromEmail,
        to: toEmail,
        subject: subject,
        html: htmlBody,
      });

      console.log(`✉️ [EMAIL DISPATCHED VIA SMTP] to: ${toEmail}`);
      return;
    } catch (err) {
      console.error("Failed to send email via SMTP:", err);
    }
  }

  // Fallback / Development Simulation Logging
  console.log("\n============================================================");
  console.log("✉️  [SIMULATED EMAIL DISPATCH (LIVE PREVIEW)]");
  console.log(`To:      ${toEmail}`);
  console.log(`Subject: ${subject}`);
  console.log(`Body (Gemini/Template HTML Draft generated successfully):`);
  console.log(htmlBody);
  console.log("============================================================\n");
}
