# Alibe ad (Remotion)

A 30-second vertical ad (1080x1920, 30fps) for Reels, TikTok and Stories:
"Every island. One marketplace." → the Maldives → find, sell, chat, safety →
the Alibe end card.

Six versions, each its own composition:

| Composition     | Size                     | Length | File                        |
| --------------- | ------------------------ | ------ | --------------------------- |
| `AlibeAd`       | 1080x1920 (Reels/TikTok) | 30s    | `out/alibe-ad.mp4`          |
| `AlibeAd15`     | 1080x1920                | 15s    | `out/alibe-ad-15s.mp4`      |
| `AlibeAd6`      | 1080x1920                | 6s     | `out/alibe-ad-6s.mp4`       |
| `AlibeAdWide`   | 1920x1080 (YouTube/FB)   | 30s    | `out/alibe-ad-wide.mp4`     |
| `AlibeAdWide15` | 1920x1080                | 15s    | `out/alibe-ad-wide-15s.mp4` |
| `AlibeAdWide6`  | 1920x1080                | 6s     | `out/alibe-ad-wide-6s.mp4`  |

```bash
cd ad
npm install
npm run dev                                                 # preview and edit in Remotion Studio
npx remotion render src/index.ts AlibeAd out/alibe-ad.mp4   # render one version
```

The scenes adapt to the shape: in widescreen the headline sits on the left and
the phone on the right (`src/parts/stage.ts`).

- `src/AlibeAd.tsx`: the timeline (seven scenes, half-second crossfades).
- `src/scenes/`: one file per scene; each is also its own composition in
  Studio (folder "Scenes") so it can be edited on its own.
- `src/theme.ts`: colours, font (Inter) and easing.
- `public/maldives.jpg`: aerial photo from Unsplash (free to use, including
  commercially, under the Unsplash License).

It's silent: add a licensed music track with `<Audio>` from `@remotion/media`
(`npx remotion add @remotion/media`) in `AlibeAd.tsx`.

Remotion is free for individuals and companies of up to 3 people; larger
companies need a license (remotion.dev/license).
