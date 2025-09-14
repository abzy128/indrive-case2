"use client";
import { useState } from "react";
import TaxiHeatmap from "../components/TaxiHeatmap";

export default function Home() {
  const [propertyName, setPropertyName] = useState<'altitude' | 'speed' | 'azimuth' | null>('speed');
  const [resolution, setResolution] = useState<number>(8);

  const handlePropertyChange = (property: 'altitude' | 'speed' | 'azimuth' | null) => {
    setPropertyName(property);
  };

  const handleResolutionChange = (newResolution: number) => {
    setResolution(newResolution);
  };

  return (
    <div>
      <div style={{ position: "fixed", inset: 0, width: "100vw", height: "100vh", zIndex: 0, margin: "5px" }}>
        <TaxiHeatmap
          center={{ lat: 51.090414, lng: 71.436145 }}
          zoom={12}
          propertyName={propertyName}
          resolution={resolution}
          googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ""}
          className="rounded-lg shadow-lg"
          onPropertyChange={handlePropertyChange}
          onResolutionChange={handleResolutionChange}
        />
      </div>
    </div>
  );
}
