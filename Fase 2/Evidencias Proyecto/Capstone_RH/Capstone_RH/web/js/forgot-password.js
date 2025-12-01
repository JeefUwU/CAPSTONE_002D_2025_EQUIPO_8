// forgot-password.html
// Comportamiento:
// - Valida el email en el cliente
// - Hace POST a /api/send-reset (debes implementar este endpoint en tu servidor)
// - Muestra mensajes de estado al usuario
//
// Alternativa: Si usas Firebase Auth puedes usar sendPasswordResetEmail (comentado abajo).

const form = document.getElementById("forgotForm");
const emailInput = document.getElementById("email");
const statusEl = document.getElementById("status");
const btn = document.getElementById("sendBtn");

function setStatus(text, type) {
  statusEl.textContent = text;
  statusEl.className = "msg " + (type || "");
}

function isValidEmail(email) {
  // simple email regex
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  setStatus("", "");
  const email = emailInput.value.trim();
  if (!isValidEmail(email)) {
    setStatus("Introduce un correo válido.", "error");
    return;
  }

  btn.disabled = true;
  btn.textContent = "Enviando...";

  try {
    // Cambia la URL por la de tu backend que envía el correo de reseteo.
    // El endpoint debe aceptar JSON { email: "..." } y devolver { ok: true } o un error.
    const res = await fetch("/api/send-reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    if (!res.ok) {
      // intentar leer mensaje de error del servidor
      let errText = "Error al enviar. Intenta nuevamente.";
      try {
        const j = await res.json();
        if (j && j.message) errText = j.message;
      } catch {}
      throw new Error(errText);
    }

    // Opcional: respuesta JSON con detalles
    const data = await res.json().catch(() => ({}));
    setStatus(data.message || "Enlace enviado. Revisa tu correo.", "success");
  } catch (err) {
    setStatus(err.message || "No se pudo enviar el enlace.", "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Enviar enlace";
  }
});
