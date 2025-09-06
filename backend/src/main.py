from fastapi import FastAPI
from routes import router
import uvicorn
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"]
)
app.include_router(router)

if __name__ == "__main__":
    uvicorn.run("main:app", reload=True)
