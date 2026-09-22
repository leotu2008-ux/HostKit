/**
 * A pastel-blue sky with soft clouds behind the top of the landing page.
 *
 * Generated, not photographed: an SVG filter turns fractal noise into cloud
 * shapes (threshold the noise into alpha, blur the edges, paint it white),
 * layered twice at different scales so the sky reads as depth rather than
 * texture. No image asset to source, license, or serve, and it re-renders
 * crisply at any width because the noise is computed in the browser.
 *
 * The two layers drift, slowly and in opposite directions, so the sky is
 * alive rather than a backdrop. Each layer is its own SVG, drawn 10% wider
 * than the sky and moved as a whole element by CSS (see .cloud-drift-* in
 * app/globals.css). That split is the point: transforming the SVG element
 * is a compositor job and the expensive noise filters rasterise once, where
 * transforming a group inside one SVG would re-run them every frame.
 *
 * Decorative only — aria-hidden, pointer-events-none, behind the content.
 * The bottom fades into the page ground so the hero sits *in* the sky and
 * the sections below it sit on paper.
 */
export function CloudSky({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 -z-10 overflow-hidden ${className}`}
    >
      {/* Sky: a touch deeper at the top, paling downward. Fills whatever
          relative parent mounts it, so the parent decides where the sky ends. */}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#cfdff2_0%,#d4e2f3_55%,#dce7f5_90%,var(--color-paper)_100%)]" />

      {/* Far layer: the high, thin wisps. Further away, so it moves less. */}
      <svg
        className="cloud-drift-far absolute inset-y-0 -left-[5%] h-full w-[110%]"
        viewBox="0 0 1600 1000"
        preserveAspectRatio="xMidYMid slice"
        role="presentation"
      >
        <defs>
          {/* Smaller, higher wisps: thinner, brighter, further away. */}
          <filter id="cloud-wisps" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency="0.0045 0.009" numOctaves="5" seed="27" result="noise" />
            <feColorMatrix
              in="noise"
              type="matrix"
              values="0 0 0 0 1
                      0 0 0 0 1
                      0 0 0 0 1
                      2.6 0 0 0 -1.25"
            />
            <feGaussianBlur stdDeviation="4" />
          </filter>

          <CloudFade id="far" />
        </defs>

        <g mask="url(#cloud-mask-far)">
          <rect width="1600" height="1000" fill="#fff" filter="url(#cloud-wisps)" opacity="0.35" />
        </g>
      </svg>

      {/* Near layer: the cloud bank and the blue shading under it, which is
          the bank's own silhouette and so must travel with it. Closer, so it
          travels further. */}
      <svg
        className="cloud-drift-near absolute inset-y-0 -left-[5%] h-full w-[110%]"
        viewBox="0 0 1600 1000"
        preserveAspectRatio="xMidYMid slice"
        role="presentation"
      >
        <defs>
          {/* Faint blue shading on the underside of the clouds, offset downward. */}
          <filter id="cloud-shade" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency="0.0022 0.0042" numOctaves="6" seed="11" result="noise" />
            <feColorMatrix
              in="noise"
              type="matrix"
              values="0 0 0 0 0.55
                      0 0 0 0 0.68
                      0 0 0 0 0.86
                      3.4 0 0 0 -1.55"
            />
            <feGaussianBlur stdDeviation="10" />
            <feOffset dy="22" />
          </filter>

          {/* Big, slow shapes: the cloud bank itself. */}
          <filter id="cloud-bank" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency="0.0022 0.0042" numOctaves="6" seed="11" result="noise" />
            {/* Map the noise's red channel into alpha with a steep ramp: below the
                threshold is clear sky, above it is cloud, the ramp is the soft edge. */}
            <feColorMatrix
              in="noise"
              type="matrix"
              values="0 0 0 0 1
                      0 0 0 0 1
                      0 0 0 0 1
                      3.4 0 0 0 -1.55"
              result="shape"
            />
            <feGaussianBlur in="shape" stdDeviation="4" result="soft" />
            {/* Fine grain riding on the soft shape, so the cloud has body. */}
            <feTurbulence type="fractalNoise" baseFrequency="0.012 0.018" numOctaves="3" seed="4" result="grain" />
            <feColorMatrix
              in="grain"
              type="matrix"
              values="0 0 0 0 1
                      0 0 0 0 1
                      0 0 0 0 1
                      1.2 0 0 0 -0.25"
              result="grainAlpha"
            />
            <feComposite in="soft" in2="grainAlpha" operator="arithmetic" k1="1.1" k2="0.35" k3="0" k4="0" result="body" />
            <feGaussianBlur in="body" stdDeviation="1.5" />
          </filter>

          <CloudFade id="near" />
        </defs>

        <g mask="url(#cloud-mask-near)">
          <rect width="1600" height="1000" filter="url(#cloud-shade)" opacity="0.45" />
          <rect width="1600" height="1000" fill="#fff" filter="url(#cloud-bank)" opacity="0.85" />
        </g>
      </svg>

      {/* Ground fade: the last stretch dissolves into the page's paper. */}
      <div className="absolute inset-x-0 bottom-0 h-20 bg-[linear-gradient(180deg,transparent,var(--color-paper))]" />
    </div>
  );
}

/** Fade every cloud layer out toward the bottom so they never crowd the
 *  content. Each SVG needs its own copy: ids are document-wide, and a mask
 *  can't be referenced across SVG elements. */
function CloudFade({ id }: { id: string }) {
  return (
    <>
      <linearGradient id={`cloud-fade-${id}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fff" stopOpacity="1" />
        <stop offset="0.8" stopColor="#fff" stopOpacity="0.9" />
        <stop offset="1" stopColor="#fff" stopOpacity="0" />
      </linearGradient>
      <mask id={`cloud-mask-${id}`}>
        <rect width="1600" height="1000" fill={`url(#cloud-fade-${id})`} />
      </mask>
    </>
  );
}
