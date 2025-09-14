import h3
import pandas as pd

def h3_aggregation(data, resolution=10):
    """
    resolution: 0-15, where higher = more granular
    8 = ~460m hexagons, 9 = ~170m hexagons
    """
    # Convert coordinates to H3 hexagons
    data['h3_hex'] = data.apply(
        lambda row: h3.latlng_to_cell(row['lat'], row['lng'], resolution), 
        axis=1
    )
    
    # Aggregate by hexagon
    aggregated = data.groupby('h3_hex').agg({
        'randomized_id': ['count', 'nunique'],
        'spd': 'mean'
    }).reset_index()
    
    # Flatten column names
    aggregated.columns = ['h3_hex', 'randomized_id_count', 'randomized_id_nunique', 'spd']
    
    # Convert back to lat/lon for frontend
    result = []
    for _, row in aggregated.iterrows():
        lat, lon = h3.cell_to_latlng(row['h3_hex'])
        result.append({
            "lat": lat,
            "lon": lon,
            "weight": row['randomized_id_count'],
            "avg_speed": row['spd'],
            "unique_rides": row['randomized_id_nunique'],
            "h3_id": row['h3_hex']
        })
    
    return result

def main():
    df = pd.read_csv("../data/geo_locations_astana_hackathon.csv")
    df["h3_hex"] = df.apply(
        lambda row: h3.latlng_to_cell(row['lat'], row['lng'], 10),
        axis=1
    )

    result = h3_aggregation(df, resolution=10)
    import json
    with open("output.json", "w", encoding="utf-8") as f:
        json.dump(result, f)
    print(result)

if __name__ == "__main__":
    main()