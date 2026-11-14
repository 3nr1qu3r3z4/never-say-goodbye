import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import SignupForm from "./signup-form";

export const metadata: Metadata = {
  title: "Become A Moment Maker™ | Never Say Goodbye",
  description:
    "Start preserving the moments, stories, and connections that matter most.",
};
export const instant = false;

export default async function SignupPage() {
  if (await getCurrentUser()) redirect("/dashboard");
  return <SignupForm />;
}
