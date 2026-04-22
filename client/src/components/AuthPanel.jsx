import { GoogleLogin } from "@react-oauth/google";

export default function AuthPanel({
  user,
  authLoading,
  googleAuthReady,
  onGoogleSuccess,
  onLogout,
}) {
  if (user) {
    return (
      <section className="auth-panel">
        <div className="auth-user">
          {user.picture ? (
            <img src={user.picture} alt={user.name} className="auth-avatar" />
          ) : (
            <div className="auth-avatar auth-avatar-fallback" aria-hidden="true">
              {user.name?.slice(0, 1)?.toUpperCase() || "U"}
            </div>
          )}
          <div>
            <p className="auth-name">{user.name}</p>
            <p className="auth-email">{user.email}</p>
          </div>
        </div>
        <button type="button" className="btn-ghost" onClick={onLogout}>
          Cerrar sesion
        </button>
      </section>
    );
  }

  return (
    <section className="auth-panel auth-panel-login">
      <div>
        <h3>Inicia sesion para guardar tus resultados</h3>
        <p>
          Con tu cuenta de Google podras tener historial de posts, estados y un
          dashboard personal.
        </p>
      </div>
      {googleAuthReady ? (
        <div className="google-wrap">
          <GoogleLogin
            onSuccess={onGoogleSuccess}
            onError={() => {}}
            useOneTap
            text="signin_with"
            shape="pill"
            theme="outline"
            size="large"
          />
        </div>
      ) : (
        <small>
          Configura VITE_GOOGLE_CLIENT_ID en client/.env para habilitar login.
        </small>
      )}
      {authLoading && <small>Verificando sesion...</small>}
    </section>
  );
}
