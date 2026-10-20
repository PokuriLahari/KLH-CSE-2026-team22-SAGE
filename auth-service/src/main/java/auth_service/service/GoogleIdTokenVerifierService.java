package auth_service.service;

import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Collections;

@Service
public class GoogleIdTokenVerifierService implements GoogleTokenVerifier {
    private static final Logger log = LoggerFactory.getLogger(GoogleIdTokenVerifierService.class);

    private final GoogleIdTokenVerifier verifier;
    private final String expectedClientId;

    @org.springframework.beans.factory.annotation.Autowired
    public GoogleIdTokenVerifierService(
            @Value("${spring.security.oauth2.client.registration.google.client-id:832115590292-i3h1b0qs87tahau5gq653ifdf5mum93r.apps.googleusercontent.com}") String clientId) {
        this.expectedClientId = clientId;
        GoogleIdTokenVerifier.Builder builder = new GoogleIdTokenVerifier.Builder(
                new NetHttpTransport(),
                GsonFactory.getDefaultInstance()
        );
        if (clientId != null && !clientId.trim().isEmpty() && !"dummy-google-client-id".equals(clientId.trim())) {
            builder.setAudience(Collections.singletonList(clientId.trim()));
        }
        this.verifier = builder.build();
    }

    public GoogleIdTokenVerifierService(GoogleIdTokenVerifier verifier, String expectedClientId) {
        this.verifier = verifier;
        this.expectedClientId = expectedClientId;
    }

    @Override
    public VerifiedGoogleUser verify(String idTokenString) throws Exception {
        if (idTokenString == null || idTokenString.trim().isEmpty()) {
            throw new IllegalArgumentException("Credential must not be empty");
        }

        GoogleIdToken idToken;
        try {
            idToken = verifier.verify(idTokenString.trim());
        } catch (Exception e) {
            log.warn("event=google_token_verification_failed reason={}", e.getClass().getSimpleName());
            throw new SecurityException("Failed to verify Google ID token: " + e.getMessage(), e);
        }

        if (idToken == null) {
            throw new SecurityException("Invalid, expired, or wrong-audience Google credential");
        }

        GoogleIdToken.Payload payload = idToken.getPayload();
        if (payload == null) {
            throw new SecurityException("Google ID token payload is missing");
        }

        // Validate Issuer
        String issuer = payload.getIssuer();
        if (issuer == null || (!"accounts.google.com".equals(issuer) && !"https://accounts.google.com".equals(issuer))) {
            throw new SecurityException("Invalid token issuer: " + issuer);
        }

        // Validate Audience
        if (expectedClientId != null && !expectedClientId.isEmpty() && !"dummy-google-client-id".equals(expectedClientId)) {
            if (payload.getAudienceAsList() == null || !payload.getAudienceAsList().contains(expectedClientId)) {
                throw new SecurityException("Google ID token audience does not match configured client ID");
            }
        }

        // Validate Expiration
        Long exp = payload.getExpirationTimeSeconds();
        if (exp != null && exp * 1000L < System.currentTimeMillis()) {
            throw new SecurityException("Google ID token is expired");
        }

        // Validate Subject (sub)
        String sub = payload.getSubject();
        if (sub == null || sub.trim().isEmpty()) {
            throw new SecurityException("Google ID token subject claim (sub) is missing or empty");
        }

        // Validate Email and Email Verified
        String email = payload.getEmail();
        if (email == null || email.trim().isEmpty()) {
            throw new SecurityException("Google ID token email claim is missing or empty");
        }

        Boolean emailVerified = payload.getEmailVerified();
        if (!Boolean.TRUE.equals(emailVerified)) {
            throw new SecurityException("Google email address is not verified");
        }

        String name = (String) payload.get("name");
        String picture = (String) payload.get("picture");

        return new VerifiedGoogleUser(sub.trim(), email.trim().toLowerCase(), name, picture);
    }
}
