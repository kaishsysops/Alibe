import React from "react";
import { Composition, Folder } from "remotion";
import { AlibeAd, AlibeAd15, AlibeAd6 } from "./AlibeAd";
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
      <Folder name="Vertical">
        <Composition id="AlibeAd" component={AlibeAd} durationInFrames={900} fps={30} width={1080} height={1920} />
        <Composition id="AlibeAd15" component={AlibeAd15} durationInFrames={450} fps={30} width={1080} height={1920} />
        <Composition id="AlibeAd6" component={AlibeAd6} durationInFrames={180} fps={30} width={1080} height={1920} />
      </Folder>
      <Folder name="Wide">
        <Composition id="AlibeAdWide" component={AlibeAd} durationInFrames={900} fps={30} width={1920} height={1080} />
        <Composition id="AlibeAdWide15" component={AlibeAd15} durationInFrames={450} fps={30} width={1920} height={1080} />
        <Composition id="AlibeAdWide6" component={AlibeAd6} durationInFrames={180} fps={30} width={1920} height={1080} />
      </Folder>
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
