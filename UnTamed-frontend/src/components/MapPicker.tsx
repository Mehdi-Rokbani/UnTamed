    // src/components/MapPicker.tsx
    import { useMemo } from "react";
    import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";
    import L, { type LeafletMouseEvent } from "leaflet";
    import "leaflet/dist/leaflet.css";

    // Fix Leaflet default marker icons in Vite/modern bundlers
    delete (L.Icon.Default.prototype as any)._getIconUrl;

    L.Icon.Default.mergeOptions({
    iconRetinaUrl: new URL("leaflet/dist/images/marker-icon-2x.png", import.meta.url).toString(),
    iconUrl: new URL("leaflet/dist/images/marker-icon.png", import.meta.url).toString(),
    shadowUrl: new URL("leaflet/dist/images/marker-shadow.png", import.meta.url).toString(),
    });

    type Props = {
    center: { lat: number; lon: number };
    marker?: { lat: number; lon: number } | null;
    onPick: (lat: number, lon: number) => void;
    height?: number;
    zoom?: number;
    };

    function ClickHandler({ onPick }: { onPick: (lat: number, lon: number) => void }) {
    useMapEvents({
        click(e: LeafletMouseEvent) {
        onPick(e.latlng.lat, e.latlng.lng);
        },
    });
    return null;
    }

    export default function MapPicker({
    center,
    marker = null,
    onPick,
    height = 260,
    zoom = 11,
    }: Props) {
    const centerPos = useMemo(() => [center.lat, center.lon] as [number, number], [center.lat, center.lon]);
    const markerPos = marker ? ([marker.lat, marker.lon] as [number, number]) : null;

    return (
        <div
        style={{
            borderRadius: 14,
            overflow: "hidden",
            border: "1px solid rgba(0,0,0,0.12)",
            background: "rgba(255,255,255,0.02)",
        }}
        >
        <MapContainer center={centerPos} zoom={zoom} style={{ height, width: "100%" }}>
            <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap contributors"
            />
            <ClickHandler onPick={onPick} />
            {markerPos && <Marker position={markerPos} />}
        </MapContainer>

        <div style={{ padding: 10, fontSize: 12, opacity: 0.85 }}>
            Click on the map to choose a location (pin).
        </div>
        </div>
    );
    }
