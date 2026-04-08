"use client";

import { useState, useEffect, useCallback } from "react";
import { api, type Asset } from "@/lib/api";

export function useAssets(orgId: string) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAssets = useCallback(
    async (params?: { type?: string; search?: string }) => {
      if (!orgId) return;
      setLoading(true);
      try {
        const result = await api.getAssets(orgId, params);
        setAssets(result.data);
        setTotal(result.total);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to fetch assets");
      } finally {
        setLoading(false);
      }
    },
    [orgId]
  );

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  const createAsset = async (data: { type: string; value: string; label?: string; tags?: string[] }) => {
    const newAsset = await api.createAsset(orgId, data);
    setAssets((prev) => [newAsset, ...prev]);
    setTotal((prev) => prev + 1);
    return newAsset;
  };

  const deleteAsset = async (assetId: string) => {
    await api.deleteAsset(orgId, assetId);
    setAssets((prev) => prev.filter((a) => a.id !== assetId));
    setTotal((prev) => prev - 1);
  };

  return { assets, total, loading, error, fetchAssets, createAsset, deleteAsset };
}
