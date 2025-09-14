from typing import Optional
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi import Query

from lib.h3_hex import h3_aggregate
from lib.data import get_data

app = FastAPI()


@app.get("/")
def read_root():
    return {"message": "Hello, from backend!"}


@app.get("/heatmap")
def get_h3_hex(
    col_name: Optional[str] = Query(
        None,
        description="Column to aggregate by. Must be one of: 'altitude', 'speed', 'azimuth', or None.",
        enum=["altitude", "speed", "azimuth", None],
    ),
    resolution: int = 10,
):
    allowed_cols = {"altitude", "speed", "azimuth", None}
    col_name = None if col_name in ["None", "null"] else col_name
    if col_name not in allowed_cols:
        return JSONResponse(
            content={
                "error": "Invalid col_name. Must be one of: 'altitude', 'speed', 'azimuth', or None."
            },
            status_code=400,
        )
    df = get_data()
    result = h3_aggregate(df, col_name, resolution)
    return JSONResponse(content=result, status_code=200)
