export function getErrorMessage(error: any): string {
  if (!error.response) {
    return "Server is not reachable. Please try again later.";
  }

  const status = error.response.status;

  if (status === 401) return "Invalid email or password.";
  if (status === 403) return "You are not allowed to access this account.";
  if (status === 404) return "User not found.";
  if (status === 500) return "Something went wrong on the server. Please try again.";

  return "Unexpected error. Please try again.";
}