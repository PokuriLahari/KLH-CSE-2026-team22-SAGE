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

@Component
public class JwtValidationFilter implements GlobalFilter, Ordered {

    @Value("${jwt.secret}")
    private String secret;

    private static final Map<String, String> PATH_ROLE_MAP = Map.of(
        "/api/profile/", "STUDENT"
    );

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        ServerHttpRequest request = exchange.getRequest();
        String path = request.getURI().getPath();

        // 1. Allow public auth/login endpoints without JWT
        if (path.startsWith("/login/") || path.startsWith("/oauth2/")) {
            return chain.filter(exchange);
        }

        // 2. Allow health/actuator/basic infrastructure
        if (path.startsWith("/actuator/") || path.equals("/favicon.ico")) {
            return chain.filter(exchange);
        }

        // 3. For protected API requests, read authorization header
        String authHeader = request.getHeaders().getFirst("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return unauthorized(exchange);
        }

        String token = authHeader.substring(7);

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
            return unauthorized(exchange);
        }
    }

    private Mono<Void> unauthorized(ServerWebExchange exchange) {
        ServerHttpResponse response = exchange.getResponse();
        response.setStatusCode(HttpStatus.UNAUTHORIZED);
        return response.setComplete();
    }

    private Mono<Void> forbidden(ServerWebExchange exchange) {
        ServerHttpResponse response = exchange.getResponse();
        response.setStatusCode(HttpStatus.FORBIDDEN);
        return response.setComplete();
    }

    @Override
    public int getOrder() {
        return -100; // Executed early in the filter chain
    }
}
