from fastapi import FastAPI

app = FastAPI(title="拼豆图纸标准转换")


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "mode": "local"}
