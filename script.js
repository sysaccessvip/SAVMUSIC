/* script.js
   Carga un script alojado en Requestly mediante fetch y lo ejecuta como Blob.
   - Modifica REQUESTLY_URL con la URL pública/de mock de Requestly.
   - Si usas autorización, pon AUTH_TOKEN (Bearer).
   - Si quieres validar integridad, pon EXPECTED_HASH_BASE64 (SHA-256 en base64).
*/

(function () {
  if (window.__requestlyScriptLoaded__) return;
  window.__requestlyScriptLoaded__ = true;

  // ---------- CONFIGURACIÓN ----------
  const REQUESTLY_URL = "https://requestly.tech/api/mockv2/adsadasdasda?teamId=OjRcegvLAH9eIebu8vbP"; // <-- pon aquí tu URL de Requestly
  const AUTH_TOKEN = null; // <-- si necesitas enviar Authorization: Bearer <token> ponlo aquí, ej "mi.jwt.token"
  const EXPECTED_HASH_BASE64 = null; // <-- si quieres validar integridad pon SHA-256 en base64, ej "AbCdEf...=="
  const FETCH_TIMEOUT_MS = 15_000; // timeout fetch en ms
  const MAX_RETRIES = 1; // reintentos en fallo (0 = sin reintentos)

  // ---------- UTILIDADES ----------
  function fetchWithTimeout(url, opts = {}, timeout = FETCH_TIMEOUT_MS) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Fetch timeout")), timeout);
      fetch(url, opts)
        .then(res => {
          clearTimeout(timer);
          resolve(res);
        })
        .catch(err => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }

  async function sha256Base64(text) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const binary = hashArray.map(b => String.fromCharCode(b)).join("");
    return btoa(binary);
  }

  function createAndRunScriptFromCode(code, filenameHint = "remote-script.js") {
    const blob = new Blob([code], { type: "text/javascript" });
    const blobUrl = URL.createObjectURL(blob);
    const script = document.createElement("script");
    script.src = blobUrl;
    script.async = false; // mantener orden si hay varios
    script.dataset.loadedFrom = filenameHint;
    // cuando cargue, liberamos el blob
    script.onload = () => {
      try { URL.revokeObjectURL(blobUrl); } catch (e) { /* noop */ }
    };
    script.onerror = (e) => {
      console.error("Error cargando el script blob:", e);
      try { URL.revokeObjectURL(blobUrl); } catch (err) { /* noop */ }
    };
    document.head.appendChild(script);
  }

  // ---------- CARGA PRINCIPAL ----------
  async function loadRemoteScript(retries = 0) {
    try {
      const headers = {};
      if (AUTH_TOKEN) headers["Authorization"] = `Bearer ${AUTH_TOKEN}`;
      // opcional: forzar no-cache si quieres siempre la versión más reciente
      headers["Cache-Control"] = "no-cache";

      const res = await fetchWithTimeout(REQUESTLY_URL, {
        method: "GET",
        headers,
        credentials: "omit" // ajusta si necesitas cookies: 'include'
      });

      if (res.status === 401 || res.status === 403) {
        throw new Error(`No autorizado al obtener el script (${res.status})`);
      }
      if (!res.ok) {
        throw new Error(`Error al cargar script: ${res.status} ${res.statusText}`);
      }

      const code = await res.text();

      // Si se proveyó hash esperado, verificar integridad
      if (EXPECTED_HASH_BASE64) {
        const gotHash = await sha256Base64(code);
        if (gotHash !== EXPECTED_HASH_BASE64) {
          throw new Error("Integridad fallida: hash SHA-256 no coincide");
        }
      }

      // Ejecutar el script de forma segura (Blob -> script.src)
      createAndRunScriptFromCode(code, REQUESTLY_URL);
      console.info("Script remoto cargado y ejecutado desde:", REQUESTLY_URL);

    } catch (err) {
      console.error("Fallo al cargar el script remoto:", err);
      if (retries < MAX_RETRIES) {
        console.warn(`Reintentando... (${retries + 1}/${MAX_RETRIES})`);
        await new Promise(r => setTimeout(r, 700 * (retries + 1)));
        return loadRemoteScript(retries + 1);
      }
      // en caso de fallo definitivo, opcional: fallback local o notificación
      // createAndRunScriptFromCode("console.warn('fallback script');");
    }
  }

  // Ejecutar
  loadRemoteScript();
})();
