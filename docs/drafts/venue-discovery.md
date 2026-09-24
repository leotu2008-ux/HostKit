# Homepage venue discovery draft

Inserted between “The agent works every stage” and “Connect an agent”.

The section uses the existing Inter typography, page rails, monochrome ink, hairline borders, and card radius. The fictional neighborhood is drawn as SVG; it does not access geolocation or call a venue API.

Scroll controls the full sequence: zoom out (0–30%), lock onto the centered location dot (30–46%), expand a scan and reveal nearby markers (46–80%), highlight three example matches (80–95%), then release the sticky section. Scrolling backward reverses the same values. There are no timers, autoplay, or loops. A skip link bypasses the section. Reduced-motion preferences and short landscape viewports receive a static result. Without JavaScript, the final illustration remains visible without pinning.

## Preview and verification

Local preview: http://127.0.0.1:3100

- TypeScript and targeted ESLint pass after generating Prisma and Next route types.
- Browser-reviewed desktop and mobile layouts, reverse progression, and skip/release behavior.
- No horizontal overflow detected in the mobile preview.
- Reduced-motion and print fallbacks implemented; OS reduced-motion emulation was not available in the review browser.
- This is a local, uncommitted draft. No deployment or merge performed.

## Higgsfield asset

The originating task submitted one Seedance 2.5 generation: `94131484-95d0-4732-a87b-c89860d2df83` (10 seconds, 16:9, nonlooping). Original generation completed: [review video](https://d8j0ntlcm91z4.cloudfront.net/user_3Fn1afm9eIpJaOmABhuqTJHribW/hf_20260924_192541_94131484-95d0-4732-a87b-c89860d2df83.mp4). A video edit using that original as reference is in progress under job `b78d91d1-3c0a-4874-b695-49232ad46d9a`. Do not submit a duplicate. Keep both outputs as separate review assets; this implementation deliberately uses deterministic scroll positions so forward and reverse interaction are precise.

## Revision: wider map, no character

Removed the human avatar and replaced it with a small monochrome location dot/ring. The camera now moves from 1.65× to 0.78× (previously 2.65× to 1×), showing a wider neighborhood and smaller buildings and markers throughout. Extended the building field to fill the wider view. The scroll sequence and static fallbacks are preserved.
