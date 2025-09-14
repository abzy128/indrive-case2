"use client";
import { useState } from "react";
import GoogleMap from "../components/GoogleMap";

export default function Home() {
  return (
    <div>
      <div style={{ position: "fixed", inset: 0, width: "100vw", height: "100vh", zIndex: 0, margin: "5px" }}>
        <GoogleMap
          center={{ lat: 51.08916576942158, lng: 71.416075309543 }}
          zoom={15}
        />
      </div>
    </div>
  );
}
