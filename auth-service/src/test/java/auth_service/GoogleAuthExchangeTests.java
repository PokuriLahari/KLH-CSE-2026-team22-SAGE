package auth_service;

import auth_service.config.JwtUtils;
import auth_service.controller.AuthController;
import auth_service.model.User;
import auth_service.repository.TaskRepository;
import auth_service.repository.UserRepository;
import auth_service.service.GoogleTokenVerifier;
import auth_service.service.VerifiedGoogleUser;
import com.auth0.jwt.interfaces.DecodedJWT;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@SpringBootTest
public class GoogleAuthExchangeTests {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private TaskRepository taskRepository;

    @Autowired
    private auth_service.repository.DeletedAccountRepository deletedAccountRepository;

    @Autowired
    private auth_service.repository.ReminderRepository reminderRepository;

    @Autowired
    private auth_service.service.GeminiAiService geminiAiService;

    @Autowired
    private JwtUtils jwtUtils;

    private GoogleTokenVerifier mockVerifier;
    private AuthController authController;

    @BeforeEach
    void setUp() {
        mockVerifier = mock(GoogleTokenVerifier.class);
        authController = new AuthController(userRepository, taskRepository, deletedAccountRepository, reminderRepository, mockVerifier, geminiAiService, jwtUtils);
        deletedAccountRepository.deleteAll();
        reminderRepository.deleteAll();
        // Clean up test users
        userRepository.findByGoogleId("google-sub-test-1").ifPresent(userRepository::delete);
        userRepository.findByGoogleId("google-sub-test-repeat").ifPresent(userRepository::delete);
        userRepository.findByGoogleId("google-sub-link").ifPresent(userRepository::delete);
        userRepository.findByEmail("linkme@example.com").ifPresent(userRepository::delete);
        userRepository.findByEmail("teststudent@example.com").ifPresent(userRepository::delete);
    }

    @Test
    void testMissingOrEmptyCredentialReturns400() {
        ResponseEntity<?> res1 = authController.exchangeGoogleToken(null);
        assertEquals(HttpStatus.BAD_REQUEST, res1.getStatusCode());

        ResponseEntity<?> res2 = authController.exchangeGoogleToken(Map.of());
        assertEquals(HttpStatus.BAD_REQUEST, res2.getStatusCode());

        ResponseEntity<?> res3 = authController.exchangeGoogleToken(Map.of("credential", ""));
        assertEquals(HttpStatus.BAD_REQUEST, res3.getStatusCode());

        ResponseEntity<?> res4 = authController.exchangeGoogleToken(Map.of("credential", "   "));
        assertEquals(HttpStatus.BAD_REQUEST, res4.getStatusCode());
    }

    @Test
    void testInvalidOrForgedGoogleTokenReturns401() throws Exception {
        when(mockVerifier.verify("forged-token"))
                .thenThrow(new SecurityException("Invalid token signature"));

        ResponseEntity<?> res = authController.exchangeGoogleToken(Map.of("credential", "forged-token"));
        assertEquals(HttpStatus.UNAUTHORIZED, res.getStatusCode());

        Map<?, ?> body = (Map<?, ?>) res.getBody();
        assertNotNull(body);
        assertEquals("Invalid or expired Google credential", body.get("error"));
    }

    @Test
    void testExpiredTokenReturns401() throws Exception {
        when(mockVerifier.verify("expired-token"))
                .thenThrow(new SecurityException("Google ID token is expired"));

        ResponseEntity<?> res = authController.exchangeGoogleToken(Map.of("credential", "expired-token"));
        assertEquals(HttpStatus.UNAUTHORIZED, res.getStatusCode());

        Map<?, ?> body = (Map<?, ?>) res.getBody();
        assertNotNull(body);
        assertEquals("Invalid or expired Google credential", body.get("error"));
    }

