import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import MomentEditor from "../moment-editor";

export const metadata: Metadata = {
  title: "Create A Future Moment Maker™ | Never Say Goodbye",
  description: "Begin a collection for someone whose story is still unfolding.",
};
export const instant = false;

export default async function FutureMomentMakerPage() {
  await requireUser();
  return <MomentEditor kind="future-moment-maker" />;
}
