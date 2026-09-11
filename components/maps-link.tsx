import { deviceMapsHref, webMapsHref, hasMapTarget, type MapTarget } from "@/lib/maps";

export function MapsLink({
  target,
  children,
  className,
}: {
  target: MapTarget;
  children?: string;
  className?: string;
}) {
  const href = deviceMapsHref(target) ?? webMapsHref(target);
  if (!href || !hasMapTarget(target)) return null;
  return (
    <a href={href} className={className} rel="noreferrer">
      {children ?? (target.address || target.label || "Open in Maps")}
    </a>
  );
}
