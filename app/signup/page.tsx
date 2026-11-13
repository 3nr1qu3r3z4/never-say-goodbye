import type { Metadata } from "next";
import SignupForm from "./signup-form";

export const metadata: Metadata = {
  title: "Become A Moment Maker™ | Never Say Goodbye",
  description:
    "Start preserving the moments, stories, and connections that matter most.",
};

export default function SignupPage() {
  return <SignupForm />;
}
