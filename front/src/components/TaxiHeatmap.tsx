import React, { useEffect, useState, useCallback } from 'react';
import { GoogleMap, LoadScript, OverlayView } from '@react-google-maps/api';
import { ChevronDownIcon } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Types
interface HeatmapDataPoint {
  latitude: number;
  longitude: number;
  weight: number;
  unique_values: number;
  h3_id: string;
  avg_value: number;
}

interface HeatmapProps {
  center: { lat: number; lng: number };
  zoom: number;
  propertyName: 'altitude' | 'speed' | 'azimuth' | null;
  resolution?: number;
  className?: string;
  googleMapsApiKey: string;
  onPropertyChange?: (property: 'altitude' | 'speed' | 'azimuth' | null) => void;
  onResolutionChange?: (resolution: number) => void;
}

interface CustomHeatmapOverlayProps {
  data: HeatmapDataPoint[];
  propertyName: string | null;
  map: google.maps.Map | null;
}

// Custom hook for fetching heatmap data
const useHeatmapData = (propertyName: string | null, resolution: number = 9) => {
  const [data, setData] = useState<HeatmapDataPoint[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL;
        if (!apiUrl) {
          throw new Error('API URL not configured');
        }

        const params = new URLSearchParams({
          resolution: resolution.toString(),
        });

        if (propertyName) {
          params.append('col_name', propertyName);
        }

        const response = await fetch(`${apiUrl}/heatmap?${params.toString()}`);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result: HeatmapDataPoint[] = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
        setData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [propertyName, resolution]);

  return { data, loading, error };
};

