from fastapi import FastAPI
from fastapi.responses import FileResponse
import os

app = FastAPI()

@app.get("/output.json")
def get_output_json():
    file_path = os.path.join(os.path.dirname(__file__), "output.json")
    return FileResponse(file_path, media_type="application/json")
