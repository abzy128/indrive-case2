FROM python:3.13-slim

WORKDIR /app

COPY . /app

RUN pip install --upgrade pip && pip install .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
