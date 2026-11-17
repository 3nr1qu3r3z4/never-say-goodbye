import type { Metadata } from "next";
import RecoveryForm from "@/app/account-recovery/recovery-form";

export const metadata: Metadata = { title: "Forgot Password | Never Say Goodbye" };

export default function ForgotPasswordPage() {
  return <RecoveryForm purpose="password" />;
}
