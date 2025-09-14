import h3
import pandas as pd


def h3_aggregate(
    data: pd.DataFrame, col_name=str | None, resolution: int = 10
) -> list[dict]:
    """
    data: the data to aggregate (must have id, lat, lng, and <col_name> if provided)
    col_name: the column name to aggregate by (if None, only counts are used)
    resolution: 0-15, where higher = more granular
    8 = ~460m hexagons, 9 = ~170m hexagons
    """

    # Convert coordinates to H3 hexagons
    data["h3_hex"] = data.apply(
        lambda row: h3.latlng_to_cell(row["latitude"], row["longitude"], resolution),
        axis=1,
    )

    # Build aggregation dictionary
    agg_dict = {"id": ["count", "nunique"]}
    if col_name is not None:
        agg_dict[col_name] = "mean"

    # Aggregate by hexagon
    aggregated = data.groupby("h3_hex").agg(agg_dict).reset_index()

    # Flatten column names
    flat_columns = ["h3_hex", "id_count", "id_nunique"]
    if col_name is not None:
        flat_columns.append(col_name)
    aggregated.columns = flat_columns

    # Convert back to lat/lon for frontend
    result = []
    for _, row in aggregated.iterrows():
        lat, lon = h3.cell_to_latlng(row["h3_hex"])
        entry = {
            "latitude": lat,
            "longitude": lon,
            "weight": row["id_count"],
            "unique_values": row["id_nunique"],
            "h3_id": row["h3_hex"],
        }
        if col_name is not None:
            entry["avg_value"] = row[col_name]
        result.append(entry)

    return result
