import type { Request, Response } from "express";
import { ENV } from "./_core/env";

export async function placePhotoHandler(req: Request, res: Response) {
  const reference = typeof req.query.reference === "string" ? req.query.reference : "";
  const requestedWidth = Number(req.query.maxWidth);
  const maxWidth = Number.isFinite(requestedWidth) ? Math.min(Math.max(Math.round(requestedWidth), 200), 1600) : 1200;

  if (!reference || reference.length > 4096) {
    res.status(400).json({ error: "Référence photo invalide." });
    return;
  }
  if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
    res.status(503).json({ error: "Proxy cartographique indisponible." });
    return;
  }

  const baseUrl = ENV.forgeApiUrl.replace(/\/+$/, "");
  const url = new URL(`${baseUrl}/v1/maps/proxy/maps/api/place/photo`);
  url.searchParams.set("key", ENV.forgeApiKey);
  url.searchParams.set("maxwidth", String(maxWidth));
  url.searchParams.set("photoreference", reference);

  try {
    const upstream = await fetch(url);
    if (!upstream.ok) {
      const body = await upstream.text();
      res.status(upstream.status).type(upstream.headers.get("content-type") || "application/json").send(body);
      return;
    }
    const contentType = upstream.headers.get("content-type") || "image/jpeg";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.status(200).send(Buffer.from(await upstream.arrayBuffer()));
  } catch (error) {
    console.error("[Places] Photo relay failed", error);
    res.status(502).json({ error: "Photo Places temporairement indisponible." });
  }
}
