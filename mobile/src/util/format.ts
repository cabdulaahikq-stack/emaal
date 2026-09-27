export function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

export function statusLabel(status: string): string {
  switch (status) {
    case "HELD_FOR_APPROVAL":
      return "Pending approval";
    case "COMPLETED":
      return "Completed";
    case "REJECTED":
      return "Rejected";
    case "FAILED":
      return "Failed";
    case "REVERSED":
      return "Reversed";
    default:
      return status;
  }
}
