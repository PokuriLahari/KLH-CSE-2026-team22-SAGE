package auth_service.service;

public record VerifiedGoogleUser(
    String sub,
    String email,
    String name,
    String picture
) {}
