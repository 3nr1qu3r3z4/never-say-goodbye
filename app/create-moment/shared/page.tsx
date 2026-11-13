import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import MomentEditor from "../moment-editor";

export const metadata: Metadata = {
  title: "Create A Shared Moment | Never Say Goodbye",
  description: "Create a story to share with the people you choose.",
};
export const instant = false;

export default async function SharedMomentPage() {
  await requireUser();
  return <MomentEditor kind="shared" />;
}
