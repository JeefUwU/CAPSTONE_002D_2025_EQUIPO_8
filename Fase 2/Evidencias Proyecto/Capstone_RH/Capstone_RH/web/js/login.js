import { API_BASE_URL } from './config.js';

(function () {
  const form = document.getElementById("loginForm");
  const email = document.getElementById("email");
  const password = document.getElementById("password");
  const submitBtn = document.getElementById("submitBtn");
  const err = document.getElementById("formError");
  const toggle = document.getElementById("togglePass");

  toggle.addEventListener("click", () => {
    const showing = password.type === "text";
    password.type = showing ? "password" : "text";
    toggle.textContent = showing ? "Mostrar" : "Ocultar";
  });

  function showError(message) {
    err.textContent = message;
    err.style.display = "block";
  }

  function clearError() {
    err.textContent = "";
    err.style.display = "none";
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearError();

    if (!email.checkValidity()) {
      showError("Introduce un correo válido.");
      email.focus();
      return;
    }

    if (!password.checkValidity()) {
      showError("La contraseña debe tener al menos 6 caracteres.");
      password.focus();
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Verificando...";

    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          correo: email.value.trim(),
          contrasena: password.value
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = data?.error?.message || "Credenciales incorrectas.";
        showError(msg);
        submitBtn.disabled = false;
        submitBtn.textContent = "Entrar";
        return;
      }

      const { accessToken, refreshToken, user } = data.data;

      // guardar datos de sesión
      localStorage.setItem("accessToken", accessToken);
      localStorage.setItem("refreshToken", refreshToken);
      localStorage.setItem("userRol", user.rol);
      localStorage.setItem("empleadoId", String(user.id_empleado));



      window.location.href = "empleado.html";

    } catch (ex) {
      console.error(ex);
      showError("Error de red. Intenta de nuevo.");
      submitBtn.disabled = false;
      submitBtn.textContent = "Entrar";
    }
  });
})();



