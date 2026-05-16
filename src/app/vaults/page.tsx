import { redirect } from "next/navigation";

/**
 * Legacy alias. /vaults moved to /subscriber when the role split landed.
 * Kept as a hard redirect so existing in-app links and bookmarks don't 404.
 */
export default function LegacyVaultsRedirect() {
  redirect("/subscriber");
}
