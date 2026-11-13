import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import MomentEditor from "../moment-editor";

export const metadata: Metadata = {
  title: "Create A Personal Moment | Never Say Goodbye",
  description: "Create a private story, protected by your choices.",
};
export const instant = false;

export default async function PersonalMomentPage() {
  await requireUser();
  return <MomentEditor kind="personal" />;
}
