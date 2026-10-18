import json
import os
import requests

from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from google import genai
try:
    from .rag import load_documents, search_documents
except ImportError:
    from rag import load_documents, search_documents

load_dotenv(Path(__file__).resolve().parent / ".env")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
print(f"GEMINI KYE: {GEMINI_API_KEY}")
AI_PROVIDER = "gemini" if GEMINI_API_KEY else "ollama"
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")

app = FastAPI(title="AccessPilot API", version="0.2.0")
RAG_DOCUMENTS = load_documents()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Demonstration catalog. These are sample organization roles, not a promise of
# the exact permissions in every customer's GitLab, Jira, or Confluence setup.
APPLICATIONS = [
    {
        "id": "gitlab", "name": "GitLab", "category": "Developer tools", "icon": "GL",
        "description": "Source code, projects and CI/CD pipelines", "members": "2,840",
        "projects": ["Phoenix platform", "Atlas web", "Horizon mobile"],
        "roles": [
            {"name": "Guest", "description": "View issues and contribute to discussions", "level": "Basic"},
            {"name": "Reporter", "description": "Read code, pipelines and project activity", "level": "Standard"},
            {"name": "Developer", "description": "Push code and create merge requests", "level": "Elevated"},
            {"name": "Maintainer", "description": "Manage project settings, CI/CD and members", "level": "Privileged"},
            {"name": "Owner", "description": "Full control of a group or project, including membership", "level": "Privileged"},
        ],
    },
    {
        "id": "jira", "name": "Jira", "category": "Planning", "icon": "JR",
        "description": "Track work, projects and delivery", "members": "1,620",
        "projects": ["Payments modernization", "Customer portal", "Internal tooling"],
        "roles": [
            {"name": "Viewer", "description": "Browse projects and issues", "level": "Basic"},
            {"name": "User", "description": "Create and update issues", "level": "Standard"},
            {"name": "Developer", "description": "Work across project boards and sprints", "level": "Elevated"},
            {"name": "Administrator", "description": "Configure projects, workflows and access", "level": "Privileged"},
        ],
    },
    {
        "id": "confluence", "name": "Confluence", "category": "Knowledge", "icon": "CF",
        "description": "Create and share team knowledge", "members": "980",
        "projects": ["Engineering handbook", "Product playbook", "Onboarding hub"],
        "roles": [
            {"name": "Viewer", "description": "Read pages in an assigned space", "level": "Basic"},
            {"name": "Collaborator", "description": "Create and edit pages", "level": "Standard"},
            {"name": "Manager", "description": "Manage space content and settings", "level": "Elevated"},
        ],
    },
]
REQUESTS = [
    {"id": "AP-1048", "application": "GitLab", "role": "Developer", "project": "Phoenix platform", "reason": "Contribute code to the platform release", "status": "Pending", "created_at": "2026-10-16T10:20:00+00:00"},
    {"id": "AP-1032", "application": "Jira", "role": "User", "project": "Payments modernization", "reason": "Manage sprint tickets for my team", "status": "Approved", "created_at": "2026-10-14T08:45:00+00:00"},
    {"id": "AP-1019", "application": "Confluence", "role": "Collaborator", "project": "Engineering handbook", "reason": "Update onboarding documentation", "status": "Approved", "created_at": "2026-10-12T13:10:00+00:00"},
]


class RecommendationInput(BaseModel):
    application: str
    question: str = Field(min_length=3, max_length=1000)


class AccessRequestInput(BaseModel):
    application: str
    role: str
    project: str = Field(min_length=2, max_length=120)
    reason: str = Field(min_length=5, max_length=1000)


@app.get("/api/applications")
def list_applications():
    return APPLICATIONS


@app.get("/api/requests")
def list_requests():
    return sorted(REQUESTS, key=lambda item: item["created_at"], reverse=True)


# @app.post("/api/recommend-role")
# def recommend_role(payload: RecommendationInput):
#     application = next((item for item in APPLICATIONS if item["name"].lower() == payload.application.lower() or item["id"] == payload.application.lower()), None)
#     if not application:
#         raise HTTPException(status_code=404, detail="Application not found")

#     question = payload.question.lower()
#     if application["id"] == "gitlab":
#         rules = [
#             (("admin", "settings", "manage members", "configure", "pipeline", "ci/cd", "deploy"), "Maintainer", "Your work involves project configuration or managing CI/CD and deployments."),
#             (("push", "merge request", "commit", "write code", "develop", "contribute code"), "Developer", "You need to contribute code and collaborate through merge requests."),
#             (("read", "clone", "view code", "browse", "review"), "Reporter", "Read access covers browsing code and project activity."),
#         ]
#     elif application["id"] == "jira":
#         rules = [
#             (("admin", "workflow", "configure", "settings", "permissions"), "Administrator", "Your work requires project configuration or access management."),
#             (("sprint", "board", "develop", "manage issues", "edit issues", "create", "update"), "User", "The User role supports creating and updating work items."),
#             (("read", "view", "browse"), "Viewer", "The Viewer role supports browsing projects and issues."),
#         ]
#     else:
#         rules = [
#             (("admin", "settings", "manage space", "permissions"), "Manager", "Your work involves managing a space or its settings."),
#             (("edit", "write", "create", "update", "contribute"), "Collaborator", "The Collaborator role supports creating and editing pages."),
#             (("read", "view", "browse"), "Viewer", "The Viewer role provides read access to an assigned space."),
#         ]

