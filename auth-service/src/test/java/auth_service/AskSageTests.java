package auth_service;

import auth_service.config.JwtUtils;
import auth_service.controller.AuthController;
import auth_service.model.Task;
import auth_service.model.User;
import auth_service.repository.DeletedAccountRepository;
import auth_service.repository.ReminderRepository;
import auth_service.repository.TaskRepository;
import auth_service.repository.UserRepository;
import auth_service.service.GoogleTokenVerifier;
import auth_service.service.GeminiAiService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

@SpringBootTest
public class AskSageTests {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private TaskRepository taskRepository;

    @Autowired
    private DeletedAccountRepository deletedAccountRepository;

    @Autowired
    private ReminderRepository reminderRepository;

    @Autowired
    private JwtUtils jwtUtils;

    private User testUser;
    private String testToken;

    @BeforeEach
    void setUp() {
        taskRepository.deleteAll();
        reminderRepository.deleteAll();
        deletedAccountRepository.deleteAll();
        userRepository.findByEmail("sage_student@example.com").ifPresent(userRepository::delete);

        testUser = new User();
        testUser.setEmail("sage_student@example.com");
        testUser.setName("Sage Test Student");
        testUser.setCollege("Stanford University");
        testUser.setCourse("Computer Science");
        testUser.setYear("3rd Year");
        testUser.setTimezone("America/Los_Angeles");
        testUser.setOnboardingCompleted(true);
        testUser = userRepository.save(testUser);

        testToken = jwtUtils.generateToken(testUser.getId(), testUser.getEmail());
    }

    @Test
    void testUnauthenticatedAskSageReturns401() {
        GoogleTokenVerifier mockVerifier = mock(GoogleTokenVerifier.class);
        GeminiAiService mockAiService = mock(GeminiAiService.class);
        AuthController controller = new AuthController(userRepository, taskRepository, deletedAccountRepository,
                reminderRepository, mockVerifier, mockAiService, jwtUtils);

        ResponseEntity<?> response = controller.askSage(null, null, Map.of("message", "What should I do?"));
        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
    }

