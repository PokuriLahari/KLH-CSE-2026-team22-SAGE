package auth_service.service;

public interface GoogleTokenVerifier {
    VerifiedGoogleUser verify(String idTokenString) throws Exception;
}
