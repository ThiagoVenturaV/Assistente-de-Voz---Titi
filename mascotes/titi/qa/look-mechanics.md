# Titi look mechanics

Titi is a compact animal-and-soft-robot companion with a rounded grounded body, a separate expressive head, two short ears, large glossy oval eyes, tiny paws, and one attached cable-like tail. Looking around must read as attention, not as the whole sprite rotating.

## Anchors and motion

- Keep both feet, the lower torso, body scale, and baseline fixed in every direction.
- The glossy eyes lead the gaze as complete eye constructions: pupils, highlights, eyelids, and visible eye surfaces change together inside their original apertures. Do not slide detached pupils or add replacement eye whites.
- The head follows with a restrained yaw or pitch. The cream face mask, mouth, forehead teal light, and ear attachment points must retain their proportions.
- The upper torso may follow slightly; paws stay attached and quiet. Do not rotate, skew, or warp the complete sprite.
- Ears follow the head by a smaller amount and help vertical directions read: slightly back for up, slightly forward/down for down.
- The cable tail stays attached at the same body point and lags the head motion subtly without flipping sides, teleporting, or becoming a separate prop.

## Cardinal pose families

- `000 up`: body remains frontal and grounded; eyes rotate clearly toward the top edge, eyelids open upward, chin lifts, head pitches up slightly, ears follow back. The mouth remains visible and identity stays frontal.
- `090 screen-right`: eyes, mouth/nose center, and forehead light shift unmistakably toward the screen-right half of the head; head yaws right, revealing more of the left/back contour while the right facial edge compresses. Ears and tail follow subtly.
- `180 down`: body remains frontal and grounded; eyes and eyelids point toward the bottom edge, chin tucks, head pitches down slightly, ears lean forward/down. Do not make this a sad or failed pose.
- `270 screen-left`: inverse of `090`; eyes, mouth/nose center, and forehead light shift unmistakably toward the screen-left half; head yaws left with opposite contour visibility. Ears and tail follow subtly.

## Continuity budget

Interpolate the complete 16-pose clockwise loop in even 22.5-degree steps. Every neighboring pose should move eyes first, then head, ears, upper torso, and tail by a small consistent amount. Keep feet, scale, face construction, markings, and baseline stable across `157.5 -> 180` and `337.5 -> 000`. No cardinal may read as neutral, and no intermediate may reverse direction or jump registration.
