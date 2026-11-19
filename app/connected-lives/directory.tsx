"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { relationshipLabel, relationshipTypes } from "@/lib/connected-lives";
import { filterConnections, isFamilyRelationship, type DirectoryConnection } from "@/lib/connected-lives-directory";
import RelationshipEditor from "./relationship-editor";
import SharedTags from "./shared-tags";

const inputClass = "mt-2 min-h-11 w-full rounded-xl border border-white/15 bg-slate-950/60 px-3 text-sm text-white";

export default function ConnectedLivesDirectory({ connections, viewerId }: {
  connections: DirectoryConnection[]; viewerId: string;
}) {
  const [search, setSearch] = useState("");
  const [relationship, setRelationship] = useState("all");
  const [tag, setTag] = useState("all");
  const [sort, setSort] = useState("az");
  const [groupByRelationship, setGroupByRelationship] = useState(false);
  const filtered = useMemo(() => filterConnections(connections, search, relationship, tag, sort),
    [connections, search, relationship, tag, sort]);
  const categories = new Map<string, string>(relationshipTypes.map((item) => [item.value, item.label]));
  for (const connection of connections) {
    if (connection.relationshipType && !categories.has(connection.relationshipType)) {
      categories.set(connection.relationshipType, relationshipLabel(connection.relationshipType));
    }
  }
  const tags = new Map<string, string>([["veteran", "Veteran"]]);
  for (const connection of connections) {
    for (const item of connection.personTags) tags.set(item.label.toLowerCase(), item.label);
  }
  const statistics = [
    { label: "Total Connected Lives", value: connections.length },
    { label: "Family Members", value: connections.filter((item) => isFamilyRelationship(item.relationshipType)).length },
    { label: "Friends", value: connections.filter((item) => item.relationshipType === "close_friend").length },
    { label: "Relationship Categories", value: new Set(connections.map((item) => item.relationshipType).filter(Boolean)).size },
  ];
  const grouped = new Map<string, DirectoryConnection[]>();
  for (const connection of filtered) {
    const category = groupByRelationship ? connection.relationshipType ?? "" : "all-connections";
    const group = grouped.get(category) ?? [];
    group.push(connection);
    grouped.set(category, group);
  }

  return (
    <section className="mt-10" aria-labelledby="connections-heading">
      <h2 id="connections-heading" className="font-serif text-2xl text-white sm:text-3xl">Your Connections</h2>
      <dl className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {statistics.map((statistic) => <div key={statistic.label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <dd className="font-serif text-2xl text-[#f0c98e]">{statistic.value}</dd>
          <dt className="mt-1 text-sm text-slate-400">{statistic.label}</dt>
        </div>)}
      </dl>
      {connections.length === 0 ? (
        <p className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-slate-400">Your legacy grows through the people you connect with. Start building your Connected Lives network today.</p>
      ) : (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-sm text-slate-300">Search connections
              <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name or tag" className={inputClass} />
            </label>
            <label className="text-sm text-slate-300">Relationship
              <select value={relationship} onChange={(event) => setRelationship(event.target.value)} className={inputClass}>
                <option value="all">All Connections</option>
                <option value="family-group">Family</option>
                <option value="type:close_friend">Friends</option>
                {[...categories].filter(([value]) => value !== "family" && value !== "close_friend").map(([value, label]) => <option key={value} value={`type:${value}`}>{label}</option>)}
                <option value="unclassified">Unclassified</option>
              </select>
            </label>
            <label className="text-sm text-slate-300">Person tag
              <select value={tag} onChange={(event) => setTag(event.target.value)} className={inputClass}>
                <option value="all">All Tags</option>
                {[...tags].sort((a, b) => a[1].localeCompare(b[1])).map(([value, label]) => <option key={value} value={`tag:${value}`}>{value === "veteran" ? "Veteran Connections" : label}</option>)}
              </select>
            </label>
            <label className="text-sm text-slate-300">Sort by
              <select value={sort} onChange={(event) => setSort(event.target.value)} className={inputClass}>
                <option value="az">Alphabetical A–Z</option><option value="za">Alphabetical Z–A</option>
                <option value="recent">Most Recently Added</option><option value="oldest">Oldest Connection</option>
              </select>
            </label>
          </div>
          <label className="mt-4 flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={groupByRelationship} onChange={(event) => setGroupByRelationship(event.target.checked)} className="accent-[#D8A35B]" />
            Group by relationship
          </label>
          <p role="status" className="mt-4 text-sm text-slate-400">{filtered.length} {filtered.length === 1 ? "connection" : "connections"} shown.{groupByRelationship ? " Sorting applies within each relationship group." : ""}</p>
          {filtered.length ? <div className="mt-4 space-y-8">
            {[...grouped].map(([category, group]) => <section key={category}>
              <h3 className="font-serif text-xl text-white">{!groupByRelationship ? "All Connections" : relationshipLabel(category || null)}</h3>
              <ul className="mt-4 grid gap-4 sm:grid-cols-2">
            {group.map((connection) => (
              <li key={connection.id} className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
                <div className="flex items-start gap-4">
                  <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#D8A35B]/30 bg-slate-900 font-serif text-xl text-[#f0c98e]">
                    {connection.profilePhoto
                      ? <Image src={connection.profilePhoto} alt="" fill unoptimized sizes="64px" className="object-cover" />
                      : <span aria-hidden="true">{connection.displayName.slice(0, 1).toUpperCase()}</span>}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#D8A35B]">Moment Maker™</p>
                    <h4 className="mt-2 break-words font-serif text-xl text-white">{connection.displayName}</h4>
                    <p className="mt-1 text-sm text-slate-300">{relationshipLabel(connection.relationshipType)}</p>
                  </div>
                </div>
                {connection.birthYear !== null && <p className="mt-4 text-sm text-slate-400">Birth year: {connection.birthYear}</p>}
                <p className="mt-3 text-sm text-slate-400">
                  {connection.acceptedAt
                    ? `Connected ${new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" }).format(new Date(connection.acceptedAt))}`
                    : "Connected Date Unavailable"}
                </p>
                {connection.personTags.length > 0 && <p className="mt-3 break-words text-sm text-slate-300">Tags: {connection.personTags.map((item) => item.label).join(" · ")}</p>}
                {connection.profileVisible && connection.personId && <Link href={`/moment-maker/${encodeURIComponent(connection.personId)}`} className="mt-4 inline-flex min-h-11 items-center rounded-full border border-[#D8A35B]/50 px-5 text-sm font-semibold text-[#f0c98e] hover:bg-[#D8A35B]/10">View Profile</Link>}
                <RelationshipEditor connectionId={connection.id} relationshipType={connection.relationshipType} />
                {connection.personId && <SharedTags connectionId={connection.id} personId={connection.personId} viewerId={viewerId} name={connection.displayName} personTags={connection.personTags} ownTags={connection.ownTags} />}
              </li>
            ))}
              </ul>
            </section>)}
          </div> : <p className="mt-5 rounded-2xl border border-white/10 p-5 text-sm text-slate-400">No connections match these filters.</p>}
        </>
      )}
    </section>
  );
}
