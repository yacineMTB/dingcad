export async function sendEmail(to: string, subject: string, body: string): Promise<boolean> {
  console.log(`[EMAIL] Email would be sent to ${to}: ${subject}`);
  return true;
}

export async function sendPasswordResetEmail(email: string, token: string): Promise<boolean> {
  console.log(`[EMAIL] Password reset email would be sent to ${email} with token ${token}`);
  return true;
}

export async function sendVerificationEmail(email: string, token: string): Promise<boolean> {
  console.log(`[EMAIL] Verification email would be sent to ${email} with token ${token}`);
  return true;
}

export async function sendPriceAlertEmail(email: string, alertData: Record<string, unknown>): Promise<boolean> {
  console.log(`[EMAIL] Price alert email would be sent to ${email}`);
  return true;
}
