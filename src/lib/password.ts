/** The API's password rules, checked before sending so the form can say which one failed. */
export const PASSWORD_MIN_LENGTH = 10;

export function passwordProblem(value: string): string | null {
  if (value.length < PASSWORD_MIN_LENGTH) {
    return `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (!/[A-Za-z]/.test(value)) return "Include at least one letter.";
  if (!/\d/.test(value)) return "Include at least one digit.";
  return null;
}
