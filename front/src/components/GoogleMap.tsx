'use client';

import { useEffect, useRef } from 'react';
import { APIProvider, Map } from '@vis.gl/react-google-maps';

interface GoogleMapProps {
  center? : google.maps.LatLngLiteral;
  zoom?: number;
  className?: string;
  points?: google.maps.LatLngLiteral[];
  heatMapData?: google.maps.LatLngLiteral[];
}


export default function GoogleMap({
  center = { lat: 51.08916576942158, lng: 71.416075309543 }, // Default to Astana coordinates
  zoom = 15,
  className = '',
  points = [],
  heatMapData = [],
}: GoogleMapProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  const mapRef = useRef<google.maps.Map | null>(null);
  const heatmapLayerRef = useRef<google.maps.visualization.HeatmapLayer | null>(null);

  useEffect(() => {
    if (mapRef.current && heatMapData.length > 0 && window.google?.maps?.visualization) {
      if (heatmapLayerRef.current) {
        heatmapLayerRef.current.setData(heatMapData.map(data => new window.google.maps.LatLng(data.lat, data.lng)));
      } else {
        const heatmapLayer = new window.google.maps.visualization.HeatmapLayer({
          data: heatMapData.map(data => new window.google.maps.LatLng(data.lat, data.lng)),
          radius: 10,
          opacity: 0.5,
        });
        heatmapLayer.setMap(mapRef.current);
        heatmapLayerRef.current = heatmapLayer;
      }
    }
    return () => {
      if (heatmapLayerRef.current) {
        heatmapLayerRef.current.setMap(null);
        heatmapLayerRef.current = null;
      }
    };
  }, [heatMapData]);

  if (!apiKey) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-100 w-full h-full ${className}`}
        style={{ width: '100%', height: '100%' }}
      >
        <p className="text-gray-600">
          Google Maps API key not found. Please add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to your environment variables.
        </p>
      </div>
    );
  }

  return (
    <APIProvider apiKey={apiKey}>
      <div className={`w-full h-full ${className}`} style={{ width: '100%', height: '100%' }}>
        <Map
          defaultCenter={center}
          defaultZoom={zoom}
          gestureHandling="greedy"
          disableDefaultUI={false}
          style={{ width: '100%', height: '100%' }}
        >
        </Map>
      </div>
    </APIProvider>
  );
}
