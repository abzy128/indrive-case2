# InDrive: Case 2

Visit: [https://indrive.abzy.kz](https://indrive.abzy.kz)

## How to run

### Prerequisites:

- Docker
- Docker Compose
- Bun

### Backend

```bash
docker compose up -d
```

### Frontend
1. Install dependencies
```bash
cd front
bun install
```
2. Setup environment variables
```ini
NEXT_PUBLIC_API_URL=http://localhost:12002
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=<YOUR_GOOGLE_MAPS_API_KEY>
```

3. Run the development server
```bash
bun run dev
```
