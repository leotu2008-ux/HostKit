/** Phone/website links for a venue or vendor card — `tel:` for a phone number, the bare
 * domain (opened in a new tab) for a website. Renders nothing when both are missing. */
export function ContactLinks({ phone, website }: { phone: string | null; website: string | null }) {
  const bits = [
    phone ? { label: phone, href: `tel:${phone.replace(/[^\d+]/g, "")}` } : null,
    website ? { label: website.replace(/^https?:\/\//, ""), href: website } : null,
  ].filter((bit): bit is { label: string; href: string } => bit !== null);

  if (bits.length === 0) return null;

  return (
    <p className="mt-1 flex flex-wrap gap-x-3 text-[13px]">
      {bits.map((bit) => (
        <a
          key={bit.href}
          href={bit.href}
          className="text-clay hover:underline"
          target={bit.href.startsWith("http") ? "_blank" : undefined}
          rel="noreferrer"
        >
          {bit.label}
        </a>
      ))}
    </p>
  );
}
