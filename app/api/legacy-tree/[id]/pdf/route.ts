import { getCurrentUser } from "@/lib/auth";
import { getSql } from "@/lib/db";
import type { ExportPerson } from "@/lib/legacy-tree-export";
import { createLegacyTreePdf, UnsupportedTreeCharacterError } from "@/lib/legacy-tree-pdf";

const privateHeaders = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Sign in to export a family tree.", { status: 401, headers: privateHeaders });
  const { id } = await params;
  const form = await request.formData();
  const rawFamilyName = form.get("familyName");
  if (typeof rawFamilyName !== "string" || rawFamilyName.length > 80 || /[\u0000-\u001f\u007f]/.test(rawFamilyName)) {
    return new Response("Enter a family name of 80 characters or fewer.", { status: 400, headers: privateHeaders });
  }
  const labelOptions = form.getAll("includeRelationshipLabels");
  if (labelOptions.length > 1 || (labelOptions.length === 1 && labelOptions[0] !== "yes" && labelOptions[0] !== "no")) {
    return new Response("Choose whether to include relationship labels.", { status: 400, headers: privateHeaders });
  }
  const sql = getSql();
  const [trees, members, placeholders, futureMakers] = await sql.transaction([
    sql`
      SELECT t.owner_user_id AS "ownerId", owner.display_name AS "ownerName", owner.last_name AS "ownerSurname"
      FROM legacy_trees t
      JOIN legacy_tree_members viewer ON viewer.tree_id = t.id AND viewer.user_id = ${user.id}
      JOIN users owner ON owner.id = t.owner_user_id
      WHERE t.id = ${id}
    `,
    sql`
      SELECT 'member' AS kind, u.id, u.display_name AS name, m.relationship,
             m.line_partner_type AS "linePartnerType", m.line_partner_id AS "linePartnerId"
      FROM legacy_tree_members m JOIN users u ON u.id = m.user_id
      JOIN legacy_tree_members viewer ON viewer.tree_id = m.tree_id AND viewer.user_id = ${user.id}
      WHERE m.tree_id = ${id}
    `,
    sql`
      SELECT 'placeholder' AS kind, p.id, p.name, p.relationship,
             p.line_partner_type AS "linePartnerType", p.line_partner_id AS "linePartnerId",
             COALESCE(p.birth_year, EXTRACT(YEAR FROM p.birth_date)::int) AS "birthYear",
             COALESCE(p.death_year, EXTRACT(YEAR FROM h.passing_date)::int) AS "deathYear",
             (h.family_placeholder_id IS NOT NULL) AS "isHonored"
      FROM family_placeholders p
      JOIN legacy_tree_members viewer ON viewer.tree_id = p.legacy_tree_id AND viewer.user_id = ${user.id}
      LEFT JOIN honored_lives h ON h.family_placeholder_id = p.id
      WHERE p.legacy_tree_id = ${id}
    `,
    sql`
      SELECT 'future' AS kind, f.id, f.name, f.relationship,
             f.line_partner_type AS "linePartnerType", f.line_partner_id AS "linePartnerId"
      FROM future_moment_makers f
      JOIN legacy_tree_members viewer ON viewer.tree_id = f.legacy_tree_id AND viewer.user_id = ${user.id}
      WHERE f.legacy_tree_id = ${id} AND f.status <> 'archived' AND f.archived_at IS NULL
    `,
  ]);
  const tree = trees[0] as { ownerId: string; ownerName: string; ownerSurname: string | null } | undefined;
  if (!tree) return new Response("Tree not found.", { status: 404, headers: privateHeaders });
  type PersonRow = {
    kind: ExportPerson["kind"]; id: string; name: string; relationship: string;
    linePartnerType: string | null; linePartnerId: string | null;
    birthYear?: number | null; deathYear?: number | null; isHonored?: boolean;
  };
  const rows = [...members, ...placeholders, ...futureMakers] as PersonRow[];
  if (!rows.some((row) => row.kind === "member" && row.id === tree.ownerId)) {
    rows.push({ kind: "member", id: tree.ownerId, name: tree.ownerName, relationship: "", linePartnerType: null, linePartnerId: null });
  }
  const people: ExportPerson[] = rows.map((row) => ({
    kind: row.kind,
    data: { id: row.id, linePartnerType: row.linePartnerType, linePartnerId: row.linePartnerId },
    name: row.name,
    relationship: row.relationship,
    isOwner: row.kind === "member" && row.id === tree.ownerId,
    birthYear: row.birthYear ?? null,
    deathYear: row.deathYear ?? null,
    isHonored: row.isHonored ?? false,
  }));
  try {
    const surname = tree.ownerSurname?.trim() || "";
    const normalizeName = (value: string) => value.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();
    const visibleSurname = surname && ` ${normalizeName(tree.ownerName)} `.includes(` ${normalizeName(surname)} `);
    const familyName = rawFamilyName.trim() || (visibleSurname ? surname : "");
    const pdf = await createLegacyTreePdf(tree.ownerName, familyName, people, new Date(), {
      includeRelationshipLabels: labelOptions[0] === "yes",
    });
    return new Response(new Uint8Array(pdf), {
      headers: { ...privateHeaders, "Content-Type": "application/pdf", "Content-Disposition": "attachment; filename=\"family-tree.pdf\"" },
    });
  } catch (error) {
    if (error instanceof UnsupportedTreeCharacterError) {
      console.error("[legacy-tree-pdf] A tree contains a character unsupported by the PDF fonts.");
      return new Response("This tree contains characters not yet supported in PDF exports.", { status: 422, headers: privateHeaders });
    }
    throw error;
  }
}
