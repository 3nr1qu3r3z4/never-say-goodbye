export default function ProfileLocations({
  birthplace,
  location,
}: {
  birthplace: string | null;
  location: string | null;
}) {
  const birth = birthplace?.trim();
  const current = location?.trim();
  if (!birth && !current) return null;

  return (
    <dl className="mt-4 space-y-3 text-sm">
      {birth && (
        <div>
          <dt className="font-medium text-[#f0c98e]">Born In</dt>
          <dd className="mt-1 text-slate-300">{birth}</dd>
        </div>
      )}
      {current && (
        <div>
          <dt className="font-medium text-[#f0c98e]">Lives In</dt>
          <dd className="mt-1 text-slate-300">{current}</dd>
        </div>
      )}
    </dl>
  );
}
