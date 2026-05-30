from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.database import router as database_router
from api.analysis import router as analysis_router
from api.plot import router as plot_router

app = FastAPI(title="ResApp API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(database_router)
app.include_router(analysis_router)
app.include_router(plot_router)
