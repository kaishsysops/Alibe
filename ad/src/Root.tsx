import React from "react";
import { Composition, Folder } from "remotion";
import { AlibeAd } from "./AlibeAd";
import { Opening } from "./scenes/Opening";
import { Islands } from "./scenes/Islands";
import { Find } from "./scenes/Find";
import { Sell } from "./scenes/Sell";
import { Chat } from "./scenes/Chat";
import { Safe } from "./scenes/Safe";
import { EndCard } from "./scenes/EndCard";

// The ad (vertical, for Reels, TikTok and Stories) and each scene on its own.
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition id="AlibeAd" component={AlibeAd} durationInFrames={900} fps={30} width={1080} height={1920} />
      <Folder name="Scenes">
        <Composition id="Opening" component={Opening} durationInFrames={105} fps={30} width={1080} height={1920} defaultProps={{ style: { backgroundColor: "#F7F5F2", flexDirection: "column", justifyContent: "center", alignItems: "center" } }} />
        <Composition id="Islands" component={Islands} durationInFrames={135} fps={30} width={1080} height={1920} defaultProps={{ style: { backgroundColor: "#0B3C49" } }} />
        <Composition id="Find" component={Find} durationInFrames={165} fps={30} width={1080} height={1920} defaultProps={{ style: { backgroundColor: "#F7F5F2" } }} />
        <Composition id="Sell" component={Sell} durationInFrames={165} fps={30} width={1080} height={1920} defaultProps={{ style: { backgroundColor: "#F7F5F2" } }} />
        <Composition id="Chat" component={Chat} durationInFrames={165} fps={30} width={1080} height={1920} defaultProps={{ style: { backgroundColor: "#F7F5F2" } }} />
        <Composition id="Safe" component={Safe} durationInFrames={135} fps={30} width={1080} height={1920} defaultProps={{ style: { backgroundColor: "#F7F5F2", flexDirection: "column", justifyContent: "center", alignItems: "center" } }} />
        <Composition id="EndCard" component={EndCard} durationInFrames={120} fps={30} width={1080} height={1920} defaultProps={{ style: { backgroundColor: "#FF6A00", flexDirection: "column", justifyContent: "center", alignItems: "center" } }} />
      </Folder>
    </>
  );
};
