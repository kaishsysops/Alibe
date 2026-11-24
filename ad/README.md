# Alibe ad (Remotion)

A 30-second vertical ad (1080x1920, 30fps) for Reels, TikTok and Stories:
"Every island. One marketplace." → the Maldives → find, sell, chat, safety →
the Alibe end card.

```bash
cd ad
npm install
npm run dev                                          # preview and edit in Remotion Studio
npx remotion render src/index.ts AlibeAd out/alibe-ad.mp4   # render the MP4
```

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
