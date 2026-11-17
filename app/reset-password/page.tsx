import type { Metadata } from "next";
import ResetForm from "./reset-form";

export const metadata: Metadata = {
  title: "Reset Password | Never Say Goodbye",
  referrer: "no-referrer",
};

export default function ResetPasswordPage() {
  return <ResetForm />;
}
