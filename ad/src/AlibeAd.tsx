import React from "react";
import { useVideoConfig } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { Opening } from "./scenes/Opening";
import { Islands } from "./scenes/Islands";
import { Find } from "./scenes/Find";
import { Sell } from "./scenes/Sell";
import { Chat } from "./scenes/Chat";
import { Safe } from "./scenes/Safe";
import { EndCard } from "./scenes/EndCard";
import { C } from "./theme";

// The 30-second Alibe ad: seven scenes joined by soft half-second crossfades.
// Scene lengths add up to 30.5s; the six fades overlap 0.5s each, so the
// total is 30s (900 frames at 30fps), as set in Root.tsx.
export const AlibeAd: React.FC = () => {
  const { fps } = useVideoConfig();
  return (
    <TransitionSeries>
      <TransitionSeries.Sequence name="Every island" durationInFrames={3.5 * fps}>
        <Opening style={{ backgroundColor: C.paper, flexDirection: "column", justifyContent: "center", alignItems: "center" }} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 0.5 * fps })} />
      <TransitionSeries.Sequence name="From Malé to Addu" durationInFrames={4.5 * fps}>
        <Islands style={{ backgroundColor: "#0B3C49" }} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 0.5 * fps })} />
      <TransitionSeries.Sequence name="Find it near you" durationInFrames={5.5 * fps}>
        <Find style={{ backgroundColor: C.paper }} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 0.5 * fps })} />
      <TransitionSeries.Sequence name="Sell in a minute" durationInFrames={5.5 * fps}>
        <Sell style={{ backgroundColor: C.paper }} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 0.5 * fps })} />
      <TransitionSeries.Sequence name="Chat, offer, deal" durationInFrames={5.5 * fps}>
        <Chat style={{ backgroundColor: C.paper }} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 0.5 * fps })} />
      <TransitionSeries.Sequence name="Safe by design" durationInFrames={4.5 * fps}>
        <Safe style={{ backgroundColor: C.paper, flexDirection: "column", justifyContent: "center", alignItems: "center" }} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 0.5 * fps })} />
      <TransitionSeries.Sequence name="Alibe" durationInFrames={4 * fps}>
        <EndCard style={{ backgroundColor: C.orange, flexDirection: "column", justifyContent: "center", alignItems: "center" }} />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};
