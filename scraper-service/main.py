import os
import asyncio
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeoutError

app = FastAPI(title="ERP V6 Scraper Service", description="Headless browser rendering service for ERP V6")

# Semaforo per limitare la concorrenza dei rendering (parametrizzabile via env var)
MAX_CONCURRENT_RENDERS = int(os.getenv("MAX_CONCURRENT_RENDERS", "3"))
render_semaphore = asyncio.Semaphore(MAX_CONCURRENT_RENDERS)


@app.get("/health")
async def health_check():
    """Healthcheck endpoint per Docker."""
    return {"status": "ok"}


@app.post("/render")
async def render_url(request: dict):
    """
    Renderizza una URL usando Chromium headless e ritorna l'HTML completo.
    
    Request body:
    - url: str (required) - URL da navigare
    - wait_for: str (optional, default "networkidle") - condizione di attesa
    - timeout_ms: int (optional, default 15000) - timeout in millisecondi
    
    Response:
    - html: str - contenuto HTML renderizzato
    - status: int - status code HTTP
    - final_url: str - URL finale dopo eventuali redirect
    
    In caso di errore:
    - error: str - messaggio di errore
    """
    url = request.get("url")
    if not url:
        raise HTTPException(status_code=400, detail="Missing required field: url")
    
    wait_for = request.get("wait_for", "networkidle")
    timeout_ms = request.get("timeout_ms", 15000)
    
    # Acquisisci il semaforo per limitare la concorrenza
    async with render_semaphore:
        try:
            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=True)
                context = await browser.new_context(
                    viewport={"width": 1920, "height": 1080},
                    user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
                )
                page = await context.new_page()
                
                try:
                    # Naviga all'URL con timeout
                    response = await page.goto(
                        url,
                        wait_until=wait_for,
                        timeout=timeout_ms
                    )
                    
                    # Attendi un breve momento per assicurarsi che tutto sia caricato
                    await asyncio.sleep(0.5)
                    
                    # Ottieni il contenuto HTML
                    html = await page.content()
                    
                    # Ottieni status e URL finale
                    status = response.status if response else 0
                    final_url = page.url
                    
                    await browser.close()
                    
                    return {
                        "html": html,
                        "status": status,
                        "final_url": final_url
                    }
                    
                except PlaywrightTimeoutError:
                    await browser.close()
                    return JSONResponse(
                        status_code=500,
                        content={"error": f"Timeout after {timeout_ms}ms while loading {url}"}
                    )
                except Exception as e:
                    await browser.close()
                    return JSONResponse(
                        status_code=500,
                        content={"error": f"Error rendering {url}: {str(e)}"}
                    )
                    
        except Exception as e:
            return JSONResponse(
                status_code=500,
                content={"error": f"Failed to initialize browser: {str(e)}"}
            )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8090)
