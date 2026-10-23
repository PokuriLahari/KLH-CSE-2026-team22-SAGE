package auth_service;

import auth_service.config.JwtUtils;
import com.auth0.jwt.JWT;
import com.auth0.jwt.interfaces.DecodedJWT;
import com.auth0.jwt.interfaces.JWTVerifier;
import com.auth0.jwt.algorithms.Algorithm;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import java.util.Date;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@SpringBootTest
class AuthServiceApplicationTests {

    @Autowired
    private JwtUtils jwtUtils;

    @Autowired
    private org.springframework.security.web.SecurityFilterChain filterChain;

    @Autowired
    private auth_service.repository.UserRepository userRepository;

    @Value("${jwt.secret}")
    private String secret;

    @Test
    void contextLoads() {
        assertNotNull(jwtUtils);
        assertNotNull(secret);
    }

    @Test
    void testJwtGenerationAndClaims() {
        Long userId = 42L;
        String email = "testuser@example.com";

        // Generate token
        String token = jwtUtils.generateToken(userId, email);
        assertNotNull(token);
        assertFalse(token.trim().isEmpty());

        // Verify and decode token using the configured secret
        Algorithm algorithm = Algorithm.HMAC256(secret);
        com.auth0.jwt.interfaces.JWTVerifier verifier = com.auth0.jwt.JWT.require(algorithm).build();
        DecodedJWT decodedJWT = verifier.verify(token);

        // Verify claims
        assertEquals(userId.toString(), decodedJWT.getSubject());
        assertEquals(email, decodedJWT.getClaim("email").asString());
        assertEquals("STUDENT", decodedJWT.getClaim("role").asString());

        // Verify times
        assertNotNull(decodedJWT.getIssuedAt());
        assertNotNull(decodedJWT.getExpiresAt());
        assertTrue(decodedJWT.getExpiresAt().after(new Date()));
        
        // Expiration should be roughly 24 hours from issuedAt
        long diffMs = decodedJWT.getExpiresAt().getTime() - decodedJWT.getIssuedAt().getTime();
        assertEquals(24 * 60 * 60 * 1000L, diffMs);
    }

    @Test
    void testSuccessHandlerOutputsCorrectFormat() throws Exception {
        // Clean up if already exists from previous runs
        userRepository.findByGoogleId("google-12345").ifPresent(user -> userRepository.delete(user));

        // Find the success handler from SecurityFilterChain using reflection
        org.springframework.security.web.authentication.AuthenticationSuccessHandler successHandler = null;
        for (jakarta.servlet.Filter filter : filterChain.getFilters()) {
            if (filter instanceof org.springframework.security.oauth2.client.web.OAuth2LoginAuthenticationFilter) {
                java.lang.reflect.Method method = org.springframework.security.web.authentication.AbstractAuthenticationProcessingFilter.class
                    .getDeclaredMethod("getSuccessHandler");
                method.setAccessible(true);
                successHandler = (org.springframework.security.web.authentication.AuthenticationSuccessHandler) method.invoke(filter);
                break;
            }
        }
        
        assertNotNull(successHandler);
        
        // Mock request, response, and authentication
        org.springframework.mock.web.MockHttpServletRequest request = new org.springframework.mock.web.MockHttpServletRequest();
        org.springframework.mock.web.MockHttpServletResponse response = new org.springframework.mock.web.MockHttpServletResponse();
        
        org.springframework.security.oauth2.core.user.OAuth2User principal = mock(org.springframework.security.oauth2.core.user.OAuth2User.class);
        when(principal.getAttribute("sub")).thenReturn("google-12345");
        when(principal.getAttribute("email")).thenReturn("success@example.com");
        when(principal.getAttribute("name")).thenReturn("Success User");
        
        org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken authentication = 
            new org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken(
                principal, 
                java.util.Collections.emptyList(), 
                "google"
            );
        
        // Execute the handler (this will save the user to database)
        successHandler.onAuthenticationSuccess(request, response, authentication);
        
        // Find the newly saved user in the database to get its ID
        auth_service.model.User savedUser = userRepository.findByGoogleId("google-12345")
            .orElseThrow(() -> new AssertionError("User should have been saved to the database"));
        Long expectedId = savedUser.getId();

        // Read response
        String responseContent = response.getContentAsString();
        System.out.println("--- Handler Output Start ---");
        System.out.println(responseContent);
        System.out.println("--- Handler Output End ---");

        // Verify response content contains the requested plain-text format
        String[] lines = responseContent.split("\\r?\\n");
        assertTrue(lines.length >= 5, "Response should have at least 5 lines of text");
        assertEquals("authentication successful", lines[0]);
        assertEquals("User ID: " + expectedId, lines[1]);
        assertEquals("Name: Success User", lines[2]);
        assertEquals("Email: success@example.com", lines[3]);
        assertTrue(lines[4].startsWith("JWT: "), "Fifth line should be the JWT token starting with 'JWT: '");
        
        // Verify no extra Google ID line is output
        for (String line : lines) {
            assertFalse(line.contains("Google ID"), "Response should not contain Google ID line");
        }
    }

    @Autowired
    private auth_service.controller.RootHealthController rootHealthController;

    @Autowired
    private auth_service.controller.ContestController contestController;

    @Test
    void testRootHealthEndpointReturnsCleanStatusWithoutSensitiveInfo() {
        assertNotNull(rootHealthController, "RootHealthController should be loaded in Spring context");
        org.springframework.http.ResponseEntity<java.util.Map<String, Object>> resp = rootHealthController.health();
        assertEquals(org.springframework.http.HttpStatus.OK, resp.getStatusCode());
        assertNotNull(resp.getBody());
        assertEquals("UP", resp.getBody().get("status"));
        assertEquals("auth-service", resp.getBody().get("service"));

        // Confirm zero sensitive information exposed
        assertEquals(2, resp.getBody().size(), "Health response must only contain status and service fields");
        assertFalse(resp.getBody().containsKey("password"));
        assertFalse(resp.getBody().containsKey("secret"));
        assertFalse(resp.getBody().containsKey("database"));
        assertFalse(resp.getBody().containsKey("env"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void testContestControllerResponseShapeInSpringContext() {
        assertNotNull(contestController, "ContestController should be loaded in Spring context");
        org.springframework.http.ResponseEntity<java.util.Map<String, Object>> resp = contestController.getUpcomingContests();
        assertEquals(org.springframework.http.HttpStatus.OK, resp.getStatusCode());
        assertNotNull(resp.getBody());
        assertTrue(resp.getBody().containsKey("contests"), "Response must contain 'contests' array");
        assertTrue(resp.getBody().containsKey("lastUpdated"), "Response must contain 'lastUpdated' string");

        java.util.List<java.util.Map<String, Object>> list = (java.util.List<java.util.Map<String, Object>>) resp.getBody().get("contests");
        assertNotNull(list);

        // If upstream returned contests or cache is populated, verify field parity
        for (java.util.Map<String, Object> c : list) {
            assertNotNull(c.get("id"), "Contest must have 'id'");
            assertNotNull(c.get("platform"), "Contest must have 'platform'");
            assertNotNull(c.get("name"), "Contest must have 'name'");
            assertNotNull(c.get("startTime"), "Contest must have 'startTime'");
            assertNotNull(c.get("duration"), "Contest must have 'duration'");
            assertNotNull(c.get("url"), "Contest must have 'url'");
            assertNotNull(c.get("status"), "Contest must have 'status'");
            assertNotNull(c.get("lastUpdated"), "Contest must have 'lastUpdated'");
            assertTrue(c.containsKey("reminder"), "Contest must have 'reminder' key");
        }
    }
}

