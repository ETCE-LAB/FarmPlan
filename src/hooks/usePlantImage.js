// src/hooks/usePlantImage.js
// Fetches a single plant image record from /api/plant-images/<sourceId>
// Returns { image, isLoading, error }
// image shape: { image_url, source_page_url, license_name, license_url, author_name, author_url }

import { useEffect, useState } from 'react';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

// Simple in-memory cache so we don't re-fetch the same image on every render
const _cache = new Map();

export function usePlantImage(sourceId) {
  const [image, setImage]     = useState(_cache.get(sourceId) ?? null);
  const [isLoading, setLoading] = useState(!_cache.has(sourceId) && Boolean(sourceId));
  const [error, setError]     = useState('');

  useEffect(() => {
    if (!sourceId) return;
    if (_cache.has(sourceId)) {
      setImage(_cache.get(sourceId));
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError('');

    fetch(`${BASE_URL}/api/plant-images/${encodeURIComponent(sourceId)}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        if (data.status === 'ok' && data.image?.image_url) {
          _cache.set(sourceId, data.image);
          setImage(data.image);
        } else {
          // Not found or pending — cache null so we stop retrying
          _cache.set(sourceId, null);
          setImage(null);
        }
      })
      .catch(() => {
        if (!cancelled) setError('image unavailable');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [sourceId]);

  return { image, isLoading, error };
}