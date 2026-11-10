import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchNearbyCities } from './cityApi';

const storage = new Map();
beforeEach(() => {
  storage.clear();
  vi.stubGlobal('localStorage', {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  });
  vi.restoreAllMocks();
});
describe('ciudades cercanas', () => {
  it('consulta el proxy y reutiliza la respuesta en caché', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ data: [{ id: 123, name: 'Ejemplo', latitude: 39.5, longitude: -6.5, population: 100 }], meta: { has_more: true } }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const first = await fetchNearbyCities(39.48, -6.48, new AbortController().signal);
    const second = await fetchNearbyCities(39.49, -6.49, new AbortController().signal);
    const url = fetchMock.mock.calls[0][0];
    expect(url.origin + url.pathname).toBe('https://alon.one/api/trainworld/nearby');
    expect(url.searchParams.get('lat')).toBe('39.5');
    expect(url.searchParams.get('lng')).toBe('-6.5');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(first.cities[0].id).toBe('123');
    expect(second.cached).toBe(true);
    expect(second.limited).toBe(true);
  });
  it('informa de errores sin guardar respuestas fallidas', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 502 }));
    await expect(fetchNearbyCities(0, 0, new AbortController().signal)).rejects.toThrow('502');
    expect(storage.size).toBe(0);
  });
});
