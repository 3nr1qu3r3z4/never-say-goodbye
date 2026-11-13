import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import MomentEditor from "../moment-editor";

export const metadata: Metadata = {
  title: "Create A Cannot Open Until™ Moment | Never Say Goodbye",
  description: "Save a moment for a future date or meaningful milestone.",
};
export const instant = false;

export default async function CannotOpenUntilPage() {
  await requireUser();
  return <MomentEditor kind="cannot-open-until" />;
}