    @Test
    void testWrongAudienceReturns401() throws Exception {
        when(mockVerifier.verify("wrong-aud-token"))
                .thenThrow(new SecurityException("Google ID token audience does not match configured client ID"));

        ResponseEntity<?> res = authController.exchangeGoogleToken(Map.of("credential", "wrong-aud-token"));
        assertEquals(HttpStatus.UNAUTHORIZED, res.getStatusCode());

        Map<?, ?> body = (Map<?, ?>) res.getBody();
        assertNotNull(body);
        assertEquals("Invalid or expired Google credential", body.get("error"));
    }

    @Test
    void testUnverifiedEmailIsRejectedWith401() throws Exception {
        when(mockVerifier.verify("unverified-email-token"))
                .thenThrow(new SecurityException("Google email address is not verified"));

        ResponseEntity<?> res = authController.exchangeGoogleToken(Map.of("credential", "unverified-email-token"));
        assertEquals(HttpStatus.UNAUTHORIZED, res.getStatusCode());

        Map<?, ?> body = (Map<?, ?>) res.getBody();
        assertNotNull(body);
        assertEquals("Invalid or expired Google credential", body.get("error"));
    }

    @Test
    void testValidVerifiedIdentityCreatesUserAndIssuesSageJwt() throws Exception {
        when(mockVerifier.verify("valid-token-1"))
                .thenReturn(new VerifiedGoogleUser("google-sub-test-1", "teststudent@example.com", "Test Student", "https://photo.jpg"));

        ResponseEntity<?> res = authController.exchangeGoogleToken(Map.of("credential", "valid-token-1"));
        assertEquals(HttpStatus.OK, res.getStatusCode());

        Map<?, ?> body = (Map<?, ?>) res.getBody();
        assertNotNull(body);
        assertTrue(body.containsKey("token"));
        assertTrue(body.containsKey("user"));

        String token = (String) body.get("token");
        assertNotNull(token);
        assertFalse(token.isEmpty());

        // Validate SAGE JWT claims
        DecodedJWT decoded = jwtUtils.verifyToken(token);
        assertNotNull(decoded);
        assertEquals("teststudent@example.com", decoded.getClaim("email").asString());
        assertEquals("STUDENT", decoded.getClaim("role").asString());

        Map<?, ?> userMap = (Map<?, ?>) body.get("user");
        assertEquals("teststudent@example.com", userMap.get("email"));
        assertEquals("Test Student", userMap.get("name"));
        assertEquals("https://photo.jpg", userMap.get("picture"));
        assertEquals(false, userMap.get("onboardingCompleted"));

        // Verify persisted user in DB
        Optional<User> persisted = userRepository.findByGoogleId("google-sub-test-1");
        assertTrue(persisted.isPresent());
        assertEquals("teststudent@example.com", persisted.get().getEmail());
        assertEquals("Test Student", persisted.get().getName());
        assertEquals(decoded.getSubject(), persisted.get().getId().toString());
    }

    @Test
    void testRepeatLoginDoesNotCreateDuplicateUsers() throws Exception {
        when(mockVerifier.verify("repeat-token"))
                .thenReturn(new VerifiedGoogleUser("google-sub-test-repeat", "repeat@example.com", "Repeat User", null));

        // First login
        ResponseEntity<?> res1 = authController.exchangeGoogleToken(Map.of("credential", "repeat-token"));
        assertEquals(HttpStatus.OK, res1.getStatusCode());
        Map<?, ?> body1 = (Map<?, ?>) res1.getBody();
        Map<?, ?> user1 = (Map<?, ?>) body1.get("user");
        Long id1 = ((Number) user1.get("id")).longValue();

        // Second login
        ResponseEntity<?> res2 = authController.exchangeGoogleToken(Map.of("credential", "repeat-token"));
        assertEquals(HttpStatus.OK, res2.getStatusCode());
        Map<?, ?> body2 = (Map<?, ?>) res2.getBody();
        Map<?, ?> user2 = (Map<?, ?>) body2.get("user");
        Long id2 = ((Number) user2.get("id")).longValue();

        assertEquals(id1, id2, "Repeat login must return identical user ID");

        // Verify database has only one user with this googleId
        long count = userRepository.findAll().stream()
                .filter(u -> "google-sub-test-repeat".equals(u.getGoogleId()))
                .count();
        assertEquals(1, count, "Database must not contain duplicate users");
    }

