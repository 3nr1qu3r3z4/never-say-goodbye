import type { Metadata } from "next";
import RecoveryForm from "@/app/account-recovery/recovery-form";

export const metadata: Metadata = { title: "Forgot Username | Never Say Goodbye" };

export default function ForgotUsernamePage() {
  return <RecoveryForm purpose="username" />;
}
