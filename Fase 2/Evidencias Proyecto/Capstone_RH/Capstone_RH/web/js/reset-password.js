(function () {
  const params = new URLSearchParams(location.search);
  const token = params.get("token") || "";
  const emailParam = params.get("email") || "";

  const form = document.getElementById("resetForm");
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const confirmInput = document.getElementById("confirm");
  const tokenInput = document.getElementById("token");
  const submitBtn = document.getElementById("submitBtn");
  const status = document.getElementById("status");
  const message = document.getElementById("message");

  // Pre-fill token and email (if vienen en la URL)
  tokenInput.value = token;
  if (emailParam) emailInput.value = decodeURIComponent(emailParam);

  function showError(text) {
    message.innerHTML = "";
    message.className = "error";
    message.textContent = text;
  }
  function showSuccess(text) {
    message.innerHTML = "";
    message.className = "success";
    message.textContent = text;
  }
  function clearMessage() {
    message.textContent = "";
    message.className = "";
  }

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    clearMessage();

    if (!tokenInput.value) {
      showError(
        "Enlace inválido o caducado. Vuelve a solicitar restablecer la contraseña."
      );
      return;
    }

    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const confirm = confirmInput.value;

    if (!email) {
      showError("Introduce tu correo.");
      emailInput.focus();
      return;
    }
    if (password.length < 8) {
      showError("La contraseña debe tener al menos 8 caracteres.");
      passwordInput.focus();
      return;
    }
    if (password !== confirm) {
      showError("Las contraseñas no coinciden.");
      confirmInput.focus();
      return;
    }

    submitBtn.disabled = true;
    status.textContent = "Enviando...";

    try {
      // Ajusta esta URL al endpoint real de tu backend
      const res = await fetch("/api/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tokenInput.value, email, password }),
      });

      if (res.ok) {
        showSuccess(
          "Contraseña actualizada correctamente. Puedes iniciar sesión ahora."
        );
        status.textContent = "";
        // opcional: redirigir al login después de unos segundos
        setTimeout(() => (location.href = "/login"), 2000);
      } else {
        const data = await res
          .json()
          .catch(() => ({ message: "Error del servidor" }));
        showError(data.message || "No se pudo restablecer la contraseña.");
        status.textContent = "";
      }
    } catch (err) {
      showError("Error de red. Inténtalo de nuevo.");
      status.textContent = "";
    } finally {
      submitBtn.disabled = false;
    }
  });

  // Mejora: detectar enter en confirm para enviar
  confirmInput.addEventListener("keyup", function (e) {
    if (e.key === "Enter")
      form.dispatchEvent(new Event("submit", { cancelable: true }));
  });
})();