    @Test
    void testExistingOnboardingStatusIsPreserved() throws Exception {
        when(mockVerifier.verify("onboarding-token"))
                .thenReturn(new VerifiedGoogleUser("google-sub-test-repeat", "repeat@example.com", "Repeat User", null));

        // First login creates user
        authController.exchangeGoogleToken(Map.of("credential", "onboarding-token"));

        User user = userRepository.findByGoogleId("google-sub-test-repeat").orElseThrow();
        user.setOnboardingCompleted(true);
        userRepository.save(user);

        // Next login should reflect onboardingCompleted = true
        ResponseEntity<?> res = authController.exchangeGoogleToken(Map.of("credential", "onboarding-token"));
        assertEquals(HttpStatus.OK, res.getStatusCode());
        Map<?, ?> body = (Map<?, ?>) res.getBody();
        Map<?, ?> userMap = (Map<?, ?>) body.get("user");
        assertEquals(true, userMap.get("onboardingCompleted"));
    }

    @Test
    void testUnexpectedFailuresDoNotDiscloseInternalDetails() throws Exception {
        when(mockVerifier.verify("crash-token"))
                .thenThrow(new RuntimeException("Detailed internal database deadlock and secret credentials"));

        ResponseEntity<?> res = authController.exchangeGoogleToken(Map.of("credential", "crash-token"));
        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, res.getStatusCode());

