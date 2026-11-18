/** Laravel RegisterCustomerRequest: min 8, mixed case, at least one number. */
export function passwordMeetsPolicy(password: string): boolean {
  return (
    password.length >= 8 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password)
  );
}
