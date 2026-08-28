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
}
