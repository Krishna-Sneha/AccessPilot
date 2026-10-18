from pathlib import Path
import re
import math
import os
import requests
from dotenv import load_dotenv
from google import genai

load_dotenv(Path(__file__).resolve().parent / ".env")

DOCS_DIR = Path(__file__).resolve().parent / "data" / "docs"
GEMINI_EMBED_MODEL = os.getenv("GEMINI_EMBED_MODEL", "gemini-embedding-001")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_CLIENT = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None


def load_documents():
    documents = []

    for path in DOCS_DIR.glob("*.md"):
        text = path.read_text(encoding="utf-8")

        sections = re.split(r"\n(?=## )", text)

        for section in sections:
            section = section.strip()

            if len(section) > 80:
                documents.append({
                    "source": path.name,
                    "text": section,
                })

    return documents

def create_embedding(text):
    if GEMINI_CLIENT:
        result = GEMINI_CLIENT.models.embed_content(
            model=GEMINI_EMBED_MODEL,
            contents=text,
        )
        return result.embeddings[0].values

    response = requests.post(
        "http://localhost:11434/api/embeddings",
        json={
            "model": "nomic-embed-text:latest",
            "prompt": text,
        },
        timeout=60,
    )

    response.raise_for_status()
    return response.json()["embedding"]


def cosine_similarity(first, second):
    dot_product = sum(a * b for a, b in zip(first, second))

    first_length = math.sqrt(sum(value * value for value in first))
    second_length = math.sqrt(sum(value * value for value in second))

    if first_length == 0 or second_length == 0:
        return 0

    return dot_product / (first_length * second_length)


def search_documents(query, documents, top_k=3):
    query_embedding = create_embedding(query)
    results = []

    for document in documents:
        document_embedding = create_embedding(document["text"])

        score = cosine_similarity(
            query_embedding,
            document_embedding,
        )

        results.append({
            "source": document["source"],
            "text": document["text"],
            "score": score,
        })

    results.sort(
        key=lambda item: item["score"],
        reverse=True,
    )

    return results[:top_k]


if __name__ == "__main__":
    documents = load_documents()

    results = search_documents(
        "I need to push code and create merge requests",
        documents,
    )

    for result in results:
        print("\n---")
        print("Source:", result["source"])
        print("Score:", round(result["score"], 3))
        print(result["text"][:300])