#     for keywords, role, reason in rules:
#         if any(keyword in question for keyword in keywords):
#             return {"application": application["name"], "recommended_role": role, "reason": reason, "confidence": "High", "source": "AccessPilot demo role catalog", "demo": True}

#     return {"application": application["name"], "recommended_role": application["roles"][1]["name"], "reason": "Your request could fit more than one access level. This starting suggestion follows least privilege; add more detail or check with your application owner.", "confidence": "Needs review", "source": "AccessPilot demo role catalog", "demo": True}

@app.post("/api/recommend-role")
def recommend_role(payload: RecommendationInput):
    application = next(
        (
            item for item in APPLICATIONS
            if item["name"].lower() == payload.application.lower()
            or item["id"] == payload.application.lower()
        ),
        None,
    )

    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    roles_text = "\n".join(
        f"- {role['name']}: {role['description']}"
        for role in application["roles"]
    )

    # Keep retrieval inside the selected application's documentation. This
    # prevents a Jira or Confluence role from being recommended for GitLab.
    document_by_application = {
        "gitlab": "gitlab_roles.md",
        "jira": "jira_permissions.md",
        "confluence": "confluence_roles.md",
    }
    allowed_source = document_by_application.get(application["id"])
    application_documents = [
        document
        for document in RAG_DOCUMENTS
        if allowed_source and document["source"].lower() == allowed_source
    ]
    relevant_documents = search_documents(payload.question, application_documents, top_k=3) if application_documents else []

    context = "\n\n".join(
        f"Source: {document['source']}\n{document['text']}"
        for document in relevant_documents
    ) or "No external document is available. Use the application role catalog only."

    prompt = f"""
    You are AccessPilot, an enterprise access assistant.

    Application: {application["name"]}

    Available roles:
    {roles_text}

    Relevant documentation:
    {context}

    User request:
    {payload.question}

    Choose the least-privileged suitable role.
    You must choose only one of these exact role names:
    {", ".join(role["name"] for role in application["roles"])}

    Return only valid JSON in exactly this format:
    {{
    "summary": "one sentence describing what the user is trying to do",
    "recommended_role": "role name",
    "reason": "explain specifically how this role supports the request",
    "confidence": "High"
    }}
    """

    try:
        if AI_PROVIDER == "gemini":
            client = genai.Client(api_key=GEMINI_API_KEY)
            try:
                response = client.models.generate_content(model=GEMINI_MODEL, contents=prompt)
                model_output = response.text
            except Exception as gemini_error:
                if "503" not in str(gemini_error) and "UNAVAILABLE" not in str(gemini_error):
                    raise
                # Gemini capacity can fluctuate; keep the assistant available through Ollama.
                response = requests.post(
                    "http://localhost:11434/api/generate",
                    json={"model": "llama3.2:3b", "prompt": prompt, "stream": False, "format": "json"},
                    timeout=120,
                )
                response.raise_for_status()
                model_output = response.json()["response"]
        else:
            response = requests.post(
                "http://localhost:11434/api/generate",
                json={
                    "model": "llama3.2:3b",
                    "prompt": prompt,
                    "stream": False,
                    "format": "json",
                },
                timeout=120,
            )
            response.raise_for_status()
            model_output = response.json()["response"]

        recommendation = json.loads(model_output)

        allowed_roles = {role["name"] for role in application["roles"]}
        recommended_role = recommendation.get("recommended_role", "")
        if recommended_role not in allowed_roles:
            recommended_role = application["roles"][1]["name"]

        return {
            "application": application["name"],
            "summary": recommendation.get("summary", f"You want to: {payload.question}"),
            "recommended_role": recommended_role,
            "reason": recommendation["reason"],
            "confidence": recommendation.get("confidence", "High"),
            "source" : recommendation.get("source", relevant_documents[0]["source"] if relevant_documents else "AccessPilot role catalog"),
            "demo": False,
        }

    except Exception as error:
        raise HTTPException(
            status_code=502,
            detail=f"AI request failed: {error}",
        )

@app.post("/api/requests", status_code=201)
def create_request(payload: AccessRequestInput):
    application = next((item for item in APPLICATIONS if item["name"].lower() == payload.application.lower()), None)
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    if not any(role["name"] == payload.role for role in application["roles"]):
        raise HTTPException(status_code=400, detail="That role is not available for this application")
    request = {
        "id": f"AP-{1000 + len(REQUESTS) + 1}", "application": application["name"],
        "role": payload.role, "project": payload.project.strip(), "reason": payload.reason.strip(),
        "status": "Pending", "created_at": datetime.now(timezone.utc).isoformat(),
    }
    REQUESTS.insert(0, request)
    return request


@app.get("/health")
def health():
    return {"status": "UP"}


@app.get("/api")
def api_info():
    return {"message": "AccessPilot API is running"}


frontend_dir = Path(__file__).resolve().parent.parent / "frontend"
if frontend_dir.is_dir():
    app.mount("/", StaticFiles(directory=str(frontend_dir), html=True), name="frontend")