        Map<?, ?> body = (Map<?, ?>) res.getBody();
        assertNotNull(body);
        assertEquals("Authentication processing failed", body.get("error"));
        assertFalse(body.toString().contains("deadlock"));
        assertFalse(body.toString().contains("credentials"));
    }

    @Test
    void testAccountLinkingByVerifiedEmail() throws Exception {
        // Pre-existing user with email but no googleId
        User existing = new User();
        existing.setEmail("linkme@example.com");
        existing.setName("Pre Existing");
        existing.setAuthProvider("EMAIL");
        userRepository.save(existing);

        when(mockVerifier.verify("link-token"))
                .thenReturn(new VerifiedGoogleUser("google-sub-link", "linkme@example.com", "Updated Name", null));

        ResponseEntity<?> res = authController.exchangeGoogleToken(Map.of("credential", "link-token"));
        assertEquals(HttpStatus.OK, res.getStatusCode());

        User linked = userRepository.findByGoogleId("google-sub-link").orElseThrow();
        assertEquals(existing.getId(), linked.getId(), "Should link to existing account ID");
        assertEquals("google-sub-link", linked.getGoogleId());
    }

    @Test
    void testForgedBearerTokenRejectedInDownstreamResolution() {
        // Unverified token with random secret
        com.auth0.jwt.algorithms.Algorithm rogueAlgo = com.auth0.jwt.algorithms.Algorithm.HMAC256("rogue-secret-different-from-sage");
        String rogueToken = com.auth0.jwt.JWT.create()
                .withSubject("99999")
                .withClaim("email", "hacker@example.com")
                .withClaim("role", "STUDENT")
                .sign(rogueAlgo);

        // Call GET /api/auth/me with forged token directly without Gateway X-User-Id
        ResponseEntity<?> res = authController.getCurrentUser(null, "Bearer " + rogueToken);
        assertEquals(HttpStatus.UNAUTHORIZED, res.getStatusCode(), "Forged token signature must be rejected");
    }

    @Test
    void testSpoofedXUserIdWithoutValidTokenIsRejected() {
        ResponseEntity<?> resWithoutToken = authController.getCurrentUser("1", null);
        assertEquals(HttpStatus.UNAUTHORIZED, resWithoutToken.getStatusCode(), "Unauthenticated request with spoofed X-User-Id must be rejected");

        ResponseEntity<?> resWithBadToken = authController.getCurrentUser("1", "Bearer invalid-token");
        assertEquals(HttpStatus.UNAUTHORIZED, resWithBadToken.getStatusCode(), "Request with spoofed X-User-Id and bad token must be rejected");
    }

    @Test
    void testTwoDistinctPermittedGoogleAccountsAreIsolated() throws Exception {
        userRepository.findByGoogleId("google-sub-alice").ifPresent(userRepository::delete);
        userRepository.findByGoogleId("google-sub-bob").ifPresent(userRepository::delete);

        // Account 1: Alice
        when(mockVerifier.verify("alice-google-token"))
                .thenReturn(new VerifiedGoogleUser("google-sub-alice", "alice@example.com", "Alice Student", "https://alice.jpg"));

        ResponseEntity<?> aliceAuthRes = authController.exchangeGoogleToken(Map.of("credential", "alice-google-token"));
        assertEquals(HttpStatus.OK, aliceAuthRes.getStatusCode());
        Map<?, ?> aliceBody = (Map<?, ?>) aliceAuthRes.getBody();
        assertNotNull(aliceBody);
        String aliceToken = (String) aliceBody.get("token");
        Map<?, ?> aliceUser = (Map<?, ?>) aliceBody.get("user");
        Long aliceId = ((Number) aliceUser.get("id")).longValue();
        assertEquals("alice@example.com", aliceUser.get("email"));

        // Account 2: Bob
        when(mockVerifier.verify("bob-google-token"))
                .thenReturn(new VerifiedGoogleUser("google-sub-bob", "bob@example.com", "Bob Student", "https://bob.jpg"));

        ResponseEntity<?> bobAuthRes = authController.exchangeGoogleToken(Map.of("credential", "bob-google-token"));
        assertEquals(HttpStatus.OK, bobAuthRes.getStatusCode());
        Map<?, ?> bobBody = (Map<?, ?>) bobAuthRes.getBody();
        assertNotNull(bobBody);
        String bobToken = (String) bobBody.get("token");
        Map<?, ?> bobUser = (Map<?, ?>) bobBody.get("user");
        Long bobId = ((Number) bobUser.get("id")).longValue();
        assertEquals("bob@example.com", bobUser.get("email"));

        // IDs must be distinct
        assertNotEquals(aliceId, bobId, "Each permitted account must resolve to distinct user ID");

        // Profile isolation check
        ResponseEntity<?> aliceProfile = authController.getCurrentUser(null, "Bearer " + aliceToken);
        assertEquals(HttpStatus.OK, aliceProfile.getStatusCode());
        assertEquals("alice@example.com", ((Map<?, ?>) aliceProfile.getBody()).get("email"));

        ResponseEntity<?> bobProfile = authController.getCurrentUser(null, "Bearer " + bobToken);
        assertEquals(HttpStatus.OK, bobProfile.getStatusCode());
        assertEquals("bob@example.com", ((Map<?, ?>) bobProfile.getBody()).get("email"));

        // Task data isolation check
        auth_service.model.Task aliceTaskInput = new auth_service.model.Task();
        aliceTaskInput.setTitle("Alice Private Assignment");
        ResponseEntity<?> createdRes = authController.createTask(null, "Bearer " + aliceToken, aliceTaskInput);
        assertEquals(HttpStatus.CREATED, createdRes.getStatusCode());
        auth_service.model.Task createdTask = (auth_service.model.Task) createdRes.getBody();
        assertNotNull(createdTask);
        Long taskId = createdTask.getId();

        // Alice can see her task
        ResponseEntity<?> aliceTasksRes = authController.getTasks(null, "Bearer " + aliceToken);
        assertEquals(HttpStatus.OK, aliceTasksRes.getStatusCode());
        java.util.List<?> aliceTasks = (java.util.List<?>) aliceTasksRes.getBody();
        assertTrue(aliceTasks.stream().anyMatch(t -> ((auth_service.model.Task) t).getId().equals(taskId)));

        // Bob cannot see Alice's task
        ResponseEntity<?> bobTasksRes = authController.getTasks(null, "Bearer " + bobToken);
        assertEquals(HttpStatus.OK, bobTasksRes.getStatusCode());
        java.util.List<?> bobTasks = (java.util.List<?>) bobTasksRes.getBody();
        assertFalse(bobTasks.stream().anyMatch(t -> ((auth_service.model.Task) t).getId().equals(taskId)),
                "Bob must not have access to Alice's private task");

        // Bob cannot update Alice's task
        ResponseEntity<?> updateRes = authController.updateTask(taskId, null, "Bearer " + bobToken, Map.of("title", "Hacked Title"));
        assertEquals(HttpStatus.NOT_FOUND, updateRes.getStatusCode(),
                "Bob updating Alice's task must be rejected with 404");

        // Cleanup
        userRepository.findByGoogleId("google-sub-alice").ifPresent(userRepository::delete);
        userRepository.findByGoogleId("google-sub-bob").ifPresent(userRepository::delete);
    }

    @Test
    void testPermanentAccountDeletionCleansUserAndTasksAndStoresTombstone() {
        // 1. Create a user
        User user = new User();
        user.setGoogleId("google-sub-delete-target");
        user.setEmail("delete-me@example.com");
        user.setName("Delete Target");
        user.setEmailVerified(true);
        user = userRepository.save(user);
        Long userId = user.getId();

        // 2. Create tasks for this user
        auth_service.model.Task task1 = new auth_service.model.Task();
        task1.setUserId(userId);
        task1.setTitle("Task 1 to delete");
        taskRepository.save(task1);

        auth_service.model.Task task2 = new auth_service.model.Task();
        task2.setUserId(userId);
        task2.setTitle("Task 2 to delete");
        taskRepository.save(task2);

        assertEquals(2, taskRepository.findByUserIdOrderByCreatedAtDesc(userId).size());

        // 3. Issue deletion request using verified userId
        String token = jwtUtils.generateToken(userId, user.getEmail());
        ResponseEntity<?> delRes = authController.deleteAccount(userId.toString(), "Bearer " + token, null);
        assertEquals(HttpStatus.OK, delRes.getStatusCode());

        Map<?, ?> body = (Map<?, ?>) delRes.getBody();
        assertNotNull(body);
        assertEquals(true, body.get("deleted"));
        assertEquals("Account permanently deleted", body.get("message"));

        // 4. Verify user is removed from database
        assertTrue(userRepository.findById(userId).isEmpty(), "User must be permanently deleted from database");
        assertTrue(userRepository.findByGoogleId("google-sub-delete-target").isEmpty());

        // 5. Verify tasks are removed from database
        assertTrue(taskRepository.findByUserIdOrderByCreatedAtDesc(userId).isEmpty(), "Tasks must be deleted");

        // 6. Verify tombstone exists in deleted_accounts
        assertTrue(deletedAccountRepository.existsByGoogleId("google-sub-delete-target"), "Tombstone for googleId must exist");
        assertTrue(deletedAccountRepository.existsByEmailIgnoreCase("delete-me@example.com"), "Tombstone for email must exist");
    }

    @Test
    void testUnauthenticatedDeletionReturns401() {
        ResponseEntity<?> res = authController.deleteAccount(null, null, null);
        assertEquals(HttpStatus.UNAUTHORIZED, res.getStatusCode());

        ResponseEntity<?> resInvalidBearer = authController.deleteAccount(null, "Bearer invalid-token", null);
        assertEquals(HttpStatus.UNAUTHORIZED, resInvalidBearer.getStatusCode());
    }

    @Test
    void testDeletedUserAttemptingGoogleLoginBlockedWith403AndNotRecreated() throws Exception {
        // 1. Create tombstone directly
        deletedAccountRepository.save(new auth_service.model.DeletedAccount(
            999L, "google-sub-deleted-999", "permanently-deleted@example.com", "USER_REQUESTED"
        ));

        // 2. Mock GoogleTokenVerifier returning this identity
        when(mockVerifier.verify("token-of-deleted-user"))
            .thenReturn(new VerifiedGoogleUser(
                "google-sub-deleted-999",
                "permanently-deleted@example.com",
                "Deleted User",
                "https://example.com/avatar.png"
            ));

        // 3. Attempt Google login
        ResponseEntity<?> res = authController.exchangeGoogleToken(Map.of("credential", "token-of-deleted-user"));
        assertEquals(HttpStatus.FORBIDDEN, res.getStatusCode());

        Map<?, ?> body = (Map<?, ?>) res.getBody();
        assertNotNull(body);
        assertEquals("ACCOUNT_DELETED", body.get("code"));
        assertEquals("This SAGE account was permanently deleted. Automatic recreation is disabled.", body.get("error"));

        // 4. Confirm user was NOT silently recreated in database
        assertTrue(userRepository.findByGoogleId("google-sub-deleted-999").isEmpty(),
            "Deleted user must not be silently recreated");
        assertTrue(userRepository.findByEmail("permanently-deleted@example.com").isEmpty());
    }

    @Test
    void testDeletionDoesNotAffectOtherUserData() {
        // Create Alice
        User alice = new User();
        alice.setGoogleId("google-sub-alice-del");
        alice.setEmail("alice-del@example.com");
        alice.setName("Alice Del");
        alice = userRepository.save(alice);

        auth_service.model.Task aliceTask = new auth_service.model.Task();
        aliceTask.setUserId(alice.getId());
        aliceTask.setTitle("Alice Task");
        taskRepository.save(aliceTask);

        // Create Bob
        User bob = new User();
        bob.setGoogleId("google-sub-bob-keep");
        bob.setEmail("bob-keep@example.com");
        bob.setName("Bob Keep");
        bob = userRepository.save(bob);

        auth_service.model.Task bobTask = new auth_service.model.Task();
        bobTask.setUserId(bob.getId());
        bobTask.setTitle("Bob Task");
        taskRepository.save(bobTask);

        // Delete Alice
        String aliceToken = jwtUtils.generateToken(alice.getId(), alice.getEmail());
        ResponseEntity<?> delRes = authController.deleteAccount(alice.getId().toString(), "Bearer " + aliceToken, null);
        assertEquals(HttpStatus.OK, delRes.getStatusCode());

        // Alice is gone
        assertTrue(userRepository.findById(alice.getId()).isEmpty());
        assertTrue(taskRepository.findByUserIdOrderByCreatedAtDesc(alice.getId()).isEmpty());

        // Bob remains completely untouched
        assertTrue(userRepository.findById(bob.getId()).isPresent(), "Bob must remain in DB");
        assertEquals(1, taskRepository.findByUserIdOrderByCreatedAtDesc(bob.getId()).size(), "Bob's tasks must remain untouched");

        // Cleanup Bob
        taskRepository.deleteAll(taskRepository.findByUserIdOrderByCreatedAtDesc(bob.getId()));
        userRepository.delete(bob);
    }

    @Test
    void testNewPermittedUserCanRegisterNormally() throws Exception {
        when(mockVerifier.verify("token-new-student"))
            .thenReturn(new VerifiedGoogleUser(
                "google-sub-new-student",
                "newstudent@university.edu",
                "New Student",
                "https://example.com/pic.png"
            ));

        ResponseEntity<?> res = authController.exchangeGoogleToken(Map.of("credential", "token-new-student"));
        assertEquals(HttpStatus.OK, res.getStatusCode());

        Map<?, ?> body = (Map<?, ?>) res.getBody();
        assertNotNull(body);
        assertNotNull(body.get("token"));

        Optional<User> created = userRepository.findByGoogleId("google-sub-new-student");
        assertTrue(created.isPresent(), "Permitted new user must be registered");
        assertEquals("newstudent@university.edu", created.get().getEmail());

        // Cleanup
        userRepository.delete(created.get());
    }

    @Test
    void testHealthEndpointReturnsUp() {
        ResponseEntity<Map<String, Object>> res = authController.health();
        assertEquals(HttpStatus.OK, res.getStatusCode());
        assertNotNull(res.getBody());
        assertEquals("UP", res.getBody().get("status"));
        assertEquals("auth-service", res.getBody().get("service"));
    }
}
