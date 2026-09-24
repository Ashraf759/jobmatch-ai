from fastapi import FastAPI

app = FastAPI(
    title="JobMatch AI API",
    description="Backend API for the JobMatch AI capstone project",
    version="0.1.0"
)


@app.get("/")
def root():
    return {
        "project": "JobMatch AI",
        "status": "Initial project setup complete"
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy"
    }
