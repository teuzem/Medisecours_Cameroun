import type { Request, Response } from "express";
import { sdk } from "../_core/sdk";
import { runFacilityDiscoverySync } from "../services/placesSync";

export async function facilitySyncHandler(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
    const result = await runFacilityDiscoverySync();
    return res.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    return res.status(500).json({
      error: message,
      timestamp: new Date().toISOString(),
      context: { url: req.originalUrl },
    });
  }
}
