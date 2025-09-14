from typing import Optional
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi import Query
from fastapi.middleware.cors import CORSMiddleware
from cachetools import TTLCache
import hashlib
import json

from lib.h3_hex import h3_aggregate
from lib.data import get_data

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://indrive.abzy.kz",
        "https://indrive-case2.vercel.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize cache with TTL (Time To Live) of 1 hour (3600 seconds)
# Cache can hold up to 100 entries
cache = TTLCache(maxsize=100, ttl=3600)


def generate_cache_key(col_name: Optional[str], resolution: int) -> str:
    """Generate a unique cache key based on query parameters."""
    # Create a dictionary with the parameters and sort keys for consistent hashing
    params = {
        "col_name": col_name,
        "resolution": resolution
    }
    # Convert to JSON string and hash it
    params_str = json.dumps(params, sort_keys=True)
    return hashlib.md5(params_str.encode()).hexdigest()


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
    
    # Generate cache key based on query parameters
    cache_key = generate_cache_key(col_name, resolution)
    
    # Check if result is already cached
    if cache_key in cache:
        return JSONResponse(content=cache[cache_key], status_code=200)
    
    # If not cached, compute the result
    df = get_data()
    result = h3_aggregate(df, col_name, resolution)
    
    # Store result in cache
    cache[cache_key] = result
    
    return JSONResponse(content=result, status_code=200)


@app.get("/cache/info")
def get_cache_info():
    """Get information about the current cache state."""
    return {
        "cache_size": len(cache),
        "max_size": cache.maxsize,
        "ttl_seconds": cache.ttl,
        "cached_keys": list(cache.keys())
    }


@app.delete("/cache/clear")
def clear_cache():
    """Clear all cached entries."""
    cache.clear()
    return {"message": "Cache cleared successfully"}
