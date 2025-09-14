import pandas as pd

def get_data() -> pd.DataFrame:
    df = pd.read_csv("../data/geo_locations_astana_hackathon.csv")
    df = df.rename(columns={
        "randomized_id": "id",
        "lat": "latitude",
        "lng": "longitude",
        "alt": "altitude",
        "spd": "speed",
        "azm": "azimuth"
    })
    return df