    @Test
    void testUnconfiguredGeminiServiceReturns503HonestError() {
        GoogleTokenVerifier mockVerifier = mock(GoogleTokenVerifier.class);
        GeminiAiService unconfiguredAiService = new GeminiAiService("", "https://generativelanguage.googleapis.com/v1beta", "gemini-3.8-flash", 25);
        AuthController controller = new AuthController(userRepository, taskRepository, deletedAccountRepository,
                reminderRepository, mockVerifier, unconfiguredAiService, jwtUtils);

        ResponseEntity<?> response = controller.askSage(String.valueOf(testUser.getId()), null,
                Map.of("message", "What should I do tonight?"));

        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, response.getStatusCode());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertNotNull(body);
        assertEquals(false, body.get("configured"));
        assertTrue(body.get("error").toString().contains("GEMINI_API_KEY"),
                "Error message should explicitly specify GEMINI_API_KEY");
    }

    @Test
    void testConfiguredGeminiReturnsGroundedResponseWithDatabaseContext() {
        // Add a high priority task
        Task t = new Task();
        t.setUserId(testUser.getId());
        t.setTitle("Complete Compiler Lab 3");
        t.setPriority("HIGH");
        t.setEstimatedMinutes(90);
        t.setStatus("PENDING");
        t.setCategory("Academic");
        taskRepository.save(t);

        GoogleTokenVerifier mockVerifier = mock(GoogleTokenVerifier.class);
        GeminiAiService mockAiService = mock(GeminiAiService.class);
        when(mockAiService.isConfigured()).thenReturn(true);
        when(mockAiService.generateResponse(any(User.class), anyList(), eq("What should I do first?"), anyMap()))
                .thenReturn(new GeminiAiService.SageAiResult(
                        "I recommend starting immediately with 'Complete Compiler Lab 3' as it is high priority with an estimated 90 minutes duration.",
                        "gemini-resp-101",
                        "gemini-3.8-flash",
                        "google-gemini"
                ));

        AuthController controller = new AuthController(userRepository, taskRepository, deletedAccountRepository,
                reminderRepository, mockVerifier, mockAiService, jwtUtils);

        ResponseEntity<?> response = controller.askSage(
                String.valueOf(testUser.getId()),
                "Bearer " + testToken,
                Map.of("message", "What should I do first?")
        );

        assertEquals(HttpStatus.OK, response.getStatusCode());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertNotNull(body);

        assertEquals("gemini-resp-101", body.get("responseId"));
        assertTrue(body.get("message").toString().contains("Complete Compiler Lab 3"));
        assertEquals(body.get("message"), body.get("reply")); // Frontend contract compatibility
        assertEquals(1, body.get("pendingTasksCount"));
        assertEquals(90, body.get("totalMinutes"));
        assertEquals(t.getId(), body.get("topTaskId"));
        assertEquals("Focus on Complete Compiler Lab 3 (90m)", body.get("action"));
        assertEquals(true, body.get("configured"));
        assertEquals("google-gemini", body.get("provider"));
        assertEquals("gemini-3.8-flash", body.get("model"));
    }

    @Test
    void testAiRateLimitTranslatesTo429() {
        GoogleTokenVerifier mockVerifier = mock(GoogleTokenVerifier.class);
        GeminiAiService mockAiService = mock(GeminiAiService.class);
        when(mockAiService.isConfigured()).thenReturn(true);
        when(mockAiService.generateResponse(any(), any(), any(), any()))
                .thenThrow(new GeminiAiService.AiRateLimitException("SAGE AI assistant is experiencing high traffic or quota limits. Please retry in a few moments."));

        AuthController controller = new AuthController(userRepository, taskRepository, deletedAccountRepository,
                reminderRepository, mockVerifier, mockAiService, jwtUtils);

        ResponseEntity<?> response = controller.askSage(
                String.valueOf(testUser.getId()),
                null,
                Map.of("message", "Prioritize my week")
        );

        assertEquals(HttpStatus.TOO_MANY_REQUESTS, response.getStatusCode());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertNotNull(body);
        assertTrue(body.get("error").toString().contains("high traffic or quota limits"));
    }

    @Test
    void testAiTimeoutTranslatesTo504() {
        GoogleTokenVerifier mockVerifier = mock(GoogleTokenVerifier.class);
        GeminiAiService mockAiService = mock(GeminiAiService.class);
        when(mockAiService.isConfigured()).thenReturn(true);
        when(mockAiService.generateResponse(any(), any(), any(), any()))
                .thenThrow(new GeminiAiService.AiTimeoutException("AI provider request timed out or network connection failed."));

        AuthController controller = new AuthController(userRepository, taskRepository, deletedAccountRepository,
                reminderRepository, mockVerifier, mockAiService, jwtUtils);

        ResponseEntity<?> response = controller.askSage(
                String.valueOf(testUser.getId()),
                null,
                Map.of("message", "Prioritize my week")
        );

        assertEquals(HttpStatus.GATEWAY_TIMEOUT, response.getStatusCode());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertNotNull(body);
        assertTrue(body.get("error").toString().contains("timed out"));
    }

    @Test
    void testAiAuthenticationFailureTranslatesTo502() {
        GoogleTokenVerifier mockVerifier = mock(GoogleTokenVerifier.class);
        GeminiAiService mockAiService = mock(GeminiAiService.class);
        when(mockAiService.isConfigured()).thenReturn(true);
        when(mockAiService.generateResponse(any(), any(), any(), any()))
                .thenThrow(new GeminiAiService.AiAuthenticationException("Google Gemini authentication failed. Please verify your GEMINI_API_KEY configuration."));

        AuthController controller = new AuthController(userRepository, taskRepository, deletedAccountRepository,
                reminderRepository, mockVerifier, mockAiService, jwtUtils);

        ResponseEntity<?> response = controller.askSage(
                String.valueOf(testUser.getId()),
                null,
                Map.of("message", "Prioritize my week")
        );

        assertEquals(HttpStatus.BAD_GATEWAY, response.getStatusCode());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertNotNull(body);
        assertTrue(body.get("error").toString().contains("GEMINI_API_KEY"));
    }

    @Test
    void testGeminiConfigurationKeyAndDefaults() {
        GeminiAiService geminiService = new GeminiAiService("AIzaSyTestKey1234567890", "https://generativelanguage.googleapis.com/v1beta", "gemini-3.8-flash", 25);
        assertTrue(geminiService.isConfigured());
        assertEquals("google-gemini", geminiService.getProviderName());
        assertEquals("gemini-3.8-flash", geminiService.getModel());
        assertEquals("https://generativelanguage.googleapis.com/v1beta", geminiService.getBaseUrl());
        assertEquals(25, geminiService.getTimeoutSeconds());
    }

    @Test
    void testGeminiFallbackKeyDetectedWhenPrimaryKeyAbsent() {
        GeminiAiService fallbackService = new GeminiAiService(
                "",
                "test-fallback-gemini-key-98765",
                "https://generativelanguage.googleapis.com/v1beta",
                "gemini-3.8-flash",
                25
        );
        assertTrue(fallbackService.isConfigured(), "Fallback key should configure Gemini when primary key is missing");
        assertEquals("google-gemini", fallbackService.getProviderName());
        assertEquals("gemini-3.8-flash", fallbackService.getModel());
    }

    @Test
    void testGeminiDirectInvocationWithMockRestClient() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer mockServer = MockRestServiceServer.bindTo(builder).build();

        String mockResponseBody = """
                {
                  "candidates": [
                    {
                      "content": {
                        "parts": [
                          { "text": "Start with Algorithms Homework due tomorrow." }
                        ],
                        "role": "model"
                      },
                      "finishReason": "STOP",
                      "index": 0
                    }
                  ],
                  "modelVersion": "gemini-3.8-flash",
                  "responseId": "gemini-mock-response-001"
                }
                """;

        mockServer.expect(requestTo("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header("x-goog-api-key", "test-secret-key"))
                .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                .andRespond(withSuccess(mockResponseBody, MediaType.APPLICATION_JSON));

        RestClient restClient = builder.baseUrl("https://generativelanguage.googleapis.com/v1beta").build();
        GeminiAiService geminiService = new GeminiAiService("test-secret-key", "https://generativelanguage.googleapis.com/v1beta", "gemini-3.8-flash", 25, restClient);

        Task sampleTask = new Task();
        sampleTask.setId(10L);
        sampleTask.setTitle("Algorithms Homework");
        sampleTask.setStatus("PENDING");
        sampleTask.setPriority("HIGH");
        sampleTask.setEstimatedMinutes(60);

        GeminiAiService.SageAiResult result = geminiService.generateResponse(testUser, List.of(sampleTask), "What should I do first?", Map.of());

        assertNotNull(result);
        assertEquals("Start with Algorithms Homework due tomorrow.", result.content());
        assertEquals("gemini-mock-response-001", result.responseId());
        assertEquals("gemini-3.8-flash", result.model());
        assertEquals("google-gemini", result.provider());

        mockServer.verify();
    }

    @Test
    void testGeminiMalformedResponseHandlingThrowsAiServiceException() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer mockServer = MockRestServiceServer.bindTo(builder).build();

        // Response with empty candidates array
        mockServer.expect(requestTo("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess("{\"candidates\": []}", MediaType.APPLICATION_JSON));

        RestClient restClient = builder.baseUrl("https://generativelanguage.googleapis.com/v1beta").build();
        GeminiAiService geminiService = new GeminiAiService("test-secret-key", "https://generativelanguage.googleapis.com/v1beta", "gemini-3.8-flash", 25, restClient);

        assertThrows(GeminiAiService.AiServiceException.class, () -> {
            geminiService.generateResponse(testUser, List.of(), "Hello", Map.of());
        });

        mockServer.verify();
    }

    @Test
    void testGeminiNoFallbackProviderCalledOnFailure() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer mockServer = MockRestServiceServer.bindTo(builder).build();

        // Simulate 429 Too Many Requests from Gemini
        mockServer.expect(requestTo("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withTooManyRequests());

        RestClient restClient = builder.baseUrl("https://generativelanguage.googleapis.com/v1beta").build();
        GeminiAiService geminiService = new GeminiAiService("test-secret-key", "https://generativelanguage.googleapis.com/v1beta", "gemini-3.8-flash", 25, restClient);

        // Must throw AiRateLimitException directly; must NOT attempt Groq/xAI fallback
        assertThrows(GeminiAiService.AiRateLimitException.class, () -> {
            geminiService.generateResponse(testUser, List.of(), "Plan my tasks", Map.of());
        });

        mockServer.verify();
    }
}