// Custom Canvas Heatmap Overlay
const CustomHeatmapOverlay: React.FC<CustomHeatmapOverlayProps> = ({
  data,
  propertyName,
  map
}) => {
  const [overlayView, setOverlayView] = useState<google.maps.OverlayView | null>(null);

  useEffect(() => {
    if (!map || !data.length) return;

    class HeatmapOverlay extends google.maps.OverlayView {
      private canvas: HTMLCanvasElement;
      private ctx: CanvasRenderingContext2D;
      private data: HeatmapDataPoint[];
      private propertyName: string | null;

      constructor(data: HeatmapDataPoint[], propertyName: string | null) {
        super();
        this.data = data;
        this.propertyName = propertyName;
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d')!;
        this.canvas.style.position = 'absolute';
        this.canvas.style.pointerEvents = 'none';
      }

      onAdd() {
        const panes = this.getPanes()!;
        panes.overlayLayer.appendChild(this.canvas);
      }

      draw() {
        const projection = this.getProjection();
        if (!projection) return;

        const bounds = map!.getBounds()!;
        const topLeft = projection.fromLatLngToDivPixel(bounds.getNorthEast());
        const bottomRight = projection.fromLatLngToDivPixel(bounds.getSouthWest());

        if (!topLeft || !bottomRight) return;

        this.canvas.style.left = topLeft.x + 'px';
        this.canvas.style.top = topLeft.y + 'px';
        this.canvas.width = Math.abs(bottomRight.x - topLeft.x);
        this.canvas.height = Math.abs(bottomRight.y - topLeft.y);

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Debug: Log canvas dimensions and data count
        console.log(`Canvas: ${this.canvas.width}x${this.canvas.height}, Data points: ${this.data.length}`);

        // Get intensity values
        const getIntensityValue = (point: HeatmapDataPoint) => {
          switch (this.propertyName) {
            case 'altitude':
            case 'speed':
            case 'azimuth':
              return point.avg_value || point.weight;
            default:
              return point.weight;
          }
        };

        const intensityValues = this.data.map(getIntensityValue);
        const maxIntensity = Math.max(...intensityValues);
        const minIntensity = Math.min(...intensityValues);
        const range = maxIntensity - minIntensity || 1;

        // Draw heatmap points
        let drawnPoints = 0;
        this.data.forEach((point, index) => {
          const position = projection.fromLatLngToDivPixel(
            new google.maps.LatLng(point.latitude, point.longitude)
          );

          if (!position) return;

          const x = position.x - topLeft.x;
          const y = position.y - topLeft.y;

          // Check if point is within canvas bounds
          if (x < 0 || x > this.canvas.width || y < 0 || y > this.canvas.height) return;

          const rawIntensity = intensityValues[index];
          const normalizedIntensity = (rawIntensity - minIntensity) / range;
          // Ensure minimum radius for visibility and better scaling
          const radius = Math.max(15, 40 + 30 * Math.sqrt(normalizedIntensity));

          // Create radial gradient
          const gradient = this.ctx.createRadialGradient(x, y, 0, x, y, radius);
          const color = this.getColorForIntensity(normalizedIntensity);

          // Use higher alpha values and ensure minimum visibility
          const baseAlpha = Math.max(0.3, 0.6 * normalizedIntensity + 0.2);
          const midAlpha = Math.max(0.2, 0.4 * normalizedIntensity + 0.1);
          
          gradient.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, ${baseAlpha})`);
          gradient.addColorStop(0.5, `rgba(${color.r}, ${color.g}, ${color.b}, ${midAlpha})`);
          gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

          this.ctx.fillStyle = gradient;
          this.ctx.beginPath();
          this.ctx.arc(x, y, radius, 0, 2 * Math.PI);
          this.ctx.fill();
          drawnPoints++;
        });
        
        // Debug: Log how many points were drawn
        console.log(`Drawn ${drawnPoints} heatmap points`);
      }

      private getColorForIntensity(intensity: number): { r: number; g: number; b: number } {
        // Clamp intensity between 0 and 1
        intensity = Math.max(0, Math.min(1, intensity));

        const colors = this.getGradientColors();
        const colorCount = colors.length;
        const scaledIntensity = intensity * (colorCount - 1);
        const colorIndex = Math.floor(scaledIntensity);
        const fraction = scaledIntensity - colorIndex;

        const startColor = colors[Math.min(colorIndex, colorCount - 1)];
        const endColor = colors[Math.min(colorIndex + 1, colorCount - 1)];

        const result = {
          r: Math.round(startColor.r + (endColor.r - startColor.r) * fraction),
          g: Math.round(startColor.g + (endColor.g - startColor.g) * fraction),
          b: Math.round(startColor.b + (endColor.b - startColor.b) * fraction)
        };

        // Debug logging (remove in production)
        if (Math.random() < 0.01) { // Log 1% of color calculations
          console.log(`Intensity: ${intensity.toFixed(3)}, Color: rgb(${result.r}, ${result.g}, ${result.b})`);
        }

        return result;
      }

      private getGradientColors() {
        switch (this.propertyName) {
          case 'speed':
            return [
              { r: 0, g: 0, b: 128 },    // Dark blue for low speed
              { r: 0, g: 0, b: 255 },    // Blue
              { r: 0, g: 255, b: 0 },    // Green
              { r: 255, g: 255, b: 0 },  // Yellow
              { r: 255, g: 128, b: 0 },  // Orange
              { r: 255, g: 0, b: 0 }     // Red for high speed
            ];
          case 'altitude':
            return [
              { r: 0, g: 102, b: 204 },  // Blue for low altitude
              { r: 0, g: 204, b: 102 },  // Green
              { r: 204, g: 204, b: 0 },  // Yellow
              { r: 204, g: 102, b: 0 },  // Orange
              { r: 204, g: 0, b: 0 }     // Red for high altitude
            ];
          case 'azimuth':
            return [
              { r: 128, g: 0, b: 128 },  // Purple
              { r: 0, g: 0, b: 255 },    // Blue
              { r: 0, g: 255, b: 0 },    // Green
              { r: 255, g: 255, b: 0 },  // Yellow
              { r: 255, g: 128, b: 0 },  // Orange
              { r: 255, g: 0, b: 0 }     // Red
            ];
          default:
            return [
              { r: 0, g: 0, b: 255 },    // Blue
              { r: 0, g: 255, b: 255 },  // Cyan
              { r: 0, g: 255, b: 0 },    // Green
              { r: 255, g: 255, b: 0 },  // Yellow
              { r: 255, g: 128, b: 0 },  // Orange
              { r: 255, g: 0, b: 0 }     // Red
            ];
        }
      }

      onRemove() {
        if (this.canvas.parentNode) {
          this.canvas.parentNode.removeChild(this.canvas);
        }
      }
    }

    // Remove existing overlay
    if (overlayView) {
      overlayView.setMap(null);
    }

    // Create new overlay
    const newOverlay = new HeatmapOverlay(data, propertyName);
    newOverlay.setMap(map);
    setOverlayView(newOverlay);

    return () => {
      if (newOverlay) {
        newOverlay.setMap(null);
      }
    };
  }, [map, data, propertyName]);

  return null;
};

// Custom Info Window Component
const InfoMarkers: React.FC<{
  data: HeatmapDataPoint[];
  propertyName: string | null;
}> = ({ data, propertyName }) => {
  const [selectedPoint, setSelectedPoint] = useState<HeatmapDataPoint | null>(null);

  const getUnit = (propertyName: string | null): string => {
    switch (propertyName) {
      case 'altitude': return 'm';
      case 'speed': return 'm/s';
      case 'azimuth': return '°';
      default: return '';
    }
  };

  // Get color for a data point based on its value
  const getColorForPoint = (point: HeatmapDataPoint): string => {
    // Get intensity value
    const getIntensityValue = (p: HeatmapDataPoint) => {
      switch (propertyName) {
        case 'altitude':
        case 'speed':
        case 'azimuth':
          return p.avg_value || p.weight;
        default:
          return p.weight;
      }
    };

    const intensityValues = data.map(getIntensityValue);
    const maxIntensity = Math.max(...intensityValues);
    const minIntensity = Math.min(...intensityValues);
    const range = maxIntensity - minIntensity || 1;

    const rawIntensity = getIntensityValue(point);
    const normalizedIntensity = (rawIntensity - minIntensity) / range;

    // Get gradient colors
    const getGradientColors = () => {
      switch (propertyName) {
        case 'speed':
          return [
            { r: 0, g: 0, b: 128 },    // Dark blue for low speed
            { r: 0, g: 0, b: 255 },    // Blue
            { r: 0, g: 255, b: 0 },    // Green
            { r: 255, g: 255, b: 0 },  // Yellow
            { r: 255, g: 128, b: 0 },  // Orange
            { r: 255, g: 0, b: 0 }     // Red for high speed
          ];
        case 'altitude':
          return [
            { r: 0, g: 102, b: 204 },  // Blue for low altitude
            { r: 0, g: 204, b: 102 },  // Green
            { r: 204, g: 204, b: 0 },  // Yellow
            { r: 204, g: 102, b: 0 },  // Orange
            { r: 204, g: 0, b: 0 }     // Red for high altitude
          ];
        case 'azimuth':
          return [
            { r: 128, g: 0, b: 128 },  // Purple
            { r: 0, g: 0, b: 255 },    // Blue
            { r: 0, g: 255, b: 0 },    // Green
            { r: 255, g: 255, b: 0 },  // Yellow
            { r: 255, g: 128, b: 0 },  // Orange
            { r: 255, g: 0, b: 0 }     // Red
          ];
        default:
          return [
            { r: 0, g: 0, b: 255 },    // Blue
            { r: 0, g: 255, b: 255 },  // Cyan
            { r: 0, g: 255, b: 0 },    // Green
            { r: 255, g: 255, b: 0 },  // Yellow
            { r: 255, g: 128, b: 0 },  // Orange
            { r: 255, g: 0, b: 0 }     // Red
          ];
      }
    };

    const colors = getGradientColors();
    const colorCount = colors.length;
    const scaledIntensity = normalizedIntensity * (colorCount - 1);
    const colorIndex = Math.floor(scaledIntensity);
    const fraction = scaledIntensity - colorIndex;

    const startColor = colors[Math.min(colorIndex, colorCount - 1)];
    const endColor = colors[Math.min(colorIndex + 1, colorCount - 1)];

    const r = Math.round(startColor.r + (endColor.r - startColor.r) * fraction);
    const g = Math.round(startColor.g + (endColor.g - startColor.g) * fraction);
    const b = Math.round(startColor.b + (endColor.b - startColor.b) * fraction);

    return `rgb(${r}, ${g}, ${b})`;
  };

  return (
    <>
      {data.map((point, index) => {
        const markerColor = getColorForPoint(point);
        return (
          <OverlayView
            key={`${point.h3_id}-${index}`}
            position={{ lat: point.latitude, lng: point.longitude }}
            mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
          >
            <div
              className="w-5 h-5 rounded-full cursor-pointer hover:scale-125 transition-transform shadow-lg border-2 border-white"
              style={{ backgroundColor: markerColor }}
              onClick={() => setSelectedPoint(point)}
              title={`Value: ${propertyName ? (point.avg_value || point.weight).toFixed(2) : point.weight}`}
            />
          </OverlayView>
        );
      })}

      {selectedPoint && (
        <OverlayView
          position={{ lat: selectedPoint.latitude, lng: selectedPoint.longitude }}
          mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
        >
          <div
            className="bg-white p-4 rounded-lg shadow-lg border relative"
            style={{ maxWidth: '250px', width: 'fit-content', minWidth: 0 }}
          >
            <button
              className="absolute top-1 right-2 text-gray-500 hover:text-gray-700 text-xl leading-none"
              onClick={() => setSelectedPoint(null)}
            >
              ×
            </button>
            <h4 className="font-bold text-gray-800 mb-2">📍 Location Data</h4>
            <div className="text-sm space-y-1">
              <div><strong>Coordinates:</strong> {selectedPoint.latitude.toFixed(6)}, {selectedPoint.longitude.toFixed(6)}</div>
              <div><strong>Total Points:</strong> {selectedPoint.weight.toLocaleString()}</div>
              <div><strong>Unique Values:</strong> {selectedPoint.unique_values}</div>
              {propertyName && (
                <div><strong>Avg {propertyName}:</strong> {selectedPoint.avg_value?.toFixed(2)} {getUnit(propertyName)}</div>
              )}
              <div className="text-xs text-gray-600 mt-2">
                <strong>H3 Cell:</strong> <code className="text-xs">{selectedPoint.h3_id}</code>
              </div>
            </div>
          </div>
        </OverlayView>
      )}
    </>
  );
};

// Loading component
const LoadingOverlay: React.FC = () => (
  <div className="absolute inset-0 bg-gray-100 bg-opacity-75 flex items-center justify-center z-50">
    <div className="bg-white p-4 rounded-lg shadow-lg flex items-center space-x-3">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
      <span className="text-gray-700">Loading heatmap data...</span>
    </div>
  </div>
);

// Error component
const ErrorOverlay: React.FC<{ error: string }> = ({ error }) => (
  <div className="absolute inset-0 bg-gray-100 bg-opacity-75 flex items-center justify-center z-50">
    <div className="bg-white p-4 rounded-lg shadow-lg max-w-md">
      <div className="text-red-600 font-semibold mb-2">Error loading data</div>
      <div className="text-gray-700 text-sm">{error}</div>
    </div>
  </div>
);

// Main heatmap component
const TaxiHeatmap: React.FC<HeatmapProps> = ({
  center,
  zoom,
  propertyName,
  resolution = 9,
  className = '',
  googleMapsApiKey,
  onPropertyChange,
  onResolutionChange
}) => {
  const { data, loading, error } = useHeatmapData(propertyName, resolution);
  const [map, setMap] = useState<google.maps.Map | null>(null);

  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map);
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  const getMapTitle = () => {
    if (propertyName) {
      return `Taxi Data - ${propertyName.charAt(0).toUpperCase() + propertyName.slice(1)} Visualization`;
    }
    return 'Taxi Data - Activity Visualization';
  };

  const getUnit = (propertyName: string | null): string => {
    switch (propertyName) {
      case 'altitude': return 'm';
      case 'speed': return 'm/s';
      case 'azimuth': return '°';
      default: return '';
    }
  };

  const mapContainerStyle = {
    width: '100%',
    height: '100%'
  };

  return (
    <div className={`relative h-full w-full ${className}`}>
      <LoadScript googleMapsApiKey={googleMapsApiKey}>
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={center}
          zoom={zoom}
          onLoad={onLoad}
          onUnmount={onUnmount}
          options={{
            mapTypeControl: true,
            streetViewControl: true,
            fullscreenControl: true,
          }}
        >
          {/* CustomHeatmapOverlay disabled - using colored markers instead */}
          {/* <CustomHeatmapOverlay
            data={data}
            propertyName={propertyName}
            map={map}
          /> */}
          <InfoMarkers data={data} propertyName={propertyName} />
        </GoogleMap>
      </LoadScript>

      {/* Title overlay */}
      <div className="absolute top-4 left-4 bg-white bg-opacity-95 px-4 py-2 rounded-lg shadow-md z-10">
        <h3 className="text-sm font-semibold text-gray-800">{getMapTitle()}</h3>
        {data.length > 0 && (
          <p className="text-xs text-gray-600">
            {data.length} data points • Resolution: {resolution}
          </p>
        )}
      </div>

      {/* Property selection dropdown */}
      {onPropertyChange && (
        <div className="absolute top-4 right-4 bg-white bg-opacity-95 px-3 py-2 rounded-lg shadow-md z-10">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center space-x-2 text-sm font-medium text-gray-800 hover:text-gray-600 transition-colors">
              <span>
                {propertyName === null ? 'Count' : 
                 propertyName === 'altitude' ? 'Altitude' :
                 propertyName === 'speed' ? 'Speed' :
                 propertyName === 'azimuth' ? 'Azimuth' : 'Count'}
              </span>
              <ChevronDownIcon className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-32">
              <DropdownMenuItem 
                onClick={() => onPropertyChange(null)}
                className={propertyName === null ? 'bg-accent' : ''}
              >
                Count
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => onPropertyChange('altitude')}
                className={propertyName === 'altitude' ? 'bg-accent' : ''}
              >
                Altitude
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => onPropertyChange('speed')}
                className={propertyName === 'speed' ? 'bg-accent' : ''}
              >
                Speed
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => onPropertyChange('azimuth')}
                className={propertyName === 'azimuth' ? 'bg-accent' : ''}
              >
                Azimuth
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* Resolution selection dropdown */}
      {onResolutionChange && (
        <div className="absolute top-16 right-4 bg-white bg-opacity-95 px-3 py-2 rounded-lg shadow-md z-10">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center space-x-2 text-sm font-medium text-gray-800 hover:text-gray-600 transition-colors">
              <span>Resolution: {resolution}</span>
              <ChevronDownIcon className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-32">
              {Array.from({ length: 9 }, (_, i) => i + 6).map((res) => (
                <DropdownMenuItem 
                  key={res}
                  onClick={() => onResolutionChange(res)}
                  className={resolution === res ? 'bg-accent' : ''}
                >
                  {res}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* Legend */}
      {propertyName && data.length > 0 && (
        <div className="absolute bottom-4 right-4 bg-white bg-opacity-95 p-3 rounded-lg shadow-md z-10">
          <div className="text-xs font-semibold text-gray-800 mb-2">
            {propertyName.charAt(0).toUpperCase() + propertyName.slice(1)} {getUnit(propertyName)}
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-xs text-gray-600">Low</span>
            <div className="w-20 h-3 bg-gradient-to-r from-blue-500 via-green-500 via-yellow-500 to-red-500 rounded"></div>
            <span className="text-xs text-gray-600">High</span>
          </div>
          <div className="text-xs text-gray-500 mt-1">Colored markers show intensity</div>
        </div>
      )}

      {loading && <LoadingOverlay />}
      {error && <ErrorOverlay error={error} />}
    </div>
  );
};

export default TaxiHeatmap;