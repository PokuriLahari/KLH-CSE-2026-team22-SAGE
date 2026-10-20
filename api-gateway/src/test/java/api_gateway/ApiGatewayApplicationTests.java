package api_gateway;

import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.reactive.server.WebTestClient;
import org.springframework.context.ApplicationContext;
import org.junit.jupiter.api.BeforeEach;
import java.util.Date;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class ApiGatewayApplicationTests {

    private WebTestClient webTestClient;

    @Value("${local.server.port}")
    private int port;

    @Value("${jwt.secret}")
    private String secret;

    @BeforeEach
    void setUp() {
        this.webTestClient = WebTestClient.bindToServer()
            .baseUrl("http://localhost:" + port)
            .build();
    }

    @Autowired
    private org.springframework.cloud.gateway.route.RouteLocator routeLocator;

    @Test
    void contextLoads() {
        assertNotNull(webTestClient);
        assertNotNull(secret);
    }

    private String generateTestToken(Long userId, String email, String role, boolean expired) {
        Algorithm algorithm = Algorithm.HMAC256(secret);
        Date exp = expired 
            ? new Date(System.currentTimeMillis() - 10000) 
            : new Date(System.currentTimeMillis() + 100000);
        return JWT.create()
            .withSubject(userId.toString())
            .withClaim("email", email)
            .withClaim("role", role)
            .withIssuedAt(new Date())
            .withExpiresAt(exp)
            .sign(algorithm);
    }

    @Test
    void testNoToken() {
        webTestClient.get()
            .uri("/api/profile/1")
            .exchange()
            .expectStatus().isUnauthorized();
    }

    @Test
    void testInvalidToken() {
        webTestClient.get()
            .uri("/api/profile/1")
            .header("Authorization", "Bearer invalid-token-string")
            .exchange()
            .expectStatus().isUnauthorized();
    }

    @Test
    void testExpiredToken() {
        String token = generateTestToken(1L, "user@example.com", "STUDENT", true);
        webTestClient.get()
            .uri("/api/profile/1")
            .header("Authorization", "Bearer " + token)
            .exchange()
            .expectStatus().isUnauthorized();
    }

    @Test
    void testValidToken() {
        String token = generateTestToken(1L, "user@example.com", "STUDENT", false);
        webTestClient.get()
            .uri("/api/profile/1")
            .header("Authorization", "Bearer " + token)
            .exchange()
            .expectStatus().value(status -> {
                // Allows request to continue downstream. 503 is expected since PROFILE-SERVICE is down, but NOT 401/403.
                assertTrue(status == 503 || status == 200 || status == 404, "Status was: " + status);
            });
    }

    @Test
    void testUnauthorizedRole() {
        String token = generateTestToken(1L, "user@example.com", "TEACHER", false);
        webTestClient.get()
            .uri("/api/profile/1")
            .header("Authorization", "Bearer " + token)
            .exchange()
            .expectStatus().isForbidden();
    }

    @Test
    void testGoogleAuthExchangeExemptFromJwt() {
        webTestClient.post()
            .uri("/api/auth/google")
            .header("Content-Type", "application/json")
            .bodyValue("{\"credential\":\"dummy-test-token\"}")
            .exchange()
            .expectStatus().value(status -> {
                // Must pass through gateway. If downstream auth-service is running, it returns 401 with error message.
                // If not running, gateway returns 503.
                assertTrue(status == 401 || status == 503 || status == 400 || status == 200, "Status was: " + status);
            })
            .expectBody()
            .consumeWith(result -> {
                if (result.getStatus().value() == 401) {
                    assertNotNull(result.getResponseBodyContent());
                    String body = new String(result.getResponseBodyContent());
                    assertTrue(body.contains("Google credential"), "401 must come from downstream auth-service, not empty gateway rejection");
                }
            });
    }

    @Test
    void testGoogleAuthExchangeWrongMethodRejectedWith401() {
        // GET /api/auth/google is NOT exempt
        webTestClient.get()
            .uri("/api/auth/google")
            .exchange()
            .expectStatus().isUnauthorized();
    }

    @Test
    void testProtectedTasksWithoutTokenRejected() {
        webTestClient.get()
            .uri("/api/tasks")
            .exchange()
            .expectStatus().isUnauthorized();
    }

    @Test
    void testProtectedTasksWithExpiredTokenRejected() {
        String token = generateTestToken(1L, "user@example.com", "STUDENT", true);
        webTestClient.get()
            .uri("/api/tasks")
            .header("Authorization", "Bearer " + token)
            .exchange()
            .expectStatus().isUnauthorized();
    }

    @Test
    void testProtectedTasksWithInvalidTokenRejected() {
        webTestClient.get()
            .uri("/api/tasks")
            .header("Authorization", "Bearer invalid-token-string")
            .exchange()
            .expectStatus().isUnauthorized();
    }

    @Test
    void testProtectedTasksWithValidTokenAllowedDownstream() {
        String token = generateTestToken(1L, "user@example.com", "STUDENT", false);
        webTestClient.get()
            .uri("/api/tasks")
            .header("Authorization", "Bearer " + token)
            .exchange()
            .expectStatus().value(status -> {
                assertFalse(status == 401 || status == 403, "Status was: " + status);
            });
    }

    @Autowired
    private api_gateway.config.JwtValidationFilter jwtValidationFilter;

    @Test
    void testClientSuppliedIdentityHeadersSanitizedOnPublicRoute() {
        org.springframework.mock.http.server.reactive.MockServerHttpRequest req =
            org.springframework.mock.http.server.reactive.MockServerHttpRequest
                .post("/api/auth/google")
                .header("X-User-Id", "9999")
                .header("X-User-Email", "attacker@example.com")
                .header("X-User-Role", "STUDENT")
                .build();
        org.springframework.mock.web.server.MockServerWebExchange ex =
            org.springframework.mock.web.server.MockServerWebExchange.from(req);

        final java.util.concurrent.atomic.AtomicBoolean captured = new java.util.concurrent.atomic.AtomicBoolean(false);
        org.springframework.cloud.gateway.filter.GatewayFilterChain chain = exchange -> {
            captured.set(true);
            org.springframework.http.HttpHeaders headers = exchange.getRequest().getHeaders();
            assertNull(headers.getFirst("X-User-Id"), "X-User-Id must be removed on public routes");
            assertNull(headers.getFirst("X-User-Email"), "X-User-Email must be removed on public routes");
            assertNull(headers.getFirst("X-User-Role"), "X-User-Role must be removed on public routes");
            return reactor.core.publisher.Mono.empty();
        };

        jwtValidationFilter.filter(ex, chain).block();
        assertTrue(captured.get(), "Filter chain must have been invoked");
    }

    @Test
    void testClientSuppliedIdentityHeadersOverwrittenOnAuthenticatedRoute() {
        String token = generateTestToken(42L, "legit@example.com", "STUDENT", false);
        org.springframework.mock.http.server.reactive.MockServerHttpRequest req =
            org.springframework.mock.http.server.reactive.MockServerHttpRequest
                .get("/api/tasks")
                .header("Authorization", "Bearer " + token)
                .header("X-User-Id", "9999") // Spoofed
                .header("X-User-Email", "attacker@example.com") // Spoofed
                .header("X-User-Role", "ADMIN") // Spoofed
                .build();
        org.springframework.mock.web.server.MockServerWebExchange ex =
            org.springframework.mock.web.server.MockServerWebExchange.from(req);

        final java.util.concurrent.atomic.AtomicBoolean captured = new java.util.concurrent.atomic.AtomicBoolean(false);
        org.springframework.cloud.gateway.filter.GatewayFilterChain chain = exchange -> {
            captured.set(true);
            org.springframework.http.HttpHeaders headers = exchange.getRequest().getHeaders();
            assertEquals("42", headers.getFirst("X-User-Id"), "X-User-Id must be set to verified token subject");
            assertEquals("legit@example.com", headers.getFirst("X-User-Email"), "X-User-Email must be set to verified token email");
            assertEquals("STUDENT", headers.getFirst("X-User-Role"), "X-User-Role must be set to verified token role");
            return reactor.core.publisher.Mono.empty();
        };

        jwtValidationFilter.filter(ex, chain).block();
        assertTrue(captured.get(), "Filter chain must have been invoked");
    }

    @Test
    void testAccountDeletionUnauthenticatedRejectedWith401() {
        webTestClient.delete()
            .uri("/api/auth/account")
            .exchange()
            .expectStatus().isUnauthorized();
    }

    @Test
    void testAccountDeletionForbiddenForWrongRole() {
        String token = generateTestToken(1L, "intruder@example.com", "FACULTY", false);
        webTestClient.delete()
            .uri("/api/auth/account")
            .header("Authorization", "Bearer " + token)
            .exchange()
            .expectStatus().isForbidden();
    }

    @Test
    void testAccountDeletionAllowedDownstreamWithStudentToken() {
        String token = generateTestToken(1L, "student@example.com", "STUDENT", false);
        webTestClient.delete()
            .uri("/api/auth/account")
            .header("Authorization", "Bearer " + token)
            .exchange()
            .expectStatus().value(status -> {
                assertFalse(status == 401 || status == 403, "Status was: " + status + ", expected pass-through");
            });
    }

    @Test
    void testRemindersUnauthenticatedRejectedWith401() {
        webTestClient.get()
            .uri("/api/reminders")
            .exchange()
            .expectStatus().isUnauthorized();
    }

    @Test
    void testRemindersForbiddenForWrongRole() {
        String token = generateTestToken(1L, "intruder@example.com", "FACULTY", false);
        webTestClient.get()
            .uri("/api/reminders")
            .header("Authorization", "Bearer " + token)
            .exchange()
            .expectStatus().isForbidden();
    }

    @Test
    void testRemindersAllowedDownstreamWithStudentToken() {
        String token = generateTestToken(1L, "student@example.com", "STUDENT", false);
        webTestClient.get()
            .uri("/api/reminders")
            .header("Authorization", "Bearer " + token)
            .exchange()
            .expectStatus().value(status -> {
                assertFalse(status == 401 || status == 403, "Status was: " + status + ", expected pass-through");
            });
    }
}
