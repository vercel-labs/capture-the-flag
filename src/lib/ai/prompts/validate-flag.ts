export function validateFlagPrompt(
  submittedFlag: string,
  expectedFormat: string
): string {
  return `Verify if this submitted flag matches the expected CTF flag format.

Submitted: ${submittedFlag}
Expected format: ${expectedFormat}

A valid flag matches the regex: /^CTF\\{[a-f0-9]{4}_\\d{2}_[a-f0-9]{16}\\}$/

Respond with just "valid" or "invalid".`;
}
