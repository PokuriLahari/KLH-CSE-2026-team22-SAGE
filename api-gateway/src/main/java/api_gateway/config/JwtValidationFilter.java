package api_gateway.config;

import com.auth0.jwt.JWT;
import com.auth0.jwt.JWTVerifier;
import com.auth0.jwt.algorithms.Algorithm;
import com.auth0.jwt.interfaces.DecodedJWT;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.http.server.reactive.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;
import java.util.Map;
import java.nio.charset.StandardCharsets;
import java.time.Instant;

@Component
public class JwtValidationFilter implements GlobalFilter, Ordered {

    @Value("${jwt.secret}")
    private String secret;

    private static final Map<String, String> PATH_ROLE_MAP = Map.of(
        "/api/profile/", "STUDENT",
        "/api/tasks", "STUDENT",
        "/api/auth/me", "STUDENT",
        "/api/auth/onboarding", "STUDENT",
        "/api/auth/account", "STUDENT",
        "/api/sage/", "STUDENT",
        "/api/reminders", "STUDENT"
    );

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        ServerHttpRequest request = exchange.getRequest();
        String path = request.getURI().getPath();

        // 1. Method-specific and path-specific exemption for POST /api/auth/google
        boolean isGoogleAuthExchange = path.equals("/api/auth/google")
            && org.springframework.http.HttpMethod.POST.equals(request.getMethod());

        boolean isPublicEndpoint = isGoogleAuthExchange
            || path.startsWith("/login/")
            || path.startsWith("/oauth2/")
            || path.equals("/login")
            || path.equals("/oauth2")
            || path.startsWith("/actuator/")
            || path.equals("/favicon.ico");

        if (isPublicEndpoint) {
            // Sanitize identity headers so client cannot spoof identity on public endpoints
            ServerHttpRequest sanitizedRequest = request.mutate()
                .headers(headers -> {
                    headers.remove("X-User-Id");
                    headers.remove("X-User-Email");
                    headers.remove("X-User-Role");
                })
                .build();
            return chain.filter(exchange.mutate().request(sanitizedRequest).build());
        }

        // 2. For protected API requests, read authorization header or cookie
        String token = null;
        String authHeader = request.getHeaders().getFirst("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            token = authHeader.substring(7);
        } else {
            org.springframework.http.HttpCookie cookie = request.getCookies().getFirst("sage_token");
            if (cookie != null && !cookie.getValue().trim().isEmpty()) {
                token = cookie.getValue().trim();
            }
        }

        if (token == null) {
            return unauthorized(exchange);
        }

        try {
            // 4. Validate signature, algorithm, expiration
            Algorithm algorithm = Algorithm.HMAC256(secret);
            JWTVerifier verifier = JWT.require(algorithm).build();
            DecodedJWT decodedJWT = verifier.verify(token);

            // 5. Extract claims
            String userId = decodedJWT.getSubject();
            String email = decodedJWT.getClaim("email").asString();
            String role = decodedJWT.getClaim("role").asString();

            if (userId == null || email == null || role == null) {
                return unauthorized(exchange);
            }

            // 6. Role-Based Authorization
            for (Map.Entry<String, String> entry : PATH_ROLE_MAP.entrySet()) {
                if (path.startsWith(entry.getKey())) {
                    String requiredRole = entry.getValue();
                    if (!requiredRole.equalsIgnoreCase(role)) {
                        return forbidden(exchange);
                    }
                }
            }

            // 7. Forward authenticated user info, overwriting client-supplied headers
            ServerHttpRequest mutatedRequest = request.mutate()
                .header("X-User-Id", userId)
                .header("X-User-Email", email)
                .header("X-User-Role", role)
                .build();

            return chain.filter(exchange.mutate().request(mutatedRequest).build());

        } catch (Exception e) {
            // Invalid or expired token
            org.slf4j.LoggerFactory.getLogger(getClass()).warn("event=jwt_rejected path={} requestId={} reason={}", path, request.getHeaders().getFirst("X-Request-Id"), e.getClass().getSimpleName());
            return unauthorized(exchange);
        }
    }

    private Mono<Void> unauthorized(ServerWebExchange exchange) {
        return writeError(exchange, HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Authentication is required.");
    }

    private Mono<Void> forbidden(ServerWebExchange exchange) {
        return writeError(exchange, HttpStatus.FORBIDDEN, "FORBIDDEN", "You don't have permission to perform this action.");
    }

    private Mono<Void> writeError(ServerWebExchange exchange, HttpStatus status, String error, String message) {
        ServerHttpResponse response = exchange.getResponse();
        response.setStatusCode(status);
        response.getHeaders().set("Content-Type", "application/json");
        String requestId = response.getHeaders().getFirst("X-Request-Id");
        String body = String.format("{\"timestamp\":\"%s\",\"status\":%d,\"error\":\"%s\",\"message\":\"%s\",\"requestId\":\"%s\",\"path\":\"%s\"}", Instant.now(), status.value(), error, message, requestId == null ? "" : requestId, exchange.getRequest().getURI().getPath());
        return response.writeWith(Mono.just(response.bufferFactory().wrap(body.getBytes(StandardCharsets.UTF_8))));
    }

    @Override
    public int getOrder() {
        return -100; // Executed early in the filter chain
    }
}
