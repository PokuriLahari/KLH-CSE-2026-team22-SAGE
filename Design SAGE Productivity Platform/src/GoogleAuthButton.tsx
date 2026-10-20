import { useEffect, useRef, useState } from "react"
import { Text } from "@fluentui/react-text"
import { useAuth, type AuthUser } from "./AuthContext"
import { getGoogleClientId, loadGoogleIdentity } from "./googleCalendar"

let gisInitializedClientId: string | null = null
let activeCredentialHandler: ((credential: string) => void) | null = null

type GoogleAuthButtonProps = {
  onSuccess?: (user: AuthUser) => void
  onError?: (errorMessage: string) => void
  width?: number
}

export default function GoogleAuthButton({
  onSuccess,
  onError,
  width = 320,
}: GoogleAuthButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const isSubmittingRef = useRef<boolean>(false)
  const onSuccessRef = useRef(onSuccess)
  onSuccessRef.current = onSuccess
  const onErrorRef = useRef(onError)
  onErrorRef.current = onError

  const { loginWithCredential, error, setError, clearError } = useAuth()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    const handleCredential = async (credential: string) => {
      if (!credential || !active || isSubmittingRef.current) return
      isSubmittingRef.current = true
      setLoading(true)
      try {
        const ok = await loginWithCredential(credential)
        if (ok && active) {
          clearError()
          try {
            const stored = window.localStorage.getItem("sage_auth_user")
            if (stored) {
              const user = JSON.parse(stored) as AuthUser
              onSuccessRef.current?.(user)
            }
          } catch {}
        } else if (active) {
          if (import.meta.env.DEV) {
            console.error(
              "[GoogleAuthButton] Google sign-in failed during credential verification",
            )
          }
          onErrorRef.current?.("Sign-in could not be completed.")
        }
      } catch (err: unknown) {
        if (active) {
          if (import.meta.env.DEV) {
            console.error(
              "[GoogleAuthButton] Unexpected error during Google sign-in:",
              err instanceof Error ? err.message : err,
            )
          }
          const msg = "Google sign-in wasn't completed. Please try again."
          setError(msg)
          onErrorRef.current?.(msg)
        }
      } finally {
        isSubmittingRef.current = false
        if (active) setLoading(false)
      }
    }

    activeCredentialHandler = handleCredential

    loadGoogleIdentity()
      .then(() => {
        if (!active) return
        const accountsId = window.google?.accounts?.id
        if (!accountsId) {
          setLoading(false)
          return
        }

        try {
          const clientId = getGoogleClientId()
          const win = window as unknown as { __sage_gis_client_id?: string }
          if (
            gisInitializedClientId !== clientId &&
            win.__sage_gis_client_id !== clientId
          ) {
            accountsId.initialize({
              client_id: clientId,
              callback: (res: { credential?: string }) => {
                if (res.credential) {
                  activeCredentialHandler?.(res.credential)
                } else {
                  const msg =
                    "Google sign-in wasn't completed. Please try again."
                  setError(msg)
                  onErrorRef.current?.(msg)
                }
              },
              auto_select: false,
              cancel_on_tap_outside: true,
              itp_support: true,
            })
            gisInitializedClientId = clientId
            win.__sage_gis_client_id = clientId
          }

          if (containerRef.current) {
            containerRef.current.innerHTML = ""
            accountsId.renderButton(containerRef.current, {
              type: "standard",
              theme: "outline",
              size: "large",
              text: "continue_with",
              shape: "rectangular",
              width,
              logo_alignment: "left",
            })
          }
          setLoading(false)
        } catch (err: unknown) {
          setLoading(false)
          if (import.meta.env.DEV) {
            console.error(
              "[GoogleAuthButton] GIS render error:",
              err instanceof Error ? err.message : err,
            )
          }
          const msg = "Google sign-in wasn't completed. Please try again."
          setError(msg)
          onErrorRef.current?.(msg)
        }
      })
      .catch((err: unknown) => {
        if (active) {
          setLoading(false)
          if (import.meta.env.DEV) {
            console.error(
              "[GoogleAuthButton] Failed to load Google Identity SDK:",
              err instanceof Error ? err.message : err,
            )
          }
          const msg = "Google sign-in wasn't completed. Please try again."
          setError(msg)
          onErrorRef.current?.(msg)
        }
      })

    return () => {
      active = false
      if (activeCredentialHandler === handleCredential) {
        activeCredentialHandler = null
      }
    }
  }, [loginWithCredential, clearError, setError, width])

  return (
    <div
      className="google-auth"
      style={{
        width: "100%",
        maxWidth: `${width}px`,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "8px",
      }}
    >
      {/* Official Google Identity Services Rendered Button */}
      <div
        ref={containerRef}
        style={{
          minHeight: "44px",
          width: "100%",
          display: "flex",
          justifyContent: "center",
        }}
      />

      {loading && (
        <Text size={200} style={{ color: "var(--colorNeutralForeground3)" }}>
          Loading Google Sign-In…
        </Text>
      )}

      {/* Graceful Error Display (Never exposes technical OAuth errors) */}
      {error && (
        <div
          role="alert"
          style={{
            color: "#c42b1c",
            backgroundColor: "#fde7e9",
            padding: "8px 12px",
            borderRadius: "6px",
            fontSize: "13px",
            textAlign: "center",
            width: "100%",
            boxSizing: "border-box",
            border: "1px solid #f99f9f",
          }}
        >
          {error}
        </div>
      )}
    </div>
  )
}
